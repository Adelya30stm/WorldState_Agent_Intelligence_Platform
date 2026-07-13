// Threat Modeling Ontology Migration — v001
// Adds supplemental labels, constraints, and indexes on top of Graphiti's
// existing Entity/Episode/Community schema. Does NOT modify Graphiti internals.
//
// Run with: cypher-shell -u neo4j -p <password> -f 001_threat_ontology.cypher
// Or via: docker exec neo4j cypher-shell -u neo4j -p <password> < 001_threat_ontology.cypher

// ============================================================
// 1. UNIQUENESS CONSTRAINTS
// ============================================================

CREATE CONSTRAINT asset_uuid IF NOT EXISTS
  FOR (n:Asset) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT host_uuid IF NOT EXISTS
  FOR (n:Host) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT service_uuid IF NOT EXISTS
  FOR (n:Service) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT endpoint_uuid IF NOT EXISTS
  FOR (n:Endpoint) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT data_uuid IF NOT EXISTS
  FOR (n:Data) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT vulnerability_uuid IF NOT EXISTS
  FOR (n:Vulnerability) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT control_uuid IF NOT EXISTS
  FOR (n:Control) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT network_segment_uuid IF NOT EXISTS
  FOR (n:NetworkSegment) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT actor_uuid IF NOT EXISTS
  FOR (n:Actor) REQUIRE n.uuid IS UNIQUE;

CREATE CONSTRAINT threat_uuid IF NOT EXISTS
  FOR (n:Threat) REQUIRE n.uuid IS UNIQUE;

// ============================================================
// 2. INDEXES
// ============================================================

CREATE INDEX host_exposure IF NOT EXISTS
  FOR (n:Host) ON (n.exposure);

CREATE INDEX host_ip IF NOT EXISTS
  FOR (n:Host) ON (n.ip);

CREATE INDEX vulnerability_cvss IF NOT EXISTS
  FOR (n:Vulnerability) ON (n.cvss);

CREATE INDEX vulnerability_cve_id IF NOT EXISTS
  FOR (n:Vulnerability) ON (n.cve_id);

CREATE INDEX service_port IF NOT EXISTS
  FOR (n:Service) ON (n.port);

CREATE INDEX data_classification IF NOT EXISTS
  FOR (n:Data) ON (n.classification);

CREATE INDEX network_segment_public IF NOT EXISTS
  FOR (n:NetworkSegment) ON (n.public);

CREATE INDEX threat_stride_category IF NOT EXISTS
  FOR (n:Threat) ON (n.stride_category);

// ============================================================
// 3. RE-LABEL EXISTING ENTITY NODES
// The Entity label is preserved; new ontology labels are added.
// ============================================================

// Host
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'host'
     OR toLower(n.name)    CONTAINS 'server'
     OR toLower(n.name)    CONTAINS 'machine'
     OR toLower(n.name)    CONTAINS 'node'
     OR toLower(n.name)    CONTAINS 'ip '
     OR toLower(n.name)    CONTAINS 'system'
     OR toLower(n.name)    CONTAINS 'device'
     OR toLower(n.summary) CONTAINS 'host'
     OR toLower(n.summary) CONTAINS 'server'
     OR toLower(n.summary) CONTAINS 'machine'
     OR toLower(n.summary) CONTAINS 'node'
     OR toLower(n.summary) CONTAINS 'ip '
     OR toLower(n.summary) CONTAINS 'system'
     OR toLower(n.summary) CONTAINS 'device'
  SET n:Host
};

