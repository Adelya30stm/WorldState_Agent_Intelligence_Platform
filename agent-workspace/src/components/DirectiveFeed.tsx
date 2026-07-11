import { useEffect, useRef, useState } from 'react';
import { gql, useQuery, useSubscription } from '@apollo/client';
import { Send, Terminal, Loader2, ChevronRight, Bot, User, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
    flowId: string | null;
}

const MESSAGES_QUERY = gql`
    query Messages($flowId: ID!) {
        flowMessages(flowId: $flowId) {
            id
            message
            type
            agentType
            createdAt
        }
    }
`;

const MESSAGES_SUB = gql`
    subscription NewMessage($flowId: ID!) {
        flowMessageCreated(flowId: $flowId) {
            id
            message
            type
            agentType
            createdAt
        }
    }
`;

const TYPE_STYLES: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    human: {
        icon: <User size={12} />,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.12)',
    },
    ai: {
        icon: <Bot size={12} />,
        color: '#0ea5e9',
        bg: 'rgba(14,165,233,0.08)',
    },
    tool: {
        icon: <Terminal size={12} />,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.08)',
    },
    error: {
        icon: <AlertTriangle size={12} />,
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.08)',
    },
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function DirectiveFeed({ flowId }: Props) {
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [execResult, setExecResult] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const { data } = useQuery(MESSAGES_QUERY, {
        variables: { flowId },
        skip: !flowId,
        fetchPolicy: 'network-only',
    });

    useSubscription(MESSAGES_SUB, {
        variables: { flowId },
        skip: !flowId,
        onData: ({ client, data: sub }) => {
            const msg = sub?.data?.flowMessageCreated;
            if (!msg) return;
            client.cache.updateQuery(
                { query: MESSAGES_QUERY, variables: { flowId } },
                (prev: any) => ({
                    flowMessages: [...(prev?.flowMessages ?? []), msg],
                }),
            );
        },
    });

    const messages: any[] = data?.flowMessages ?? [];

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    async function runCommand() {
        if (!flowId || !input.trim()) return;
        setSending(true);
        setExecResult(null);
        try {
            const res = await api.exec(flowId, input.trim());
            setExecResult(`Exit ${res.exitCode}\n${res.output}`);
        } catch (e) {
            setExecResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setSending(false);
        }
        setInput('');
    }

    function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runCommand(); }
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-indigo-900/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-900/30">
                <Terminal size={14} className="text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">Agent Feed</span>
                {flowId && (
                    <span className="ml-auto text-[10px] text-slate-600">Flow #{flowId}</span>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
                {messages.map((msg) => {
                    const style = TYPE_STYLES[msg.type] ?? TYPE_STYLES.ai;
                    return (
                        <div key={msg.id} className="rounded-lg px-3 py-2.5" style={{ background: style.bg }}>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span style={{ color: style.color }} className="flex items-center gap-1 font-semibold">
                                    {style.icon}
                                    {msg.agentType ?? msg.type}
                                </span>
                                <span className="text-slate-600 text-[10px] ml-auto">{formatTime(msg.createdAt)}</span>
                            </div>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap break-words"
                                style={{ maxHeight: '120px', overflow: 'hidden', fontSize: '11px' }}>
                                {msg.message}
                            </p>
                        </div>
                    );
                })}

                {execResult && (
                    <div className="rounded-lg px-3 py-2.5 bg-emerald-950/30 border border-emerald-900/30">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                <ChevronRight size={12} /> exec result
                            </span>
                        </div>
                        <pre className="text-emerald-300 text-[10px] whitespace-pre-wrap overflow-auto max-h-32">{execResult}</pre>
                    </div>
                )}

                {!flowId && (
                    <div className="flex items-center justify-center py-16 text-slate-600">
                        <p>Select a flow to see messages</p>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-indigo-900/30">
                <div className="flex items-center gap-2 bg-[#161b22] rounded-lg border border-indigo-900/40 px-3 py-2 focus-within:border-indigo-700/60 transition-colors">
                    <ChevronRight size={14} className="text-indigo-500 shrink-0" />
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={onKey}
                        placeholder={flowId ? 'Run command in agent container…' : 'Select a flow first'}
                        disabled={!flowId || sending}
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none font-mono disabled:opacity-40"
                    />
                    <button
                        onClick={runCommand}
                        disabled={!flowId || !input.trim() || sending}
                        className="text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition-colors"
                    >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
