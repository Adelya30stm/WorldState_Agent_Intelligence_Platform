import { useState } from 'react';
import { api, NextStepResponse } from '@/lib/api';
import { Lightbulb, ChevronRight, Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
    flowId: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    default: '#6366f1',
};

export function NextStepPanel({ flowId }: Props) {
    const [data, setData] = useState<NextStepResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    async function fetch() {
        if (!flowId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.nextstep(flowId);
            setData(res);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch recommendations');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-[#0d1117] rounded-xl border border-indigo-900/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/30">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-200">AI Next Step</span>
                    {data && (
                        <span className="text-xs text-slate-500 truncate ml-1">— {data.currentPhase}</span>
                    )}
                </div>
                <button
                    onClick={fetch}
                    disabled={!flowId || loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-600/30 text-indigo-300 text-xs font-medium hover:bg-indigo-600/30 transition-colors disabled:opacity-40"
                >
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <Lightbulb size={11} />}
                    {loading ? 'Thinking…' : 'Analyze'}
                </button>
            </div>

            {error && (
                <div className="px-4 py-3 flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={12} />
                    {error}
                </div>
            )}

            {data && (
                <div className="p-4 space-y-3">
                    {data.summary && (
                        <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-indigo-800 pl-3">
                            {data.summary}
                        </p>
                    )}

                    <div className="space-y-2">
                        {(data.recommendations ?? []).map((rec, i) => {
                            const color = PRIORITY_COLOR[rec.priority] ?? PRIORITY_COLOR.default;
                            const isOpen = expanded === String(i);
                            return (
                                <div key={i} className="rounded-lg border border-white/5 overflow-hidden">
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : String(i))}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                                        <span className="text-xs text-slate-300 text-left flex-1">{rec.step}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] font-medium" style={{ color }}>{rec.priority}</span>
                                            <ChevronRight size={12} className={`text-slate-600 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                        </div>
                                    </button>
                                    {isOpen && (
                                        <div className="px-3 pb-3 space-y-2">
                                            <p className="text-xs text-slate-500 leading-relaxed">{rec.rationale}</p>
                                            {rec.command && (
                                                <code className="block text-[11px] bg-black/30 rounded px-2 py-1.5 text-emerald-300 font-mono overflow-x-auto">
                                                    $ {rec.command}
                                                </code>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {data.caution && (
                        <div className="flex items-start gap-2 px-3 py-2 bg-amber-950/30 border border-amber-900/30 rounded-lg text-xs text-amber-300">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            {data.caution}
                        </div>
                    )}
                </div>
            )}

            {!data && !loading && !error && (
                <div className="px-4 py-8 text-center text-slate-600 text-xs">
                    Click "Analyze" to get AI-powered next step recommendations
                </div>
            )}
        </div>
    );
}
