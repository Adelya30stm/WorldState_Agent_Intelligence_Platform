import { useMemo } from 'react';

import { useFlow } from '@/providers/flow-provider';

import { buildWorldState } from './world-state-builder';
import type { WorldState } from './world-state-types';

export function useWorldState(): WorldState | null {
    const { flowData, flowId } = useFlow();

    return useMemo(() => {
        if (!flowId || !flowData) return null;

        return buildWorldState({
            flowId,
            flowTitle: flowData.flow?.title ?? `Flow ${flowId}`,
            tasks: flowData.tasks ?? [],
            terminalLogs: flowData.terminalLogs ?? [],
            messageLogs: flowData.messageLogs ?? [],
            agentLogs: flowData.agentLogs ?? [],
            searchLogs: flowData.searchLogs ?? [],
        });
    }, [flowId, flowData]);
}
