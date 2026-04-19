// ─────────────────────────────────────────────────────────────────────────────
// World State — Core types
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType = 'flow' | 'task' | 'subtask' | 'command' | 'domain' | 'endpoint' | 'tool' | 'finding';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type LinkType = 'contains' | 'ran' | 'discovered' | 'depends' | 'references';

export type EntityAction =
    | 'safe-probe'
    | 'deep-scan'
    | 'enumerate-endpoints'
    | 'compare'
    | 'mark-high-priority'
    | 'add-note'
    | 'create-subflow';

export interface WorldStateEntity {
    id: string;
    type: EntityType;
    label: string;
    status?: string;
    metadata: Record<string, string | number | boolean | null>;
    availableActions: EntityAction[];
    riskLevel: RiskLevel;
    position?: { x: number; y: number };
    note?: string;
    highPriority?: boolean;
}

export interface WorldStateLink {
    id: string;
    source: string;
    target: string;
    label?: string;
    type: LinkType;
}

export interface WorldState {
    version: number;
    flowId: string;
    updatedAt: Date;
    entities: WorldStateEntity[];
    links: WorldStateLink[];
}

// ─── Labels & metadata ────────────────────────────────────────────────────────

export const ACTION_LABELS: Record<EntityAction, string> = {
    'safe-probe': 'Safe Probe',
    'deep-scan': 'Deep Scan',
    'enumerate-endpoints': 'Enumerate Endpoints',
    'compare': 'Compare',
    'mark-high-priority': 'Mark High Priority',
    'add-note': 'Add Note',
    'create-subflow': 'Create Subflow',
};

export const ACTION_RISKY: Record<EntityAction, boolean> = {
    'safe-probe': false,
    'deep-scan': true,
    'enumerate-endpoints': true,
    'compare': false,
    'mark-high-priority': false,
    'add-note': false,
    'create-subflow': false,
};

export const ACTION_ICONS: Record<EntityAction, string> = {
    'safe-probe': '🔍',
    'deep-scan': '⚡',
    'enumerate-endpoints': '📡',
    'compare': '⚖️',
    'mark-high-priority': '🚨',
    'add-note': '📝',
    'create-subflow': '🔀',
};

export const ENTITY_ACTIONS: Record<EntityType, EntityAction[]> = {
    flow: ['add-note'],
    task: ['add-note', 'create-subflow'],
    subtask: ['add-note'],
    command: ['safe-probe', 'add-note'],
    domain: ['safe-probe', 'deep-scan', 'enumerate-endpoints', 'mark-high-priority', 'add-note', 'create-subflow'],
    endpoint: ['safe-probe', 'deep-scan', 'mark-high-priority', 'add-note', 'create-subflow'],
    tool: ['add-note'],
    finding: ['mark-high-priority', 'add-note', 'create-subflow'],
};

export const ENTITY_COLORS: Record<EntityType, string> = {
    flow: '#3a78c4',
    task: '#7c3aed',
    subtask: '#a78bfa',
    command: '#64748b',
    domain: '#0891b2',
    endpoint: '#0d9488',
    tool: '#d97706',
    finding: '#dc2626',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    flow: 'Flow',
    task: 'Task',
    subtask: 'Subtask',
    command: 'Command',
    domain: 'Domain / Host',
    endpoint: 'Endpoint',
    tool: 'Tool',
    finding: 'Finding',
};

export const RISK_BADGE: Record<RiskLevel, { label: string; cls: string }> = {
    none: { label: 'None', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    low: { label: 'Low', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
    medium: { label: 'Medium', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
    high: { label: 'High', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
    critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
};

export const GRAPH_MODES = ['execution', 'target', 'compliance', 'threat-model'] as const;
export type GraphMode = (typeof GRAPH_MODES)[number];

export const GRAPH_MODE_LABELS: Record<GraphMode, string> = {
    execution: 'Execution',
    target: 'Target',
    compliance: 'Compliance',
    'threat-model': 'Threat Model',
};

// Which entity types are shown in each graph mode
export const GRAPH_MODE_ENTITIES: Record<GraphMode, EntityType[]> = {
    execution: ['flow', 'task', 'subtask', 'tool', 'command'],
    target: ['domain', 'endpoint', 'tool', 'finding'],
    compliance: ['flow', 'task', 'domain', 'endpoint', 'finding'],
    'threat-model': ['domain', 'endpoint', 'finding', 'tool'],
};
