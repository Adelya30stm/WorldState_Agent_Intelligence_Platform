import { useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    ChevronDown,
    ChevronRight,
    Copy,
    FileText,
    Lock,
    Play,
    Plus,
    Server,
    Shield,
    Target,
    Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

// ── Types ──────────────────────────────────────────────────────────────

type EngagementModel = 'blackbox' | 'greybox' | 'whitebox';

interface ScopeItem {
    id: string;
    value: string;
    assetType: string;
    environment: string;
    exposure: string;
    criticality: string;
    owner: string;
    notes: string;
}

interface AssetItem {
    id: string;
    name: string;
    type: string;
    identifier: string;
    environment: string;
    owner: string;
    dataClass: string;
    criticality: string;
    inScope: boolean;
    notes: string;
}

interface PlanState {
    name: string;
    client: string;
    assessmentType: string;
    engagementModel: EngagementModel;
    startDate: string;
    endDate: string;
    primaryContact: string;
    emergencyContact: string;
    testingWindow: string;
    allowedCategories: string[];
    prohibitedActivities: string[];
    rateLimit: string;
    sensitiveExclusions: string;
    stopConditions: string;
    escalationProcess: string;
    evidenceHandling: string;
    dataHandling: string;
    reportingExpectations: string;
    frameworks: string[];
    businessCriticalAssets: string;
    highRiskRoles: string;
    trustBoundaries: string;
    authFlows: string;
    externalIntegrations: string;
    sensitiveDataTypes: string;
    knownConcerns: string;
    assumptions: string;
    constraints: string;
    credAccounts: string;
    credRoles: string;
    credAccessLimits: string;
    credMFA: boolean;
    credVPN: boolean;
    credArchDocs: boolean;
    credAPIDoc: boolean;
    credSourceCode: boolean;
    credCloudAccess: boolean;
    credNetworkDiagrams: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────

const ASSESSMENT_TYPES = [
    'Web Application Pentest',
    'Network Pentest',
    'Cloud Security Assessment',
    'API Security Assessment',
    'Mobile App Assessment',
    'External Attack Surface Review',
    'Internal Security Assessment',
];

const SCOPE_ASSET_TYPES = [
    'Domain', 'Subdomain', 'IP Address', 'CIDR Range',
    'Web Application URL', 'API Endpoint', 'Cloud Account',
    'Kubernetes Cluster', 'Mobile Application', 'Repository',
    'Third-party Integration',
];

const ENVIRONMENTS = ['Production', 'Staging', 'Development', 'Test'];
const EXPOSURES = ['External', 'Internal', 'VPN-only'];
const CRITICALITIES = ['Low', 'Medium', 'High', 'Critical'];
const DATA_CLASSIFICATIONS = ['Public', 'Internal', 'Confidential', 'Restricted'];

const TESTING_WINDOWS = [
    'Business hours only (Mon–Fri 09:00–18:00)',
    'After-hours only (Mon–Fri 18:00–09:00)',
    '24/7 allowed',
    'Custom schedule',
];

const ALLOWED_CATEGORIES = [
    'Reconnaissance',
    'Vulnerability validation',
    'Authenticated testing',
    'API testing',
    'Cloud configuration review',
    'Source-assisted review',
];

const PROHIBITED_ACTIVITIES = [
    'Denial of Service',
    'Phishing',
    'Social engineering',
    'Malware deployment',
    'Persistence',
    'Lateral movement',
    'Data exfiltration',
    'Destructive actions',
];

const THREAT_FRAMEWORKS = [
    'STRIDE', 'MITRE ATT&CK mapping', 'OWASP Top 10',
    'OWASP API Top 10', 'Cloud threat model', 'Custom model',
];

const ASSET_TYPES_INVENTORY = [
    'Web Application', 'API', 'Server', 'Database',
    'Cloud Resource', 'Container / Kubernetes', 'Identity Provider',
    'CI/CD System', 'Repository', 'Third-party Service',
];

const PRESETS: Record<string, Partial<PlanState>> = {
    'Web App Pentest': {
        assessmentType: 'Web Application Pentest', engagementModel: 'greybox',
        testingWindow: TESTING_WINDOWS[0],
        allowedCategories: ['Reconnaissance', 'Vulnerability validation', 'Authenticated testing', 'API testing'],
        prohibitedActivities: ['Denial of Service', 'Phishing', 'Social engineering', 'Data exfiltration'],
        frameworks: ['OWASP Top 10', 'STRIDE'],
    },
    'API Pentest': {
        assessmentType: 'API Security Assessment', engagementModel: 'greybox',
        testingWindow: TESTING_WINDOWS[0],
        allowedCategories: ['Reconnaissance', 'Vulnerability validation', 'Authenticated testing', 'API testing'],
        prohibitedActivities: ['Denial of Service', 'Data exfiltration', 'Destructive actions'],
        frameworks: ['OWASP API Top 10', 'STRIDE'],
    },
    'Cloud Assessment': {
        assessmentType: 'Cloud Security Assessment', engagementModel: 'whitebox',
        testingWindow: TESTING_WINDOWS[2],
        allowedCategories: ['Reconnaissance', 'Cloud configuration review', 'Source-assisted review'],
        prohibitedActivities: ['Denial of Service', 'Data exfiltration', 'Destructive actions', 'Persistence'],
        frameworks: ['Cloud threat model', 'MITRE ATT&CK mapping'],
    },
    'External ASR': {
        assessmentType: 'External Attack Surface Review', engagementModel: 'blackbox',
        testingWindow: TESTING_WINDOWS[2],
        allowedCategories: ['Reconnaissance', 'Vulnerability validation'],
        prohibitedActivities: ['Denial of Service', 'Phishing', 'Social engineering', 'Malware deployment', 'Persistence', 'Lateral movement', 'Data exfiltration', 'Destructive actions'],
        frameworks: ['MITRE ATT&CK mapping', 'OWASP Top 10'],
    },
    'Internal Network': {
        assessmentType: 'Internal Security Assessment', engagementModel: 'greybox',
        testingWindow: TESTING_WINDOWS[0],
        allowedCategories: ['Reconnaissance', 'Vulnerability validation', 'Authenticated testing'],
        prohibitedActivities: ['Denial of Service', 'Phishing', 'Data exfiltration', 'Destructive actions'],
        frameworks: ['MITRE ATT&CK mapping', 'STRIDE'],
    },
};

const defaultPlan: PlanState = {
    name: '', client: '', assessmentType: ASSESSMENT_TYPES[0], engagementModel: 'greybox',
    startDate: '', endDate: '', primaryContact: '', emergencyContact: '',
    testingWindow: TESTING_WINDOWS[0],
    allowedCategories: ['Reconnaissance', 'Vulnerability validation'],
    prohibitedActivities: ['Denial of Service', 'Phishing', 'Social engineering', 'Data exfiltration'],
    rateLimit: '', sensitiveExclusions: '', stopConditions: '',
    escalationProcess: '', evidenceHandling: '', dataHandling: '', reportingExpectations: '',
    frameworks: ['OWASP Top 10', 'STRIDE'],
    businessCriticalAssets: '', highRiskRoles: '', trustBoundaries: '',
    authFlows: '', externalIntegrations: '', sensitiveDataTypes: '',
    knownConcerns: '', assumptions: '', constraints: '',
    credAccounts: '', credRoles: '', credAccessLimits: '',
    credMFA: false, credVPN: false, credArchDocs: false,
    credAPIDoc: false, credSourceCode: false, credCloudAccess: false, credNetworkDiagrams: false,
};

// ── Helpers ────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);
const pct = (n: number, d: number) => Math.round((n / d) * 100);

const critCls = (c: string) =>
    c === 'Critical' ? 'border-red-300 bg-red-50 text-red-700'
    : c === 'High'   ? 'border-orange-300 bg-orange-50 text-orange-700'
    : c === 'Medium' ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
    :                  'border-border bg-background';

// ── Primitive UI ───────────────────────────────────────────────────────

const FL = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
    <label className="text-[11px] font-medium text-muted-foreground">
        {children}{req && <span className="ml-0.5 text-red-500">*</span>}
    </label>
);

const TA = ({ placeholder, value, onChange, rows = 2 }: { placeholder?: string; value: string; onChange: (v: string) => void; rows?: number }) => (
    <textarea
        className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
    />
);

const CheckGrid = ({ options, selected, onChange, cols = 2 }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; cols?: number }) => (
    <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((opt) => {
            const on = selected.includes(opt);
            return (
                <label className={`flex cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${on ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-border hover:bg-muted/50'}`} key={opt}>
                    <input checked={on} className="sr-only" type="checkbox" onChange={(e) => onChange(e.target.checked ? [...selected, opt] : selected.filter((s) => s !== opt))} />
                    <span className={`flex size-3.5 shrink-0 items-center justify-center rounded border ${on ? 'border-blue-500 bg-blue-500' : 'border-border bg-background'}`}>
                        {on && <svg className="size-2.5" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" /></svg>}
                    </span>
                    {opt}
                </label>
            );
        })}
    </div>
);

