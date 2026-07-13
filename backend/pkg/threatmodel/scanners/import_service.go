package scanners

import (
	"fmt"
	"io"
	"net/http"
	"strconv"

	"pentagi/pkg/server/response"

	"github.com/gin-gonic/gin"
)

// ScannerImportService handles HTTP requests for importing scanner output into Graphiti.
type ScannerImportService struct {
	graphiti GraphitiWriter
}

// NewScannerImportService constructs a new ScannerImportService.
func NewScannerImportService(g GraphitiWriter) *ScannerImportService {
	return &ScannerImportService{graphiti: g}
}

type importResult struct {
	Imported    int    `json:"imported"`
	FlowID      uint64 `json:"flowId"`
	ScannerType string `json:"scannerType"`
}

// ImportScan handles POST /flows/:flowID/import/scanner.
//
// The request must be a multipart form with:
//   - type  — scanner type: "nmap" or "nessus"
//   - file  — the XML output file
//
// @Summary Import scanner XML output into the knowledge graph
// @Tags Flows
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param flowID path int true "flow id" minimum(0)
// @Param type formData string true "scanner type (nmap|nessus)"
// @Param file formData file true "scanner XML output"
// @Success 200 {object} response.successResp{data=importResult} "import successful"
// @Failure 400 {object} response.errorResp "invalid request"
// @Failure 500 {object} response.errorResp "internal error"
// @Router /flows/{flowID}/import/scanner [post]
func (s *ScannerImportService) ImportScan(c *gin.Context) {
	flowID, err := strconv.ParseUint(c.Param("flowID"), 10, 64)
	if err != nil {
		response.Error(c, response.ErrFlowsInvalidRequest, fmt.Errorf("invalid flow id: %w", err))
		return
	}

	scannerType := c.PostForm("type")
	if scannerType != "nmap" && scannerType != "nessus" {
		response.Error(c, response.ErrFlowsInvalidRequest,
			fmt.Errorf("unsupported scanner type %q: must be nmap or nessus", scannerType))
		return
	}

	f, _, err := c.Request.FormFile("file")
	if err != nil {
		response.Error(c, response.ErrFlowsInvalidRequest, fmt.Errorf("reading form file: %w", err))
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		response.Error(c, response.ErrInternal, fmt.Errorf("reading uploaded file: %w", err))
		return
	}

	groupID := fmt.Sprintf("flow-%d", flowID)
	imported := 0

	switch scannerType {
	case "nmap":
		hosts, err := ParseNmapXML(data)
		if err != nil {
			response.Error(c, response.ErrFlowsInvalidRequest, fmt.Errorf("parsing nmap xml: %w", err))
			return
		}
		importer := NewNmapImporter(groupID, s.graphiti)
		if err := importer.Import(c.Request.Context(), hosts); err != nil {
			response.Error(c, response.ErrInternal, fmt.Errorf("importing nmap results: %w", err))
			return
		}
		for _, h := range hosts {
			if h.State == "up" {
				imported++
			}
		}

	case "nessus":
		hosts, err := ParseNessusXML(data)
		if err != nil {
			response.Error(c, response.ErrFlowsInvalidRequest, fmt.Errorf("parsing nessus xml: %w", err))
			return
		}
		importer := NewNessusImporter(groupID, s.graphiti)
		if err := importer.Import(c.Request.Context(), hosts); err != nil {
			response.Error(c, response.ErrInternal, fmt.Errorf("importing nessus results: %w", err))
			return
		}
		for _, h := range hosts {
			for _, f := range h.Findings {
				if f.Severity >= 1 {
					imported++
				}
			}
		}
	}

	response.Success(c, http.StatusOK, importResult{
		Imported:    imported,
		FlowID:      flowID,
		ScannerType: scannerType,
	})
}
