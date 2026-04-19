import { useEffect, useState } from 'react';

import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Clock,
    FileText,
    GitFork,
    Globe,
    Map,
    RefreshCw,
    Route,
    Search,
    ShieldAlert,
    Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

type PhaseStatus = 'pending' | 'active' | 'done';

interface PentestPhase {
    id: string;
    number: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    status: PhaseStatus;
    tasks: string[];
    msgCount?: number;
}

// Backend phase IDs → map to our status string
const backendStatusMap: Record<string, PhaseStatus> = {
    pending: 'pending',
    'in-progress': 'active',
    completed: 'done',
};

const PHASE_METADATA: Omit<PentestPhase, 'status' | 'msgCount'>[] = [
    {
        description: 'Define scope, objectives, rules of engagement, and threat model.',
        icon: <Target className="size-5" />,
        id: 'planning',
        number: 1,
        tasks: ['Scope definition', 'Rules of engagement', 'Threat modeling', 'Asset inventory'],
        title: 'Planning',
    },
    {
        description: 'Passive and active information gathering: DNS, WHOIS, tech stack, subdomains.',
        icon: <Search className="size-5" />,
        id: 'recon',
        number: 2,
        tasks: ['DNS enumeration', 'Subdomain discovery', 'WHOIS / ASN lookup', 'Technology fingerprinting'],
        title: 'Recon',
    },
    {
        description: 'Map application structure, endpoints, authentication flows, and data flows.',
        icon: <Map className="size-5" />,
        id: 'mapping',
        number: 3,
        tasks: ['Endpoint crawling', 'Auth flow analysis', 'API surface mapping', 'Data flow diagram'],
        title: 'Mapping 🔥',
    },
    {
        description: 'Test for OWASP Top 10, business logic flaws, and injection vulnerabilities.',
        icon: <ShieldAlert className="size-5" />,
        id: 'testing',
        number: 4,
        tasks: ['OWASP Top 10', 'Auth bypass', 'Injection (SQLi, XSS, SSTI)', 'Business logic'],
        title: 'Testing',
    },
    {
        description: 'Validate findings, confirm exploitability, rule out false positives.',
        icon: <CheckCircle2 className="size-5" />,
        id: 'validation',
        number: 5,
        tasks: ['PoC creation', 'False positive triage', 'Severity rating (CVSS)', 'Impact assessment'],
        title: 'Validation',
    },
    {
        description: 'Chain vulnerabilities to build end-to-end attack paths from entry to target.',
        icon: <Route className="size-5" />,
        id: 'attack-paths',
        number: 6,
        tasks: ['Lateral movement chains', 'Privilege escalation paths', 'Kill chain mapping', 'MITRE ATT&CK mapping'],
        title: 'Attack Paths',
    },
    {
        description: 'Generate structured pentest report with findings, evidence, and remediation.',
        icon: <FileText className="size-5" />,
        id: 'reporting',
        number: 7,
        tasks: ['Executive summary', 'Technical findings', 'Evidence (screenshots/logs)', 'Remediation recommendations'],
        title: 'Reporting',
    },
];

const statusColors: Record<PhaseStatus, string> = {
    active: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    done: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400',
    pending: 'bg-muted/40 border-border',
};

const statusBadge: Record<PhaseStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    active: { label: 'In Progress', variant: 'default' },
    done: { label: 'Done', variant: 'secondary' },
    pending: { label: 'Pending', variant: 'outline' },
};

interface BackendPhase {
    id: string;
    status: string;
    msg_count: number;
}

interface BackendStats {
    total_findings: number;
    critical_findings: number;
    endpoints: number;
    attack_paths: number;
}

interface PhasesResponse {
    flow_id: number;
    phases: BackendPhase[];
    stats: BackendStats;
}

interface FlowOption {
    id: number;
    title: string;
}

