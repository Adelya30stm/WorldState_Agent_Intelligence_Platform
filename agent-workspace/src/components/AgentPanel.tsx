import { useQuery, useSubscription, gql } from '@apollo/client';
import { Bot, CircleDot, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface Props {
    flowId: string | null;
}

const TASKS_QUERY = gql`
    query FlowTasks($flowId: ID!) {
        flowTasks(flowId: $flowId) {
            id
            title
            status
            agentType
            input
            result
            createdAt
            finishedAt
        }
    }
`;

const TASKS_SUB = gql`
    subscription TaskUpdated($flowId: ID!) {
        taskStatusChanged(flowId: $flowId) {
            id
            status
            agentType
            title
            result
        }
    }
`;

const AGENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    researcher: { label: 'Researcher', color: '#0ea5e9' },
    developer: { label: 'Developer', color: '#8b5cf6' },
    executor: { label: 'Executor', color: '#10b981' },
    pentester: { label: 'PenTester', color: '#f97316' },
    planner: { label: 'Planner', color: '#ec4899' },
    default: { label: 'Agent', color: '#64748b' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    running: <Loader2 size={14} className="animate-spin text-sky-400" />,
    waiting: <Clock size={14} className="text-amber-400" />,
    finished: <CheckCircle2 size={14} className="text-emerald-400" />,
    failed: <XCircle size={14} className="text-red-400" />,
    created: <CircleDot size={14} className="text-slate-400" />,
};

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
}

export function AgentPanel({ flowId }: Props) {
    const { data, loading } = useQuery(TASKS_QUERY, {
        variables: { flowId },
        skip: !flowId,
        fetchPolicy: 'network-only',
    });

    useSubscription(TASKS_SUB, {
        variables: { flowId },
        skip: !flowId,
        onData: ({ client, data: sub }) => {
            if (!sub?.data?.taskStatusChanged) return;
            const updated = sub.data.taskStatusChanged;
            const cache = client.cache.readQuery<{ flowTasks: any[] }>({
                query: TASKS_QUERY,
                variables: { flowId },
            });
            if (!cache) return;
            client.cache.writeQuery({
                query: TASKS_QUERY,
                variables: { flowId },
                data: {
                    flowTasks: cache.flowTasks.map(t =>
                        t.id === updated.id ? { ...t, ...updated } : t
                    ),
                },
            });
        },
    });

    const tasks: any[] = data?.flowTasks ?? [];
    const byAgent: Record<string, any[]> = {};
    for (const t of tasks) {
        const key = t.agentType ?? 'default';
        (byAgent[key] ??= []).push(t);
    }

    if (!flowId) {
        return (
            <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-indigo-900/40 items-center justify-center text-slate-600 gap-3 p-6">
                <Bot size={32} className="opacity-30" />
                <p className="text-sm text-center">Select a flow to see<br />agent activity</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-indigo-900/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/30">
                <div className="flex items-center gap-2">
                    <Bot size={14} className="text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-200">Agents</span>
                </div>
                {loading && <Loader2 size={12} className="animate-spin text-slate-500" />}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {Object.entries(byAgent).map(([agentType, agentTasks]) => {
                    const meta = AGENT_TYPE_LABELS[agentType] ?? AGENT_TYPE_LABELS.default;
                    const running = agentTasks.find(t => t.status === 'running');
                    const latest = agentTasks[agentTasks.length - 1];
                    return (
                        <div key={agentType} className="rounded-lg border border-white/5 overflow-hidden">
                            {/* Agent header */}
                            <div className="flex items-center justify-between px-3 py-2"
                                style={{ background: meta.color + '18' }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                                    <span className="text-xs font-semibold" style={{ color: meta.color }}>
                                        {meta.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {running ? STATUS_ICON.running : STATUS_ICON[latest?.status ?? 'created']}
                                    <span className="text-[10px] text-slate-500">
                                        {agentTasks.length} tasks
                                    </span>
                                </div>
                            </div>

                            {/* Tasks */}
                            <div className="divide-y divide-white/[0.04]">
                                {agentTasks.slice(-5).reverse().map(task => (
                                    <div key={task.id} className="px-3 py-2">
                                        <div className="flex items-start gap-2">
                                            <div className="mt-0.5 shrink-0">
                                                {STATUS_ICON[task.status] ?? STATUS_ICON.created}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-slate-300 truncate">{task.title || 'Untitled task'}</p>
                                                <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(task.createdAt)}</p>
                                            </div>
                                        </div>
                                        {task.status === 'running' && (
                                            <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500/60 animate-pulse rounded-full w-2/3" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {tasks.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
                        <Clock size={24} className="opacity-30" />
                        <p className="text-xs">No tasks yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}
