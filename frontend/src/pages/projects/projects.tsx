import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Clock,
    FileText,
    GitFork,
    Globe,
    Map,
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
}

const PENTEST_PHASES: PentestPhase[] = [
    {
        description: 'Define scope, objectives, rules of engagement, and threat model.',
        icon: <Target className="size-5" />,
        id: 'planning',
        number: 1,
        status: 'pending',
        tasks: ['Scope definition', 'Rules of engagement', 'Threat modeling', 'Asset inventory'],
        title: 'Planning',
    },
    {
        description: 'Passive and active information gathering: DNS, WHOIS, tech stack, subdomains.',
        icon: <Search className="size-5" />,
        id: 'recon',
        number: 2,
        status: 'pending',
        tasks: ['DNS enumeration', 'Subdomain discovery', 'WHOIS / ASN lookup', 'Technology fingerprinting'],
        title: 'Recon',
    },
    {
        description: 'Map application structure, endpoints, authentication flows, and data flows.',
        icon: <Map className="size-5" />,
        id: 'mapping',
        number: 3,
        status: 'pending',
        tasks: ['Endpoint crawling', 'Auth flow analysis', 'API surface mapping', 'Data flow diagram'],
        title: 'Mapping 🔥',
    },
    {
        description: 'Test for OWASP Top 10, business logic flaws, and injection vulnerabilities.',
        icon: <ShieldAlert className="size-5" />,
        id: 'testing',
        number: 4,
        status: 'pending',
        tasks: ['OWASP Top 10', 'Auth bypass', 'Injection (SQLi, XSS, SSTI)', 'Business logic'],
        title: 'Testing',
    },
    {
        description: 'Validate findings, confirm exploitability, rule out false positives.',
        icon: <CheckCircle2 className="size-5" />,
        id: 'validation',
        number: 5,
        status: 'pending',
        tasks: ['PoC creation', 'False positive triage', 'Severity rating (CVSS)', 'Impact assessment'],
        title: 'Validation',
    },
    {
        description: 'Chain vulnerabilities to build end-to-end attack paths from entry to target.',
        icon: <Route className="size-5" />,
        id: 'attack-paths',
        number: 6,
        status: 'pending',
        tasks: ['Lateral movement chains', 'Privilege escalation paths', 'Kill chain mapping', 'MITRE ATT&CK mapping'],
        title: 'Attack Paths',
    },
    {
        description: 'Generate structured pentest report with findings, evidence, and remediation.',
        icon: <FileText className="size-5" />,
        id: 'reporting',
        number: 7,
        status: 'pending',
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

const WebPentest = () => {
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
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                            <Globe className="size-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Web Application Pentest</h1>
                            <p className="text-sm text-muted-foreground">7-phase methodology · OWASP-aligned</p>
                        </div>
                    </div>
                    <Button
                        asChild
                        className="gap-2"
                        size="sm"
                    >
                        <Link to="/flows/new">
                            <GitFork className="size-4" />
                            Start new flow
                        </Link>
                    </Button>
                </div>

                {/* Phase progress bar */}
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {PENTEST_PHASES.map((phase) => (
                        <div
                            className={`flex-1 transition-colors ${
                                phase.status === 'done'
                                    ? 'bg-green-500'
                                    : phase.status === 'active'
                                      ? 'bg-blue-500'
                                      : 'bg-transparent'
                            } ${phase.number < PENTEST_PHASES.length ? 'border-r border-background' : ''}`}
                            key={phase.id}
                            title={phase.title}
                        />
                    ))}
                </div>

                {/* Phase cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {PENTEST_PHASES.map((phase) => (
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
                        { icon: <AlertTriangle className="size-4" />, label: 'Critical Findings', value: '—' },
                        { icon: <ShieldAlert className="size-4" />, label: 'Total Findings', value: '—' },
                        { icon: <Globe className="size-4" />, label: 'Endpoints Mapped', value: '—' },
                        { icon: <Route className="size-4" />, label: 'Attack Paths', value: '—' },
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