const WebPentest = () => {
    const [phases, setPhases] = useState<PentestPhase[]>(
        PHASE_METADATA.map((p) => ({ ...p, status: 'pending' as PhaseStatus })),
    );
    const [stats, setStats] = useState<BackendStats | null>(null);
    const [flows, setFlows] = useState<FlowOption[]>([]);
    const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load available flows on mount
    useEffect(() => {
        fetch('/api/v1/flows/')
            .then((r) => r.json())
            .then((data) => {
                const list: FlowOption[] = (data?.flows ?? []).map((f: { id: number; title?: string }) => ({
                    id: f.id,
                    title: f.title || `Flow #${f.id}`,
                }));
                setFlows(list);
                if (list.length > 0) {
                    setSelectedFlowId(list[0].id);
                }
            })
            .catch(() => {
                /* no flows or not authenticated — silent */
            });
    }, []);

    // Load phase data when flow is selected
    useEffect(() => {
        if (selectedFlowId == null) return;
        setLoading(true);
        setError(null);
        fetch(`/api/v1/web-pentest/phases/${selectedFlowId}`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json() as Promise<{ data: PhasesResponse }>;
            })
            .then(({ data }) => {
                const phaseMap = new Map(data.phases.map((p) => [p.id, p]));
                setPhases(
                    PHASE_METADATA.map((meta) => {
                        const bp = phaseMap.get(meta.id);
                        return {
                            ...meta,
                            msgCount: bp?.msg_count ?? 0,
                            status: bp ? (backendStatusMap[bp.status] ?? 'pending') : 'pending',
                        };
                    }),
                );
                setStats(data.stats);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [selectedFlowId]);

    const doneCount = phases.filter((p) => p.status === 'done').length;

    return (
        <>
            <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    className="mr-2 h-4"
                    orientation="vertical"
                />
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbPage>Web Pentest</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </header>

            <div className="flex flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                            <Globe className="size-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Web Application Pentest</h1>
                            <p className="text-sm text-muted-foreground">7-phase methodology · OWASP-aligned</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {flows.length > 0 && (
                            <select
                                className="rounded-md border bg-background px-3 py-1.5 text-sm"
                                value={selectedFlowId ?? ''}
                                onChange={(e) => setSelectedFlowId(Number(e.target.value))}
                            >
                                {flows.map((f) => (
                                    <option
                                        key={f.id}
                                        value={f.id}
                                    >
                                        {f.title}
                                    </option>
                                ))}
                            </select>
                        )}
                        {selectedFlowId != null && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={loading}
                                onClick={() => setSelectedFlowId((id) => id)} // re-trigger effect
                            >
                                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        )}
                        <Button
                            asChild
                            className="gap-2"
                            size="sm"
                        >
                            <Link to="/flows/new">
                                <GitFork className="size-4" />
                                New flow
                            </Link>
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {/* Phase progress bar */}
                <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>
                            {doneCount}/{phases.length} phases
                        </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                        {phases.map((phase) => (
                            <div
                                className={`flex-1 transition-colors ${
                                    phase.status === 'done'
                                        ? 'bg-green-500'
                                        : phase.status === 'active'
                                          ? 'bg-blue-500'
                                          : 'bg-transparent'
                                } ${phase.number < phases.length ? 'border-r border-background' : ''}`}
                                key={phase.id}
                                title={phase.title}
                            />
                        ))}
                    </div>
                </div>

                {/* Phase cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {phases.map((phase) => (
                        <Card
                            className={`border transition-shadow hover:shadow-md ${statusColors[phase.status]}`}
                            key={phase.id}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="flex size-7 items-center justify-center rounded-md bg-background/60 text-xs font-bold text-muted-foreground">
                                            {phase.number}
                                        </span>
                                        <div className="text-foreground">{phase.icon}</div>
                                    </div>
                                    <Badge variant={statusBadge[phase.status].variant}>
                                        <Clock className="mr-1 size-3" />
                                        {statusBadge[phase.status].label}
                                    </Badge>
                                </div>
                                <CardTitle className="mt-2 text-base">{phase.title}</CardTitle>
                                <p className="text-xs text-muted-foreground">{phase.description}</p>
                                {phase.msgCount != null && phase.msgCount > 0 && (
                                    <p className="text-xs text-muted-foreground/70">{phase.msgCount} messages</p>
                                )}
                            </CardHeader>
                            <CardContent className="pt-0">
                                <ul className="space-y-1">
                                    {phase.tasks.map((task) => (
                                        <li
                                            className="flex items-center gap-2 text-xs text-muted-foreground"
                                            key={task}
                                        >
                                            <ChevronRight className="size-3 shrink-0" />
                                            {task}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                        {
                            icon: <AlertTriangle className="size-4" />,
                            label: 'Critical Findings',
                            value: stats ? String(stats.critical_findings) : '—',
                        },
                        {
                            icon: <ShieldAlert className="size-4" />,
                            label: 'Total Findings',
                            value: stats ? String(stats.total_findings) : '—',
                        },
                        {
                            icon: <Globe className="size-4" />,
                            label: 'Endpoints Mapped',
                            value: stats ? String(stats.endpoints) : '—',
                        },
                        {
                            icon: <Route className="size-4" />,
                            label: 'Attack Paths',
                            value: stats ? String(stats.attack_paths) : '—',
                        },
                    ].map((stat) => (
                        <Card key={stat.label}>
                            <CardContent className="flex items-center gap-3 pt-4">
                                <div className="text-muted-foreground">{stat.icon}</div>
                                <div>
                                    <div className="text-xl font-bold">{stat.value}</div>
                                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
};

export default WebPentest;
