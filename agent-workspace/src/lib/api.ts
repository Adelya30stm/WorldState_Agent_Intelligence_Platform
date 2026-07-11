const BASE = '/api/v1';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...opts?.headers },
        ...opts,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const json = await res.json();
    return (json.data ?? json) as T;
}

export const api = {
    flows: () => req<Flow[]>('/flows/'),
    worldState: (flowId: string) => req<WorldStateResponse>(`/flows/${flowId}/worldstate`),
    exec: (flowId: string, command: string) =>
        req<ExecResult>(`/flows/${flowId}/exec/`, { method: 'POST', body: JSON.stringify({ command }) }),
    nextstep: (flowId: string) => req<NextStepResponse>(`/flows/${flowId}/nextstep/`),
};

export const GQL_ENDPOINT = '/api/v1/graphql';
export const WS_ENDPOINT = typeof window !== 'undefined'
    ? `wss://${window.location.host}/api/v1/graphql`
    : 'wss://localhost:8443/api/v1/graphql';

// Types
export interface Flow {
    id: string;
    title: string;
    status: 'created' | 'waiting' | 'running' | 'finished' | 'failed';
    createdAt: string;
    providerName: string;
}

export interface WorldStateEntity {
    id: string;
    type: string;
    label: string;
    riskLevel: string;
    metadata: Record<string, string>;
}

export interface WorldStateLink {
    id: string;
    source: string;
    target: string;
    label?: string;
    type: string;
}

export interface WorldStateResponse {
    entities: WorldStateEntity[];
    links: WorldStateLink[];
    flowId: number;
}

export interface ExecResult {
    flowId: number;
    container: string;
    command: string;
    output: string;
    exitCode: number;
}

export interface NextStepRec {
    step: string;
    rationale: string;
    priority: string;
    phase: string;
    command: string;
}

export interface NextStepResponse {
    flowId: number;
    currentPhase: string;
    summary: string;
    recommendations: NextStepRec[];
    caution: string;
}