// Service
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'port'
     OR toLower(n.name)    CONTAINS 'service'
     OR toLower(n.name)    CONTAINS 'daemon'
     OR toLower(n.name)    CONTAINS 'http'
     OR toLower(n.name)    CONTAINS 'ssh'
     OR toLower(n.name)    CONTAINS 'ftp'
     OR toLower(n.name)    CONTAINS 'smtp'
     OR toLower(n.name)    CONTAINS 'mysql'
     OR toLower(n.name)    CONTAINS 'postgres'
     OR toLower(n.name)    CONTAINS 'redis'
     OR toLower(n.name)    CONTAINS 'nginx'
     OR toLower(n.name)    CONTAINS 'apache'
     OR toLower(n.summary) CONTAINS 'port'
     OR toLower(n.summary) CONTAINS 'service'
     OR toLower(n.summary) CONTAINS 'daemon'
     OR toLower(n.summary) CONTAINS 'http'
     OR toLower(n.summary) CONTAINS 'ssh'
     OR toLower(n.summary) CONTAINS 'ftp'
     OR toLower(n.summary) CONTAINS 'smtp'
     OR toLower(n.summary) CONTAINS 'mysql'
     OR toLower(n.summary) CONTAINS 'postgres'
     OR toLower(n.summary) CONTAINS 'redis'
     OR toLower(n.summary) CONTAINS 'nginx'
     OR toLower(n.summary) CONTAINS 'apache'
  SET n:Service
};

// Endpoint
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS '/api/'
     OR toLower(n.name)    CONTAINS '/v1/'
     OR toLower(n.name)    CONTAINS '/v2/'
     OR toLower(n.name)    CONTAINS 'endpoint'
     OR toLower(n.name)    CONTAINS 'route'
     OR toLower(n.name)    CONTAINS 'path'
     OR toLower(n.name)    CONTAINS 'url'
     OR toLower(n.summary) CONTAINS '/api/'
     OR toLower(n.summary) CONTAINS '/v1/'
     OR toLower(n.summary) CONTAINS '/v2/'
     OR toLower(n.summary) CONTAINS 'endpoint'
     OR toLower(n.summary) CONTAINS 'route'
     OR toLower(n.summary) CONTAINS 'path'
     OR toLower(n.summary) CONTAINS 'url'
  SET n:Endpoint
};

// Vulnerability
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'vulnerability'
     OR toLower(n.name)    CONTAINS 'vuln'
     OR toLower(n.name)    CONTAINS 'cve-'
     OR toLower(n.name)    CONTAINS 'sqli'
     OR toLower(n.name)    CONTAINS 'xss'
     OR toLower(n.name)    CONTAINS 'rce'
     OR toLower(n.name)    CONTAINS 'injection'
     OR toLower(n.name)    CONTAINS 'exploit'
     OR toLower(n.name)    CONTAINS 'idor'
     OR toLower(n.name)    CONTAINS 'ssrf'
     OR toLower(n.summary) CONTAINS 'vulnerability'
     OR toLower(n.summary) CONTAINS 'vuln'
     OR toLower(n.summary) CONTAINS 'cve-'
     OR toLower(n.summary) CONTAINS 'sqli'
     OR toLower(n.summary) CONTAINS 'xss'
     OR toLower(n.summary) CONTAINS 'rce'
     OR toLower(n.summary) CONTAINS 'injection'
     OR toLower(n.summary) CONTAINS 'exploit'
     OR toLower(n.summary) CONTAINS 'idor'
     OR toLower(n.summary) CONTAINS 'ssrf'
  SET n:Vulnerability
};

// Data
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'credential'
     OR toLower(n.name)    CONTAINS 'password'
     OR toLower(n.name)    CONTAINS 'token'
     OR toLower(n.name)    CONTAINS 'pii'
     OR toLower(n.name)    CONTAINS 'database'
     OR toLower(n.name)    CONTAINS 'secret'
     OR toLower(n.name)    CONTAINS 'api key'
     OR toLower(n.name)    CONTAINS 'private key'
     OR toLower(n.summary) CONTAINS 'credential'
     OR toLower(n.summary) CONTAINS 'password'
     OR toLower(n.summary) CONTAINS 'token'
     OR toLower(n.summary) CONTAINS 'pii'
     OR toLower(n.summary) CONTAINS 'database'
     OR toLower(n.summary) CONTAINS 'secret'
     OR toLower(n.summary) CONTAINS 'api key'
     OR toLower(n.summary) CONTAINS 'private key'
  SET n:Data
};

// Actor
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'attacker'
     OR toLower(n.name)    CONTAINS 'actor'
     OR toLower(n.name)    CONTAINS 'threat agent'
     OR toLower(n.name)    CONTAINS 'adversary'
     OR toLower(n.name)    CONTAINS 'user'
     OR toLower(n.name)    CONTAINS 'admin'
     OR toLower(n.summary) CONTAINS 'attacker'
     OR toLower(n.summary) CONTAINS 'actor'
     OR toLower(n.summary) CONTAINS 'threat agent'
     OR toLower(n.summary) CONTAINS 'adversary'
     OR toLower(n.summary) CONTAINS 'user'
     OR toLower(n.summary) CONTAINS 'admin'
  SET n:Actor
};