const RadioGroup = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
            <label className={`flex cursor-pointer select-none items-center gap-2.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${value === opt ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-border hover:bg-muted/50'}`} key={opt}>
                <input checked={value === opt} className="sr-only" type="radio" onChange={() => onChange(opt)} />
                <span className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border-2 ${value === opt ? 'border-blue-500' : 'border-muted-foreground/40'}`}>
                    {value === opt && <span className="size-1.5 rounded-full bg-blue-500" />}
                </span>
                {opt}
            </label>
        ))}
    </div>
);

const SectionHdr = ({ icon, title, subtitle, progress, open, onToggle }: {
    icon: React.ReactNode; title: string; subtitle?: string;
    progress: number; open: boolean; onToggle: () => void;
}) => (
    <button className="flex w-full items-center gap-3 py-2 text-left" type="button" onClick={onToggle}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{icon}</div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{title}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${progress === 100 ? 'bg-green-50 text-green-600' : progress > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-muted text-muted-foreground'}`}>
                    {progress === 100 ? 'Complete' : progress > 0 ? `${progress}%` : 'Not started'}
                </span>
            </div>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <Progress className="h-1.5 w-16 shrink-0" value={progress} />
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
    </button>
);

// ── Scope builder ──────────────────────────────────────────────────────

const ScopeBuilder = ({ items, onChange }: { items: ScopeItem[]; onChange: (items: ScopeItem[]) => void }) => {
    const add = () => onChange([...items, { id: uid(), value: '', assetType: SCOPE_ASSET_TYPES[0], environment: ENVIRONMENTS[0], exposure: EXPOSURES[0], criticality: CRITICALITIES[2], owner: '', notes: '' }]);
    const upd = (id: string, f: keyof ScopeItem, v: string) => onChange(items.map((it) => it.id === id ? { ...it, [f]: v } : it));
    const del = (id: string) => onChange(items.filter((it) => it.id !== id));

    return (
        <div className="flex flex-col gap-2">
            {items.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                            <tr className="border-b text-left text-muted-foreground">
                                {['Asset value', 'Type', 'Environment', 'Exposure', 'Criticality', 'Owner', 'Notes', ''].map((h) => (
                                    <th className="whitespace-nowrap px-2 py-2 font-medium" key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it) => (
                                <tr className="border-b last:border-0 hover:bg-muted/20" key={it.id}>
                                    <td className="min-w-[130px] px-2 py-1.5"><input className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" placeholder="example.com" value={it.value} onChange={(e) => upd(it.id, 'value', e.target.value)} /></td>
                                    <td className="min-w-[120px] px-2 py-1.5"><select className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none" value={it.assetType} onChange={(e) => upd(it.id, 'assetType', e.target.value)}>{SCOPE_ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[95px] px-2 py-1.5"><select className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none" value={it.environment} onChange={(e) => upd(it.id, 'environment', e.target.value)}>{ENVIRONMENTS.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[85px] px-2 py-1.5"><select className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none" value={it.exposure} onChange={(e) => upd(it.id, 'exposure', e.target.value)}>{EXPOSURES.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[85px] px-2 py-1.5"><select className={`w-full rounded border px-1.5 py-1 text-xs focus:outline-none ${critCls(it.criticality)}`} value={it.criticality} onChange={(e) => upd(it.id, 'criticality', e.target.value)}>{CRITICALITIES.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[80px] px-2 py-1.5"><input className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" placeholder="team" value={it.owner} onChange={(e) => upd(it.id, 'owner', e.target.value)} /></td>
                                    <td className="min-w-[100px] px-2 py-1.5"><input className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" placeholder="optional" value={it.notes} onChange={(e) => upd(it.id, 'notes', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><button className="text-muted-foreground transition-colors hover:text-red-500" type="button" onClick={() => del(it.id)}><Trash2 className="size-3.5" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Button className="w-fit gap-1.5" size="sm" type="button" variant="outline" onClick={add}><Plus className="size-3.5" />Add scope item</Button>
        </div>
    );
};

// ── Asset builder ──────────────────────────────────────────────────────

const AssetBuilder = ({ items, onChange }: { items: AssetItem[]; onChange: (items: AssetItem[]) => void }) => {
    const add = () => onChange([...items, { id: uid(), name: '', type: ASSET_TYPES_INVENTORY[0], identifier: '', environment: ENVIRONMENTS[0], owner: '', dataClass: DATA_CLASSIFICATIONS[1], criticality: CRITICALITIES[2], inScope: true, notes: '' }]);
    const upd = <K extends keyof AssetItem>(id: string, f: K, v: AssetItem[K]) => onChange(items.map((it) => it.id === id ? { ...it, [f]: v } : it));
    const del = (id: string) => onChange(items.filter((it) => it.id !== id));

    return (
        <div className="flex flex-col gap-2">
            {items.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                            <tr className="border-b text-left text-muted-foreground">
                                {['Name', 'Type', 'Identifier / URL / IP', 'Env', 'Criticality', 'Data class', 'Owner', '✓', 'Notes', ''].map((h) => (
                                    <th className="whitespace-nowrap px-2 py-2 font-medium" key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it) => (
                                <tr className="border-b last:border-0 hover:bg-muted/20" key={it.id}>
                                    <td className="min-w-[90px] px-2 py-1.5"><input className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Asset name" value={it.name} onChange={(e) => upd(it.id, 'name', e.target.value)} /></td>
                                    <td className="min-w-[115px] px-2 py-1.5"><select className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none" value={it.type} onChange={(e) => upd(it.id, 'type', e.target.value)}>{ASSET_TYPES_INVENTORY.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[140px] px-2 py-1.5"><input className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" placeholder="https://... or 10.0.0.1" value={it.identifier} onChange={(e) => upd(it.id, 'identifier', e.target.value)} /></td>
                                    <td className="min-w-[85px] px-2 py-1.5"><select className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none" value={it.environment} onChange={(e) => upd(it.id, 'environment', e.target.value)}>{ENVIRONMENTS.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[85px] px-2 py-1.5"><select className={`w-full rounded border px-1.5 py-1 text-xs focus:outline-none ${critCls(it.criticality)}`} value={it.criticality} onChange={(e) => upd(it.id, 'criticality', e.target.value)}>{CRITICALITIES.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[85px] px-2 py-1.5"><select className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none" value={it.dataClass} onChange={(e) => upd(it.id, 'dataClass', e.target.value)}>{DATA_CLASSIFICATIONS.map((t) => <option key={t}>{t}</option>)}</select></td>
                                    <td className="min-w-[75px] px-2 py-1.5"><input className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" placeholder="team" value={it.owner} onChange={(e) => upd(it.id, 'owner', e.target.value)} /></td>
                                    <td className="px-2 py-1.5 text-center"><input checked={it.inScope} className="size-3.5 cursor-pointer rounded accent-blue-600" type="checkbox" onChange={(e) => upd(it.id, 'inScope', e.target.checked)} /></td>
                                    <td className="min-w-[90px] px-2 py-1.5"><input className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none" placeholder="optional" value={it.notes} onChange={(e) => upd(it.id, 'notes', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><button className="text-muted-foreground transition-colors hover:text-red-500" type="button" onClick={() => del(it.id)}><Trash2 className="size-3.5" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Button className="w-fit gap-1.5" size="sm" type="button" variant="outline" onClick={add}><Plus className="size-3.5" />Add asset</Button>
        </div>
    );
};

// ── Main exported component ────────────────────────────────────────────

export const PlanningPhaseForm = ({ onBack }: { onBack: () => void }) => {
    const navigate = useNavigate();
    const [plan, setPlan] = useState<PlanState>(defaultPlan);
    const [scope, setScope] = useState<ScopeItem[]>([]);
    const [assets, setAssets] = useState<AssetItem[]>([]);
    const [open, setOpen] = useState<Record<string, boolean>>({ overview: true, scope: false, roe: false, threat: false, inventory: false, creds: false });
    const [copied, setCopied] = useState(false);

    const set = <K extends keyof PlanState>(k: K, v: PlanState[K]) => setPlan((p) => ({ ...p, [k]: v }));
    const tog = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
    const preset = (name: string) => { const p = PRESETS[name]; if (p) setPlan((s) => ({ ...s, ...p })); };

    // progress
    const ovP = pct([plan.name, plan.client, plan.assessmentType, plan.startDate, plan.endDate, plan.primaryContact].filter(Boolean).length, 6);
    const scP = scope.length === 0 ? 0 : scope.every((s) => s.value) ? 100 : 50;
    const roeP = pct([plan.testingWindow ? 1 : 0, plan.allowedCategories.length ? 1 : 0, plan.prohibitedActivities.length ? 1 : 0].reduce((a, b) => a + b, 0), 3);
    const thP = pct((plan.frameworks.length ? 1 : 0) + (plan.businessCriticalAssets ? 1 : 0) + (plan.trustBoundaries ? 1 : 0), 3);
    const invP = assets.length > 0 ? 100 : 0;
    const crP = plan.engagementModel === 'blackbox' ? 100
        : plan.engagementModel === 'greybox' ? pct([plan.credAccounts, plan.credRoles].filter(Boolean).length, 2)
        : pct([plan.credArchDocs, plan.credAPIDoc, plan.credSourceCode, plan.credCloudAccess].filter(Boolean).length, 4);
    const total = Math.round((ovP + scP + roeP + thP + invP + crP) / 6);

    const buildPrompt = () => {
        const L: string[] = [
            '# PENETRATION TEST ENGAGEMENT PLAN', '',
            '## ENGAGEMENT OVERVIEW',
            `- Engagement: ${plan.name || '(not set)'}`,
            `- Client: ${plan.client || '(not set)'}`,
            `- Assessment Type: ${plan.assessmentType}`,
            `- Engagement Model: ${{ blackbox: 'Black Box', greybox: 'Grey Box', whitebox: 'White Box' }[plan.engagementModel]}`,
            `- Period: ${plan.startDate || '?'} → ${plan.endDate || '?'}`,
            `- Primary Contact: ${plan.primaryContact || '(not set)'}`,
            `- Emergency Contact: ${plan.emergencyContact || '(not set)'}`,
            '', '## SCOPE DEFINITION',
        ];
        if (scope.length > 0) scope.forEach((s, i) => L.push(`${i + 1}. [${s.assetType}] ${s.value}  env:${s.environment}  exposure:${s.exposure}  criticality:${s.criticality}${s.owner ? `  owner:${s.owner}` : ''}${s.notes ? `  — ${s.notes}` : ''}`));
        else L.push('(No scope items defined)');

        L.push('', '## RULES OF ENGAGEMENT', `- Testing window: ${plan.testingWindow}`);
        if (plan.allowedCategories.length) L.push(`- Allowed: ${plan.allowedCategories.join(', ')}`);
        if (plan.prohibitedActivities.length) L.push(`- Prohibited: ${plan.prohibitedActivities.join(', ')}`);
        if (plan.rateLimit) L.push(`- Rate limits: ${plan.rateLimit}`);
        if (plan.sensitiveExclusions) L.push(`- Sensitive exclusions: ${plan.sensitiveExclusions}`);
        if (plan.stopConditions) L.push(`- Stop conditions: ${plan.stopConditions}`);
        if (plan.escalationProcess) L.push(`- Escalation: ${plan.escalationProcess}`);
        if (plan.evidenceHandling) L.push(`- Evidence handling: ${plan.evidenceHandling}`);
        if (plan.dataHandling) L.push(`- Data handling: ${plan.dataHandling}`);
        if (plan.reportingExpectations) L.push(`- Reporting: ${plan.reportingExpectations}`);

        L.push('', '## THREAT MODEL');
        if (plan.frameworks.length) L.push(`- Frameworks: ${plan.frameworks.join(', ')}`);
        const tf: [keyof PlanState, string][] = [['businessCriticalAssets','Business-critical assets'],['highRiskRoles','High-risk roles'],['trustBoundaries','Trust boundaries'],['authFlows','Auth flows'],['externalIntegrations','External integrations'],['sensitiveDataTypes','Sensitive data'],['knownConcerns','Known concerns'],['assumptions','Assumptions'],['constraints','Constraints']];
        tf.forEach(([k, lbl]) => { if (plan[k]) L.push(`- ${lbl}: ${plan[k]}`); });

        if (assets.length > 0) {
            L.push('', '## ASSET INVENTORY');
            assets.forEach((a) => L.push(`- [${a.type}] ${a.name}  id:${a.identifier}  env:${a.environment}  crit:${a.criticality}  class:${a.dataClass}  ${a.inScope ? '[IN SCOPE]' : '[OUT OF SCOPE]'}`));
        }

        L.push('', '## CREDENTIALS & ACCESS');
        if (plan.engagementModel === 'blackbox') {
            L.push('- Black Box: no credentials. Simulates unauthenticated external attacker.');
        } else if (plan.engagementModel === 'greybox') {
            if (plan.credAccounts) L.push(`- Test accounts: ${plan.credAccounts}`);
            if (plan.credRoles) L.push(`- Roles: ${plan.credRoles}`);
            if (plan.credAccessLimits) L.push(`- Access limitations: ${plan.credAccessLimits}`);
            if (plan.credMFA) L.push('- MFA configured');
            if (plan.credVPN) L.push('- VPN required');
        } else {
            if (plan.credAccounts) L.push(`- Full accounts: ${plan.credAccounts}`);
            const docs = [plan.credArchDocs&&'Architecture docs', plan.credAPIDoc&&'API docs', plan.credSourceCode&&'Source code', plan.credCloudAccess&&'Cloud read-only', plan.credNetworkDiagrams&&'Network diagrams'].filter(Boolean).join(', ');
            if (docs) L.push(`- Provided: ${docs}`);
        }
        L.push('', '---', 'Using the above engagement plan, produce a detailed penetration test planning document. Validate scope completeness, identify coverage gaps, and list any missing information that should be resolved before active testing begins.');
        return L.join('\n');
    };

    const handleLaunch = () => navigate(`/flows/new?prompt=${encodeURIComponent(buildPrompt())}`);
    const handleCopy = async () => { await navigator.clipboard.writeText(buildPrompt()); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    return (
        <div className="flex flex-col gap-4">
            {/* Header bar */}
            <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" type="button" onClick={onBack}>
                    <ArrowLeft className="size-3.5" />
                    Back to phases
                </button>
                <div className="h-4 w-px bg-border" />
                <span className="text-sm font-semibold">Planning Phase</span>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Completion</span>
                    <Progress className="h-1.5 w-24" value={total} />
                    <span className="w-7 text-xs font-semibold">{total}%</span>
                </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Quick preset:</span>
                {Object.keys(PRESETS).map((name) => (
                    <button className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-accent" key={name} type="button" onClick={() => preset(name)}>{name}</button>
                ))}
            </div>

            {/* 1. Overview */}
            <Card>
                <CardHeader className="px-4 pb-0 pt-3">
                    <SectionHdr icon={<FileText className="size-3.5" />} open={open.overview} progress={ovP} subtitle="Name, client, assessment type, model, timeline, contacts" title="Engagement Overview" onToggle={() => tog('overview')} />
                </CardHeader>
                {open.overview && (
                    <CardContent className="px-4 pb-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1"><FL req>Engagement name</FL><Input className="h-8 text-xs" placeholder="Q2 2026 Web App Pentest" value={plan.name} onChange={(e) => set('name', e.target.value)} /></div>
                            <div className="flex flex-col gap-1"><FL req>Client / Organization</FL><Input className="h-8 text-xs" placeholder="ACME Corp" value={plan.client} onChange={(e) => set('client', e.target.value)} /></div>
                            <div className="flex flex-col gap-1"><FL req>Assessment type</FL>
                                <select className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" value={plan.assessmentType} onChange={(e) => set('assessmentType', e.target.value)}>
                                    {ASSESSMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1"><FL req>Engagement model</FL>
                                <div className="flex gap-2">
                                    {(['blackbox', 'greybox', 'whitebox'] as EngagementModel[]).map((m) => (
                                        <button className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${plan.engagementModel === m ? m === 'blackbox' ? 'border-slate-400 bg-slate-100 text-slate-800' : m === 'greybox' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' : 'border-green-300 bg-green-50 text-green-800' : 'border-border hover:bg-muted/50'}`} key={m} type="button" onClick={() => set('engagementModel', m)}>
                                            {m === 'blackbox' ? '⬛ Black Box' : m === 'greybox' ? '🔲 Grey Box' : '⬜ White Box'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1"><FL req>Start date</FL><Input className="h-8 text-xs" type="date" value={plan.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
                            <div className="flex flex-col gap-1"><FL req>End date</FL><Input className="h-8 text-xs" type="date" value={plan.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
                            <div className="flex flex-col gap-1"><FL>Primary point of contact</FL><Input className="h-8 text-xs" placeholder="Jane Smith — jane@acme.com" value={plan.primaryContact} onChange={(e) => set('primaryContact', e.target.value)} /></div>
                            <div className="flex flex-col gap-1"><FL>Emergency contact</FL><Input className="h-8 text-xs" placeholder="+1-555-000-0000" value={plan.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} /></div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* 2. Scope */}
            <Card>
                <CardHeader className="px-4 pb-0 pt-3">
                    <SectionHdr icon={<Target className="size-3.5" />} open={open.scope} progress={scP} subtitle="Domains, IPs, CIDRs, URLs, APIs, cloud accounts — env, exposure & criticality" title="Scope Definition" onToggle={() => tog('scope')} />
                </CardHeader>
                {open.scope && <CardContent className="px-4 pb-4 pt-2"><ScopeBuilder items={scope} onChange={setScope} /></CardContent>}
            </Card>

            {/* 3. Rules of Engagement */}
            <Card>
                <CardHeader className="px-4 pb-0 pt-3">
                    <SectionHdr icon={<Shield className="size-3.5" />} open={open.roe} progress={roeP} subtitle="Testing window, allowed/prohibited activities, escalation & evidence handling" title="Rules of Engagement" onToggle={() => tog('roe')} />
                </CardHeader>
                {open.roe && (
                    <CardContent className="px-4 pb-4 pt-2 flex flex-col gap-4">
                        <div><p className="mb-2 text-[11px] font-semibold text-muted-foreground">Testing window</p><RadioGroup options={TESTING_WINDOWS} value={plan.testingWindow} onChange={(v) => set('testingWindow', v)} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><p className="mb-2 text-[11px] font-semibold text-muted-foreground">Allowed testing categories</p><CheckGrid options={ALLOWED_CATEGORIES} selected={plan.allowedCategories} onChange={(v) => set('allowedCategories', v)} /></div>
                            <div><p className="mb-2 text-[11px] font-semibold text-muted-foreground">Explicitly prohibited activities</p><CheckGrid options={PROHIBITED_ACTIVITIES} selected={plan.prohibitedActivities} onChange={(v) => set('prohibitedActivities', v)} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1"><FL>Rate limits / throttling</FL><Input className="h-8 text-xs" placeholder="e.g. max 10 req/s per endpoint" value={plan.rateLimit} onChange={(e) => set('rateLimit', e.target.value)} /></div>
                            <div className="flex flex-col gap-1"><FL>Sensitive system exclusions</FL><Input className="h-8 text-xs" placeholder="e.g. payment gateway, HSM, prod DB" value={plan.sensitiveExclusions} onChange={(e) => set('sensitiveExclusions', e.target.value)} /></div>
                            <div className="flex flex-col gap-1"><FL>Stop-test conditions</FL><TA placeholder="Stop immediately if production data is accessed" value={plan.stopConditions} onChange={(v) => set('stopConditions', v)} /></div>
                            <div className="flex flex-col gap-1"><FL>Emergency escalation process</FL><TA placeholder="Contact CISO within 30 min of critical finding" value={plan.escalationProcess} onChange={(v) => set('escalationProcess', v)} /></div>
                            <div className="flex flex-col gap-1"><FL>Evidence handling</FL><TA placeholder="Screenshots encrypted, stored in secured vault" value={plan.evidenceHandling} onChange={(v) => set('evidenceHandling', v)} /></div>
                            <div className="flex flex-col gap-1"><FL>Data handling</FL><TA placeholder="No PII extracted, findings stored on encrypted drive" value={plan.dataHandling} onChange={(v) => set('dataHandling', v)} /></div>
                            <div className="col-span-2 flex flex-col gap-1"><FL>Reporting expectations</FL><TA placeholder="Executive summary + technical report, due within 5 business days" value={plan.reportingExpectations} onChange={(v) => set('reportingExpectations', v)} /></div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* 4. Threat Modeling */}
            <Card>
                <CardHeader className="px-4 pb-0 pt-3">
                    <SectionHdr icon={<BookOpen className="size-3.5" />} open={open.threat} progress={thP} subtitle="Frameworks, critical assets, trust boundaries, auth flows, known risks" title="Threat Modeling Inputs" onToggle={() => tog('threat')} />
                </CardHeader>
                {open.threat && (
                    <CardContent className="px-4 pb-4 pt-2 flex flex-col gap-4">
                        <div><p className="mb-2 text-[11px] font-semibold text-muted-foreground">Threat modeling frameworks</p><CheckGrid cols={3} options={THREAT_FRAMEWORKS} selected={plan.frameworks} onChange={(v) => set('frameworks', v)} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                ['businessCriticalAssets','Business-critical assets','User DB, payment service, auth service…',true],
                                ['highRiskRoles','High-risk user roles','Admin, finance, privileged API consumers…',false],
                                ['trustBoundaries','Trust boundaries','DMZ ↔ internal, auth perimeter…',true],
                                ['authFlows','Authentication flows','OAuth2, SAML, session cookies, API keys…',false],
                                ['externalIntegrations','External integrations','Payment gateway, SSO provider, S3, CDN…',false],
                                ['sensitiveDataTypes','Sensitive data types','PII, PHI, PCI, credentials, private keys…',false],
                                ['knownConcerns','Known security concerns','Prior vulns, outstanding patches…',false],
                                ['assumptions','Assumptions','Patch management current, WAF in place…',false],
                                ['constraints','Constraints','Cannot test payment provider, limited days…',false],
                            ] as [keyof PlanState, string, string, boolean][]).map(([key, lbl, ph, req]) => (
                                <div className="flex flex-col gap-1" key={key}><FL req={req}>{lbl}</FL><TA placeholder={ph} value={plan[key] as string} onChange={(v) => set(key, v)} /></div>
                            ))}
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* 5. Asset Inventory */}
            <Card>
                <CardHeader className="px-4 pb-0 pt-3">
                    <SectionHdr icon={<Server className="size-3.5" />} open={open.inventory} progress={invP} subtitle="Web apps, APIs, servers, DBs, cloud, CI/CD, identity providers, third-party" title="Asset Inventory" onToggle={() => tog('inventory')} />
                </CardHeader>
                {open.inventory && <CardContent className="px-4 pb-4 pt-2"><AssetBuilder items={assets} onChange={setAssets} /></CardContent>}
            </Card>

            {/* 6. Credentials */}
            <Card>
                <CardHeader className="px-4 pb-0 pt-3">
                    <SectionHdr icon={<Lock className="size-3.5" />} open={open.creds} progress={crP}
                        subtitle={plan.engagementModel === 'blackbox' ? 'Black Box — no credentials required' : plan.engagementModel === 'greybox' ? 'Grey Box — limited test accounts & roles' : 'White Box — full accounts, docs & source access'}
                        title="Credentials & Access Planning" onToggle={() => tog('creds')} />
                </CardHeader>
                {open.creds && (
                    <CardContent className="px-4 pb-4 pt-2">
                        {plan.engagementModel === 'blackbox' && (
                            <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                                Black Box — no credentials provided. The assessment simulates a fully external, unauthenticated attacker with no prior knowledge of the target.
                            </div>
                        )}
                        {plan.engagementModel === 'greybox' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1"><FL req>Test accounts</FL><TA placeholder="user_test@acme.com (standard user), admin_test (admin)" value={plan.credAccounts} onChange={(v) => set('credAccounts', v)} /></div>
                                <div className="flex flex-col gap-1"><FL req>Role coverage</FL><TA placeholder="admin, standard_user, read_only, api_consumer" value={plan.credRoles} onChange={(v) => set('credRoles', v)} /></div>
                                <div className="flex flex-col gap-1"><FL>Access limitations</FL><Input className="h-8 text-xs" placeholder="Read-only on prod DB, no billing access" value={plan.credAccessLimits} onChange={(e) => set('credAccessLimits', e.target.value)} /></div>
                                <div className="flex flex-col gap-1 justify-end">
                                    <div className="flex gap-4">
                                        {([['credMFA','MFA configured'],['credVPN','VPN required']] as [keyof PlanState,string][]).map(([k,l]) => (
                                            <label className="flex cursor-pointer items-center gap-2 text-xs" key={k}>
                                                <input checked={plan[k] as boolean} className="size-3.5 cursor-pointer rounded accent-blue-600" type="checkbox" onChange={(e) => set(k, e.target.checked)} />{l}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {plan.engagementModel === 'whitebox' && (
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1"><FL>Full test accounts & credentials</FL><TA placeholder="admin@acme.com / Secure#Pass123" value={plan.credAccounts} onChange={(v) => set('credAccounts', v)} /></div>
                                <div>
                                    <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Documentation & access provided</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([['credArchDocs','Architecture documents'],['credAPIDoc','API documentation'],['credSourceCode','Source code access'],['credCloudAccess','Cloud read-only access'],['credNetworkDiagrams','Network diagrams']] as [keyof PlanState,string][]).map(([k,l]) => (
                                            <label className={`flex cursor-pointer select-none items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${plan[k] ? 'border-green-300 bg-green-50 text-green-700' : 'border-border hover:bg-muted/50'}`} key={k}>
                                                <input checked={plan[k] as boolean} className="sr-only" type="checkbox" onChange={(e) => set(k, e.target.checked)} />
                                                <span className={`flex size-3.5 shrink-0 items-center justify-center rounded border ${plan[k] ? 'border-green-500 bg-green-500' : 'border-border bg-background'}`}>
                                                    {plan[k] && <svg className="size-2.5" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" /></svg>}
                                                </span>
                                                {l}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Launch bar */}
            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">
                        {total < 30 ? 'Fill in required sections to proceed' : total < 70 ? 'Good progress — complete more sections for a thorough plan' : 'Plan looks comprehensive — ready to generate'}
                    </span>
                    <span className="text-xs text-muted-foreground">Compiles into a structured prompt and launches the AI agent.</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button className="gap-1.5" size="sm" type="button" variant="outline" onClick={handleCopy}>
                        <Copy className="size-3.5" />{copied ? 'Copied!' : 'Copy prompt'}
                    </Button>
                    <Button className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700" disabled={total < 20} size="sm" type="button" onClick={handleLaunch}>
                        <Play className="size-3.5" />Generate & Launch
                    </Button>
                </div>
            </div>
        </div>
    );
};
