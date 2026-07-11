import { useState, useEffect, useCallback } from 'react';
import { api, WorldStateResponse } from '@/lib/api';

export function useWorldState(flowId: string | null) {
    const [data, setData] = useState<WorldStateResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!flowId) return;
        setLoading(true);
        setError(null);
        try {
            const ws = await api.worldState(flowId);
            setData(ws);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [flowId]);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 15000);
        return () => clearInterval(id);
    }, [refresh]);

    return { data, loading, error, refresh };
}
