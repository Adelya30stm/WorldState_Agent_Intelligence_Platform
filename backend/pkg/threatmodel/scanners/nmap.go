package scanners

import (
	"context"
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"pentagi/pkg/graphiti"
)

// NmapPort represents a single port entry from an nmap scan.
type NmapPort struct {
	Port     int
	Protocol string
	State    string
	Service  string
	Version  string
	Banner   string
}

// NmapHost represents a single host discovered during an nmap scan.
type NmapHost struct {
	IP       string
	Hostname string
	State    string // "up" or "down"
	OS       string
	Ports    []NmapPort
}

// GraphitiWriter is the minimal interface required to ingest messages into Graphiti.
type GraphitiWriter interface {
	AddMessages(ctx context.Context, req graphiti.AddMessagesRequest) error
}

// NmapImporter ingests parsed nmap results into Graphiti.
type NmapImporter struct {
	groupID  string
	graphiti GraphitiWriter
}

// NewNmapImporter constructs a new NmapImporter.
func NewNmapImporter(groupID string, g GraphitiWriter) *NmapImporter {
	return &NmapImporter{groupID: groupID, graphiti: g}
}

// — XML parsing types — //

type nmapRun struct {
	XMLName xml.Name   `xml:"nmaprun"`
	Hosts   []nmapHost `xml:"host"`
}

type nmapHost struct {
	Addresses []nmapAddress  `xml:"address"`
	Hostnames nmapHostnames  `xml:"hostnames"`
	OS        nmapOS         `xml:"os"`
	Ports     nmapPorts      `xml:"ports"`
	Status    nmapHostStatus `xml:"status"`
}

type nmapHostStatus struct {
	State string `xml:"state,attr"`
}

type nmapAddress struct {
	Addr     string `xml:"addr,attr"`
	AddrType string `xml:"addrtype,attr"`
}

type nmapHostnames struct {
	Hostnames []nmapHostname `xml:"hostname"`
}

type nmapHostname struct {
	Name string `xml:"name,attr"`
	Type string `xml:"type,attr"`
}

type nmapOS struct {
	Matches []nmapOSMatch `xml:"osmatch"`
}

type nmapOSMatch struct {
	Name     string `xml:"name,attr"`
	Accuracy string `xml:"accuracy,attr"`
}

type nmapPorts struct {
	Ports []nmapPort `xml:"port"`
}

type nmapPort struct {
	Protocol string      `xml:"protocol,attr"`
	PortID   int         `xml:"portid,attr"`
	State    nmapState   `xml:"state"`
	Service  nmapService `xml:"service"`
}

type nmapState struct {
	State string `xml:"state,attr"`
}

type nmapService struct {
	Name      string `xml:"name,attr"`
	Product   string `xml:"product,attr"`
	Version   string `xml:"version,attr"`
	ExtraInfo string `xml:"extrainfo,attr"`
}

// ParseNmapXML parses nmap XML output (produced with -oX) into a slice of NmapHost.
func ParseNmapXML(data []byte) ([]NmapHost, error) {
	var run nmapRun
	if err := xml.Unmarshal(data, &run); err != nil {
		return nil, fmt.Errorf("nmap xml unmarshal: %w", err)
	}

	hosts := make([]NmapHost, 0, len(run.Hosts))
	for _, h := range run.Hosts {
		host := NmapHost{
			State: h.Status.State,
		}

		// Pick the first IPv4 address; fall back to any address.
		for _, a := range h.Addresses {
			if a.AddrType == "ipv4" {
				host.IP = a.Addr
				break
			}
		}
		if host.IP == "" && len(h.Addresses) > 0 {
			host.IP = h.Addresses[0].Addr
		}

		// Pick the first PTR hostname.
		for _, hn := range h.Hostnames.Hostnames {
			if hn.Type == "PTR" {
				host.Hostname = hn.Name
				break
			}
		}
		if host.Hostname == "" && len(h.Hostnames.Hostnames) > 0 {
			host.Hostname = h.Hostnames.Hostnames[0].Name
		}

		// Pick the best OS match (first entry, typically highest accuracy).
		if len(h.OS.Matches) > 0 {
			host.OS = h.OS.Matches[0].Name
		}

		// Ports.
		for _, p := range h.Ports.Ports {
			svc := p.Service.Name
			ver := strings.TrimSpace(p.Service.Product + " " + p.Service.Version)
			if ver == "" {
				ver = p.Service.ExtraInfo
			}

			host.Ports = append(host.Ports, NmapPort{
				Port:     p.PortID,
				Protocol: p.Protocol,
				State:    p.State.State,
				Service:  svc,
				Version:  ver,
			})
		}

		hosts = append(hosts, host)
	}

	return hosts, nil
}

// Import ingests hosts that are "up" into Graphiti, batching up to 10 per call.
func (ni *NmapImporter) Import(ctx context.Context, hosts []NmapHost) error {
	const batchSize = 10

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

	for _, h := range hosts {
		if h.State != "up" {
			continue
		}

		display := h.Hostname
		if display == "" {
			display = h.IP
		}

		var sb strings.Builder
		fmt.Fprintf(&sb, "Host discovery: %s is online.\n", display)
		fmt.Fprintf(&sb, "IP address: %s\n", h.IP)
		if h.Hostname != "" {
			fmt.Fprintf(&sb, "Hostname: %s\n", h.Hostname)
		}
		if h.OS != "" {
			fmt.Fprintf(&sb, "Operating system: %s\n", h.OS)
		}

		if len(h.Ports) > 0 {
			sb.WriteString("Open ports:\n")
			for _, p := range h.Ports {
				fmt.Fprintf(&sb, "- Port %d/%s: %s %s (%s)\n",
					p.Port, p.Protocol, p.Service, p.Version, p.State)
			}
		}

		batch = append(batch, graphiti.Message{
			Content:           sb.String(),
			Author:            "scanner",
			Timestamp:         time.Now(),
			Name:              "nmap_host_discovery",
			SourceDescription: "nmap-scan",
		})

		if len(batch) >= batchSize {
			if err := flush(); err != nil {
				return err
			}
		}
	}

	return flush()
}
