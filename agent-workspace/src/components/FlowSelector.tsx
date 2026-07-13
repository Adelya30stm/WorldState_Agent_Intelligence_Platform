import { gql, useQuery } from '@apollo/client';
import { CheckCircle2, Clock, Loader2, Play, XCircle, CircleDot, ChevronDown, LogIn } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface Props {
    selectedId: string | null;
    onSelect: (id: string) => void;
}

const FLOWS_QUERY = gql`
    query Flows {
        flows {
            id
            title
            status
            createdAt
        }
    }
`;

const STATUS_ICON: Record<string, React.ReactNode> = {
    running: <Play size={10} className="text-sky-400" />,
    waiting: <Clock size={10} className="text-amber-400" />,
    finished: <CheckCircle2 size={10} className="text-emerald-400" />,
    failed: <XCircle size={10} className="text-red-400" />,
    created: <CircleDot size={10} className="text-slate-400" />,
};

const STATUS_DOT: Record<string, string> = {
    running: 'bg-sky-400',
    waiting: 'bg-amber-400',
    finished: 'bg-emerald-400',
    failed: 'bg-red-400',
    created: 'bg-slate-500',
};

export function FlowSelector({ selectedId, onSelect }: Props) {
    const { data, loading } = useQuery(FLOWS_QUERY, { pollInterval: 15000 });
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const flows: any[] = (data?.flows ?? []).slice().reverse();
    const selected = flows.find(f => f.id === selectedId);

    useEffect(() => {
        function handleOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2.5 bg-[#161b22] border border-indigo-900/50 rounded-xl px-4 py-2.5 hover:border-indigo-700/60 transition-colors min-w-[260px]"
            >
                {loading ? (
                    <Loader2 size={14} className="animate-spin text-slate-500" />
                ) : (
                    <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[selected?.status ?? 'created']} ${selected?.status === 'running' ? 'animate-pulse' : ''}`} />
                )}
                <span className="text-sm text-slate-200 truncate flex-1 text-left">
                    {selected ? selected.title || `Flow #${selected.id}` : 'Select a flow…'}
                </span>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-[#161b22] border border-indigo-900/50 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden max-h-80 overflow-y-auto">
                    {flows.length === 0 ? (
                        <div className="px-4 py-6 text-center text-slate-600 text-sm">No flows found</div>
                    ) : (
                        flows.map(flow => (
                            <button
                                key={flow.id}
                                onClick={() => { onSelect(flow.id); setOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-900/20 transition-colors text-left ${flow.id === selectedId ? 'bg-indigo-900/30' : ''}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[flow.status]} ${flow.status === 'running' ? 'animate-pulse' : ''}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200 truncate">{flow.title || `Flow #${flow.id}`}</p>
                                    <p className="text-[10px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                                        {STATUS_ICON[flow.status]}
                                        {flow.status}
                                        <span className="text-slate-700">·</span>
                                        #{flow.id}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
