package scanners

import (
	"context"
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
	"time"

	"pentagi/pkg/graphiti"
)

// NessusFinding represents a single vulnerability finding from a Nessus scan.
type NessusFinding struct {
	PluginID    int
	PluginName  string
	Severity    int // 0=Info, 1=Low, 2=Medium, 3=High, 4=Critical
	CVE         string
	CVSS        float64
	Description string
	Solution    string
	Port        int
	Protocol    string
	SvcName     string
}

// NessusHost represents a single host with all its findings from a Nessus scan.
type NessusHost struct {
	IP       string
	Hostname string
	OS       string
	Findings []NessusFinding
}

// NessusImporter ingests parsed Nessus results into Graphiti.
type NessusImporter struct {
	groupID  string
	graphiti GraphitiWriter
}

// NewNessusImporter constructs a new NessusImporter.
func NewNessusImporter(groupID string, g GraphitiWriter) *NessusImporter {
	return &NessusImporter{groupID: groupID, graphiti: g}
}

// — XML parsing types — //

type nessusClientData struct {
	XMLName xml.Name      `xml:"NessusClientData_v2"`
	Reports []nessusReport `xml:"Report"`
}

type nessusReport struct {
	Name  string        `xml:"name,attr"`
	Hosts []nessusHost  `xml:"ReportHost"`
}

type nessusHost struct {
	Name       string              `xml:"name,attr"`
	Properties nessusHostProps     `xml:"HostProperties"`
	Items      []nessusReportItem  `xml:"ReportItem"`
}

type nessusHostProps struct {
	Tags []nessusTag `xml:"tag"`
}

type nessusTag struct {
	Name  string `xml:"name,attr"`
	Value string `xml:",chardata"`
}

type nessusReportItem struct {
	Port       int    `xml:"port,attr"`
	SvcName    string `xml:"svc_name,attr"`
	Protocol   string `xml:"protocol,attr"`
	PluginID   int    `xml:"pluginID,attr"`
	PluginName string `xml:"pluginName,attr"`

	Severity    int     `xml:"severity"`
	CVE         string  `xml:"cve"`
	CVSSRaw     string  `xml:"cvss_base_score"`
	Description string  `xml:"description"`
	Solution    string  `xml:"solution"`
}

// ParseNessusXML parses a .nessus XML file into a slice of NessusHost.
func ParseNessusXML(data []byte) ([]NessusHost, error) {
	var nd nessusClientData
	if err := xml.Unmarshal(data, &nd); err != nil {
		return nil, fmt.Errorf("nessus xml unmarshal: %w", err)
	}

	var hosts []NessusHost
	for _, report := range nd.Reports {
		for _, rh := range report.Hosts {
			host := NessusHost{}

			// Extract well-known host property tags.
			for _, tag := range rh.Properties.Tags {
				switch tag.Name {
				case "host-ip":
					host.IP = strings.TrimSpace(tag.Value)
				case "host-fqdn":
					host.Hostname = strings.TrimSpace(tag.Value)
				case "operating-system":
					host.OS = strings.TrimSpace(tag.Value)
				}
			}

			// Fall back to report host name if IP is missing.
			if host.IP == "" {
				host.IP = rh.Name
			}

			for _, item := range rh.Items {
				cvss, _ := strconv.ParseFloat(strings.TrimSpace(item.CVSSRaw), 64)

				host.Findings = append(host.Findings, NessusFinding{
					PluginID:    item.PluginID,
					PluginName:  item.PluginName,
					Severity:    item.Severity,
					CVE:         strings.TrimSpace(item.CVE),
					CVSS:        cvss,
					Description: strings.TrimSpace(item.Description),
					Solution:    strings.TrimSpace(item.Solution),
					Port:        item.Port,
					Protocol:    item.Protocol,
					SvcName:     item.SvcName,
				})
			}

			hosts = append(hosts, host)
		}
	}

	return hosts, nil
}

// Import ingests findings with severity >= 1 into Graphiti, batching 5 findings per message.
func (ni *NessusImporter) Import(ctx context.Context, hosts []NessusHost) error {
	const batchSize = 5

	var batch []graphiti.Message

	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		err := ni.graphiti.AddMessages(ctx, graphiti.AddMessagesRequest{
			GroupID:  ni.groupID,
			Messages: batch,
		})
		batch = batch[:0]
		return err
	}

	truncate := func(s string, max int) string {
		runes := []rune(s)
		if len(runes) <= max {
			return s
		}
		return string(runes[:max]) + "..."
	}

	for _, h := range hosts {
		display := h.Hostname
		if display == "" {
			display = h.IP
		}

		for _, f := range h.Findings {
			if f.Severity < 1 {
				continue
			}

			cve := f.CVE
			if cve == "" {
				cve = "N/A"
			}

			var sb strings.Builder
			fmt.Fprintf(&sb, "Vulnerability discovered on %s:%d/%s.\n", display, f.Port, f.Protocol)
			fmt.Fprintf(&sb, "Plugin: %s\n", f.PluginName)
			fmt.Fprintf(&sb, "Severity: %s (score: %.1f)\n", severityLabel(f.Severity), f.CVSS)
			fmt.Fprintf(&sb, "CVE: %s\n", cve)
			fmt.Fprintf(&sb, "Description: %s\n", truncate(f.Description, 500))
			fmt.Fprintf(&sb, "Recommended solution: %s\n", truncate(f.Solution, 300))

			batch = append(batch, graphiti.Message{
				Content:           sb.String(),
				Author:            "scanner",
				Timestamp:         time.Now(),
				Name:              "nessus_vulnerability",
				SourceDescription: "nessus-scan",
			})

			if len(batch) >= batchSize {
				if err := flush(); err != nil {
					return err
				}
			}
		}
	}

	return flush()
}
