import { useEffect, useRef, useState } from 'react';
import { gql, useSubscription, useQuery } from '@apollo/client';

export type AgentStatus = 'created' | 'waiting' | 'running' | 'finished' | 'failed';

export interface StateTransition {
    id: string;
    flowId: string;
    agentType: string;
    taskId?: string;
    taskTitle?: string;
    fromState: AgentStatus | null;
    toState: AgentStatus;
    reason?: string;
    triggeredBy?: string;
    timestamp: string;
}

// Derive transitions from task status changes coming via subscription
const TASKS_QUERY = gql`
    query AllTasks($flowId: ID!) {
        flowTasks(flowId: $flowId) {
            id
            title
            status
            agentType
            createdAt
            finishedAt
        }
    }
`;

const TASK_SUB = gql`
    subscription TaskChanged($flowId: ID!) {
        taskStatusChanged(flowId: $flowId) {
            id
            title
            status
            agentType
        }
    }
`;

function makeTransitionId() {
    return `tr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useAgentTransitions(flowId: string | null) {
    const prevStates = useRef<Map<string, AgentStatus>>(new Map());
    const [transitions, setTransitions] = useState<StateTransition[]>([]);

    const { data: initialData } = useQuery(TASKS_QUERY, {
        variables: { flowId },
        skip: !flowId,
        fetchPolicy: 'network-only',
    });

    // Seed prevStates from initial data
    useEffect(() => {
        if (!initialData?.flowTasks) return;
        for (const t of initialData.flowTasks) {
            if (!prevStates.current.has(t.id)) {
                prevStates.current.set(t.id, t.status);
            }
        }
        // Create synthetic initial transitions for snapshot
        const initial: StateTransition[] = initialData.flowTasks.map((t: any) => ({
            id: makeTransitionId(),
            flowId: flowId!,
            agentType: t.agentType ?? 'unknown',
            taskId: t.id,
            taskTitle: t.title,
            fromState: null,
            toState: t.status,
            reason: 'initial snapshot',
            timestamp: t.createdAt,
        }));
        setTransitions(initial);
    }, [initialData, flowId]);

    useSubscription(TASK_SUB, {
        variables: { flowId },
        skip: !flowId,
        onData: ({ data: sub }) => {
            const task = sub?.data?.taskStatusChanged;
            if (!task) return;
            const prev = prevStates.current.get(task.id) ?? null;
            const next = task.status as AgentStatus;
            if (prev === next) return;

            prevStates.current.set(task.id, next);
            const tr: StateTransition = {
                id: makeTransitionId(),
                flowId: flowId!,
                agentType: task.agentType ?? 'unknown',
                taskId: task.id,
                taskTitle: task.title,
                fromState: prev,
                toState: next,
                reason: inferReason(prev, next),
                timestamp: new Date().toISOString(),
            };
            setTransitions(prev => [tr, ...prev].slice(0, 200));
        },
    });

    function clear() {
        setTransitions([]);
        prevStates.current.clear();
    }

    return { transitions, clear };
}

function inferReason(from: AgentStatus | null, to: AgentStatus): string {
    if (!from) return 'task created';
    const map: Partial<Record<AgentStatus, Partial<Record<AgentStatus, string>>>> = {
        created: { running: 'started execution', waiting: 'queued', failed: 'start error' },
        waiting: { running: 'resource acquired', failed: 'timeout / error' },
        running: { finished: 'completed successfully', failed: 'execution error', waiting: 'awaiting dependency' },
        finished: { running: 'retried' },
    };
    return map[from]?.[to] ?? `${from} → ${to}`;
}
