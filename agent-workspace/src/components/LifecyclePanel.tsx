import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, RefreshCw } from 'lucide-react';
import { api, LifecycleResponse } from '@/lib/api';

const STATE_COLOR: Record<string, string> = {
    unknown: 'bg-slate-700 text-slate-200',
    discovered: 'bg-sky-900/70 text-sky-200',
    scanning: 'bg-amber-900/70 text-amber-200',
    assessed: 'bg-indigo-900/70 text-indigo-200',
    vulnerable: 'bg-orange-900/70 text-orange-200',
    exploited: 'bg-red-900/70 text-red-200',
    remediated: 'bg-emerald-900/70 text-emerald-200',
};

function StatePill({ state }: { state: string }) {
    return (
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${STATE_COLOR[state] ?? 'bg-slate-800 text-slate-300'}`}>
            {state}
        </span>
    );
}

export function LifecyclePanel({ flowId }: { flowId: string | null }) {
    const [data, setData] = useState<LifecycleResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!flowId) return;
        setLoading(true);
        setError(null);
        try {
            setData(await api.lifecycle(flowId));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load lifecycle');
        } finally {
            setLoading(false);
        }
    }, [flowId]);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 10000);
        return () => clearInterval(id);
    }, [refresh]);

    if (!flowId) {
        return (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm bg-[#0d1117] rounded-xl border border-indigo-900/40">
                Select a flow to see lifecycle state
            </div>
        );
    }

    const entities = data?.entities ?? [];
    const transitions = data?.transitions ?? [];
    const counts = data?.counts ?? {};

    return (
        <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-indigo-900/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/30 shrink-0">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-violet-400" />
                    <span className="text-sm font-semibold text-slate-200">Asset Lifecycle</span>
                    <span className="text-[10px] text-slate-600">{entities.length} entities</span>
                </div>
                <button onClick={refresh} className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300">
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && <div className="px-4 py-2 text-xs text-red-400 border-b border-red-900/30">{error}</div>}

            {Object.keys(counts).length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-indigo-900/20 shrink-0">
                    {Object.entries(counts).map(([state, n]) => (
                        <div key={state} className="flex items-center gap-1.5 text-[10px]">
                            <StatePill state={state} />
                            <span className="text-slate-500">{n}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex-1 min-h-0 grid grid-cols-2 gap-0 overflow-hidden">
                <div className="overflow-y-auto border-r border-indigo-900/20">
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-600 sticky top-0 bg-[#0d1117]">
                        Entities (planner frontier)
                    </div>
                    {entities.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-slate-600">No persisted entities yet</p>
                    ) : (
                        entities.map(e => (
                            <div key={e.id} className="px-3 py-2 border-b border-indigo-950/40 hover:bg-white/[0.02]">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <StatePill state={e.state} />
                                    <span className="text-[10px] text-slate-600">{e.type}</span>
                                </div>
                                <p className="text-xs text-slate-300 font-mono truncate">{e.entityKey}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="overflow-y-auto">
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-600 sticky top-0 bg-[#0d1117]">
                        Transitions (audit)
                    </div>
                    {transitions.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-slate-600">No transitions yet</p>
                    ) : (
                        transitions.map(t => (
                            <div key={t.id} className="px-3 py-2 border-b border-indigo-950/40">
                                <p className="text-[10px] text-slate-500 font-mono truncate mb-1">{t.entityKey}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <StatePill state={t.fromState} />
                                    <ArrowRight size={10} className="text-slate-600" />
                                    <StatePill state={t.toState} />
                                    <span className="text-[10px] text-violet-400/80 ml-1">{t.agent}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
