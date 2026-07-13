import { StateTransition, AgentStatus } from '@/hooks/useAgentTransitions';
import { ArrowRight, Activity, Trash2 } from 'lucide-react';

interface Props {
    transitions: StateTransition[];
    onClear: () => void;
}

const STATUS_STYLE: Record<AgentStatus, { bg: string; text: string; border: string }> = {
    created:  { bg: 'bg-slate-800',    text: 'text-slate-300',  border: 'border-slate-600' },
    waiting:  { bg: 'bg-amber-950/60', text: 'text-amber-300',  border: 'border-amber-700' },
    running:  { bg: 'bg-sky-950/60',   text: 'text-sky-300',    border: 'border-sky-700' },
    finished: { bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-700' },
    failed:   { bg: 'bg-red-950/60',   text: 'text-red-300',    border: 'border-red-700' },
};

const AGENT_COLOR: Record<string, string> = {
    researcher: '#0ea5e9',
    developer:  '#8b5cf6',
    executor:   '#10b981',
    pentester:  '#f97316',
    planner:    '#ec4899',
    unknown:    '#64748b',
};

function StateBadge({ state }: { state: AgentStatus | null }) {
    if (!state) return <span className="text-slate-600 text-[10px]">—</span>;
    const s = STATUS_STYLE[state];
    return (
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${s.bg} ${s.text} ${s.border}`}>
            {state}
        </span>
    );
}

function formatTs(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function AgentStateTimeline({ transitions, onClear }: Props) {
    // Build live summary: latest state per agent type
    const agentSummary: Record<string, AgentStatus> = {};
    for (const tr of [...transitions].reverse()) {
        if (!agentSummary[tr.agentType]) agentSummary[tr.agentType] = tr.toState;
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-indigo-900/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/30 shrink-0">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-200">State Transitions</span>
                    {transitions.length > 0 && (
                        <span className="text-[10px] text-slate-600">{transitions.length} events</span>
                    )}
                </div>
                {transitions.length > 0 && (
                    <button
                        onClick={onClear}
                        className="p-1.5 rounded hover:bg-white/5 text-slate-600 hover:text-slate-400 transition-colors"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            {/* Agent status summary pills */}
            {Object.keys(agentSummary).length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 py-2.5 border-b border-indigo-900/20 shrink-0">
                    {Object.entries(agentSummary).map(([agent, state]) => {
                        const s = STATUS_STYLE[state];
                        const color = AGENT_COLOR[agent] ?? AGENT_COLOR.unknown;
                        return (
                            <div key={agent} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] ${s.bg} ${s.border}`}>
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                                <span style={{ color }} className="font-medium">{agent}</span>
                                <span className={s.text}>{state}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Transition log */}
            <div className="flex-1 overflow-y-auto">
                {transitions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                        <Activity size={24} className="opacity-30" />
                        <p className="text-xs">Waiting for state transitions…</p>
                        <p className="text-[10px] text-slate-700">Transitions appear as agents change state</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {transitions.map((tr, i) => {
                            const color = AGENT_COLOR[tr.agentType] ?? AGENT_COLOR.unknown;
                            const isNew = i === 0 && tr.fromState !== null;
                            return (
                                <div
                                    key={tr.id}
                                    className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${isNew ? 'bg-indigo-950/20' : ''}`}
                                >
                                    {/* Timeline dot */}
                                    <div className="flex flex-col items-center mt-1.5 shrink-0">
                                        <div
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ background: color, boxShadow: isNew ? `0 0 6px ${color}` : 'none' }}
                                        />
                                        {i < transitions.length - 1 && (
                                            <div className="w-px flex-1 bg-white/[0.06] mt-1" style={{ minHeight: '12px' }} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pb-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] font-semibold" style={{ color }}>
                                                {tr.agentType}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <StateBadge state={tr.fromState} />
                                                <ArrowRight size={10} className="text-slate-600 shrink-0" />
                                                <StateBadge state={tr.toState} />
                                            </div>
                                            <span className="ml-auto text-[10px] text-slate-600 shrink-0 font-mono">
                                                {formatTs(tr.timestamp)}
                                            </span>
                                        </div>
                                        {tr.taskTitle && (
                                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{tr.taskTitle}</p>
                                        )}
                                        <p className="text-[10px] text-slate-600 mt-0.5 italic">{tr.reason}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
