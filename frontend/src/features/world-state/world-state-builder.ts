// ─────────────────────────────────────────────────────────────────────────────
// World State Builder — extracts entities from flow data
// ─────────────────────────────────────────────────────────────────────────────

import type {
    AgentLogFragmentFragment,
    MessageLogFragmentFragment,
    SearchLogFragmentFragment,
    TaskFragmentFragment,
    TerminalLogFragmentFragment,
} from '@/graphql/types';
import { TerminalLogType } from '@/graphql/types';

import type { WorldState, WorldStateEntity, WorldStateLink } from './world-state-types';
import { ENTITY_ACTIONS } from './world-state-types';

// ─── Extraction patterns ──────────────────────────────────────────────────────

const DOMAIN_RE = /\b([a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+)\b/g;
const IPV4_RE = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
const URL_RE = /https?:\/\/[^\s'"`,<>)]+/g;

const TOOL_PATTERNS: { re: RegExp; name: string; risk: 'low' | 'medium' | 'high' | 'critical' }[] = [
    { re: /\bnmap\b/, name: 'nmap', risk: 'high' },
    { re: /\bgobuster\b/, name: 'gobuster', risk: 'medium' },
    { re: /\bffuf\b/, name: 'ffuf', risk: 'medium' },
    { re: /\bwfuzz\b/, name: 'wfuzz', risk: 'medium' },
    { re: /\bdirsearch\b/, name: 'dirsearch', risk: 'medium' },
    { re: /\bsqlmap\b/, name: 'sqlmap', risk: 'critical' },
    { re: /\bnikto\b/, name: 'nikto', risk: 'high' },
    { re: /\bhydra\b/, name: 'hydra', risk: 'critical' },
    { re: /\bmsfconsole|msfvenom|metasploit\b/, name: 'metasploit', risk: 'critical' },
    { re: /\bnuclei\b/, name: 'nuclei', risk: 'high' },
    { re: /\bsublist3r\b/, name: 'sublist3r', risk: 'low' },
    { re: /\bamass\b/, name: 'amass', risk: 'low' },
    { re: /\bhttpx\b/, name: 'httpx', risk: 'low' },
    { re: /\bdnsx\b/, name: 'dnsx', risk: 'low' },
    { re: /\btheHarvester\b/i, name: 'theharvester', risk: 'low' },
    { re: /\bcurl\b/, name: 'curl', risk: 'low' },
    { re: /\bwget\b/, name: 'wget', risk: 'low' },
    { re: /\bssh\b/, name: 'ssh', risk: 'medium' },
    { re: /\bwapiti\b/, name: 'wapiti', risk: 'high' },
    { re: /\bpython3?\s/, name: 'python', risk: 'medium' },
];

// Domains we know are infrastructure / noise
const NOISE_DOMAINS = new Set([
    'localhost', 'example.com', 'github.com', 'npmjs.com', 'docker.io',
    'golang.org', 'pkg.go.dev', 'googleapis.com', 'cloudflare.com',
    'ubuntu.com', 'debian.org', 'kali.org',
]);

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function extractDomains(text: string): string[] {
    const out = new Set<string>();
    let m: RegExpExecArray | null;

    const d = new RegExp(DOMAIN_RE.source, 'g');
    while ((m = d.exec(text)) !== null) {
        const v = m[1].toLowerCase();
        if (!NOISE_DOMAINS.has(v) && v.includes('.')) out.add(v);
    }

    const ip = new RegExp(IPV4_RE.source, 'g');
    while ((m = ip.exec(text)) !== null) {
        const v = m[1];
        if (!v.startsWith('127.') && !v.startsWith('0.')) out.add(v);
    }

    return [...out];
}

function extractUrls(text: string): string[] {
    const out = new Set<string>();
    const re = new RegExp(URL_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const url = m[0].replace(/[.,'"]$/, '');
        if (url.length > 12) out.add(url);
    }
    return [...out];
}

function detectTool(cmd: string): (typeof TOOL_PATTERNS)[0] | null {
    for (const p of TOOL_PATTERNS) {
        if (p.re.test(cmd)) return p;
    }
    return null;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const COL_X: Record<string, number> = {
    flow: 60,
    task: 320,
    subtask: 580,
    tool: 840,
    domain: 1100,
    endpoint: 1360,
    command: 840,
    finding: 1100,
};
const ROW_H = 110;

function assignPositions(entities: WorldStateEntity[]) {
    const counters: Record<string, number> = {};
    for (const e of entities) {
        const col = e.type;
        const row = counters[col] ?? 0;
        counters[col] = row + 1;
        e.position = { x: COL_X[col] ?? 840, y: row * ROW_H + 60 };
    }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export interface FlowBuildInput {
    flowId: string;
    flowTitle: string;
    tasks: TaskFragmentFragment[];
    terminalLogs: TerminalLogFragmentFragment[];
    messageLogs: MessageLogFragmentFragment[];
    agentLogs: AgentLogFragmentFragment[];
    searchLogs: SearchLogFragmentFragment[];
}

export function buildWorldState(input: FlowBuildInput): WorldState {
    const entities: WorldStateEntity[] = [];
    const links: WorldStateLink[] = [];
    const seenIds = new Set<string>();
    const seenDomains = new Set<string>();
    const seenEndpoints = new Set<string>();
    const seenTools = new Set<string>();

    function addEntity(e: WorldStateEntity) {
        if (!seenIds.has(e.id)) {
            seenIds.add(e.id);
            entities.push(e);
        }
    }

    // ── Flow root ─────────────────────────────────────────────────────────────
    const flowId = `flow-${input.flowId}`;
    addEntity({
        id: flowId,
        type: 'flow',
        label: input.flowTitle,
        metadata: { flowId: input.flowId },
        availableActions: ENTITY_ACTIONS.flow,
        riskLevel: 'none',
    });

    // ── Tasks ─────────────────────────────────────────────────────────────────
    for (const task of input.tasks) {
        const taskId = `task-${task.id}`;
        addEntity({
            id: taskId,
            type: 'task',
            label: task.title,
            status: task.status,
            metadata: {
                taskId: task.id,
                input: task.input.slice(0, 300),
                result: task.result.slice(0, 300),
            },
            availableActions: ENTITY_ACTIONS.task,
            riskLevel: 'none',
        });
        links.push({ id: `fl-tk-${task.id}`, source: flowId, target: taskId, type: 'contains' });

        // ── Subtasks ──────────────────────────────────────────────────────────
        for (const st of task.subtasks ?? []) {
            const stId = `subtask-${st.id}`;
            addEntity({
                id: stId,
                type: 'subtask',
                label: st.title,
                status: st.status,
                metadata: {
                    subtaskId: st.id,
                    description: st.description.slice(0, 300),
                    result: st.result.slice(0, 200),
                },
                availableActions: ENTITY_ACTIONS.subtask,
                riskLevel: 'none',
            });
            links.push({ id: `tk-st-${st.id}`, source: taskId, target: stId, type: 'contains' });
        }
    }

    // ── Terminal stdin → tools + domains + endpoints ───────────────────────────
    for (const log of input.terminalLogs) {
        if (log.type !== TerminalLogType.Stdin) continue;
        const cmd = log.text.trim();
        if (cmd.length < 3) continue;

        const toolDef = detectTool(cmd);
        let toolNodeId: string | null = null;

        if (toolDef && !seenTools.has(toolDef.name)) {
            seenTools.add(toolDef.name);
            toolNodeId = `tool-${toolDef.name}`;
            addEntity({
                id: toolNodeId,
                type: 'tool',
                label: toolDef.name,
                metadata: { tool: toolDef.name },
                availableActions: ENTITY_ACTIONS.tool,
                riskLevel: toolDef.risk,
            });
        } else if (toolDef) {
            toolNodeId = `tool-${toolDef.name}`;
        }

        // Domains from command
        for (const domain of extractDomains(cmd)) {
            if (seenDomains.has(domain)) continue;
            seenDomains.add(domain);
            const domId = `domain-${slugify(domain)}`;
            addEntity({
                id: domId,
                type: 'domain',
                label: domain,
                metadata: { domain },
                availableActions: ENTITY_ACTIONS.domain,
                riskLevel: 'medium',
            });
            if (toolNodeId) {
                links.push({ id: `tl-dm-${toolDef!.name}-${slugify(domain)}`, source: toolNodeId, target: domId, type: 'discovered' });
            }
        }

        // Endpoints / URLs
        for (const url of extractUrls(cmd)) {
            const epId = `endpoint-${slugify(url)}`;
            if (seenEndpoints.has(epId)) continue;
            seenEndpoints.add(epId);
            const short = url.length > 55 ? url.slice(0, 52) + '…' : url;
            addEntity({
                id: epId,
                type: 'endpoint',
                label: short,
                metadata: { url },
                availableActions: ENTITY_ACTIONS.endpoint,
                riskLevel: 'medium',
            });
        }
    }

    // ── Search logs → additional domain discovery ─────────────────────────────
    for (const log of input.searchLogs) {
        for (const domain of extractDomains(log.query + ' ' + log.result.slice(0, 500))) {
            if (seenDomains.has(domain)) continue;
            seenDomains.add(domain);
            const domId = `domain-${slugify(domain)}`;
            addEntity({
                id: domId,
                type: 'domain',
                label: domain,
                metadata: { domain, discoveredVia: 'search', engine: log.engine },
                availableActions: ENTITY_ACTIONS.domain,
                riskLevel: 'low',
            });
        }
    }

    assignPositions(entities);

    return {
        version: 1,
        flowId: input.flowId,
        updatedAt: new Date(),
        entities,
        links,
    };
}