// Threat
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'threat'
     OR toLower(n.name)    CONTAINS 'attack'
     OR toLower(n.name)    CONTAINS 'stride'
     OR toLower(n.name)    CONTAINS 'spoofing'
     OR toLower(n.name)    CONTAINS 'tampering'
     OR toLower(n.name)    CONTAINS 'repudiation'
     OR toLower(n.name)    CONTAINS 'denial'
     OR toLower(n.name)    CONTAINS 'elevation'
     OR toLower(n.summary) CONTAINS 'threat'
     OR toLower(n.summary) CONTAINS 'attack'
     OR toLower(n.summary) CONTAINS 'stride'
     OR toLower(n.summary) CONTAINS 'spoofing'
     OR toLower(n.summary) CONTAINS 'tampering'
     OR toLower(n.summary) CONTAINS 'repudiation'
     OR toLower(n.summary) CONTAINS 'denial'
     OR toLower(n.summary) CONTAINS 'elevation'
  SET n:Threat
};

// NetworkSegment
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'network'
     OR toLower(n.name)    CONTAINS 'segment'
     OR toLower(n.name)    CONTAINS 'subnet'
     OR toLower(n.name)    CONTAINS 'vlan'
     OR toLower(n.name)    CONTAINS 'dmz'
     OR toLower(n.name)    CONTAINS 'cidr'
     OR toLower(n.name)    CONTAINS 'firewall'
     OR toLower(n.summary) CONTAINS 'network'
     OR toLower(n.summary) CONTAINS 'segment'
     OR toLower(n.summary) CONTAINS 'subnet'
     OR toLower(n.summary) CONTAINS 'vlan'
     OR toLower(n.summary) CONTAINS 'dmz'
     OR toLower(n.summary) CONTAINS 'cidr'
     OR toLower(n.summary) CONTAINS 'firewall'
  SET n:NetworkSegment
};

// Control
CALL {
  MATCH (n:Entity)
  WHERE toLower(n.name)    CONTAINS 'control'
     OR toLower(n.name)    CONTAINS 'waf'
     OR toLower(n.name)    CONTAINS 'ips'
     OR toLower(n.name)    CONTAINS 'ids'
     OR toLower(n.name)    CONTAINS 'firewall'
     OR toLower(n.name)    CONTAINS 'authentication'
     OR toLower(n.name)    CONTAINS 'authorization'
     OR toLower(n.name)    CONTAINS 'encryption'
     OR toLower(n.summary) CONTAINS 'control'
     OR toLower(n.summary) CONTAINS 'waf'
     OR toLower(n.summary) CONTAINS 'ips'
     OR toLower(n.summary) CONTAINS 'ids'
     OR toLower(n.summary) CONTAINS 'firewall'
     OR toLower(n.summary) CONTAINS 'authentication'
     OR toLower(n.summary) CONTAINS 'authorization'
     OR toLower(n.summary) CONTAINS 'encryption'
  SET n:Control
};

// ============================================================
// 4. DEFAULT PROPERTIES ON NEWLY LABELED NODES
// Only set if the property does not already exist.
// ============================================================

// Host defaults
CALL {
  MATCH (n:Host)
  SET n.exposure    = COALESCE(n.exposure, 'unknown')
  SET n.criticality = COALESCE(n.criticality, 5)
};

// Vulnerability defaults
CALL {
  MATCH (n:Vulnerability)
  SET n.cvss        = COALESCE(n.cvss, 0.0)
  SET n.exploitable = COALESCE(n.exploitable, false)
};

// NetworkSegment defaults
CALL {
  MATCH (n:NetworkSegment)
  SET n.public = COALESCE(n.public, false)
};

// Data defaults
CALL {
  MATCH (n:Data)
  SET n.classification = COALESCE(n.classification, 'internal')
};

// Service defaults
CALL {
  MATCH (n:Service)
  SET n.port = COALESCE(n.port, 0)
};
