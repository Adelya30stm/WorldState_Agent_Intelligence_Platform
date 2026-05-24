import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { EntityType, WorldState } from './world-state-types';
import { ENTITY_COLORS, ENTITY_TYPE_LABELS } from './world-state-types';

interface WorldStateSidebarProps {
    worldState: WorldState;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}

const WorldStateSidebar = ({ worldState, selectedId, onSelect }: WorldStateSidebarProps) => {
    const [search, setSearch] = useState('');
    const [activeType, setActiveType] = useState<EntityType | null>(null);

    // Count by type
    const typeCounts = useMemo(() => {
        const counts: Partial<Record<EntityType, number>> = {};
        for (const e of worldState.entities) {
            counts[e.type] = (counts[e.type] ?? 0) + 1;
        }
        return counts;
    }, [worldState.entities]);

    const types = Object.keys(typeCounts) as EntityType[];

    const filtered = useMemo(() => {
        return worldState.entities.filter((e) => {
            if (activeType && e.type !== activeType) return false;
            if (search && !e.label.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [worldState.entities, activeType, search]);

    return (
        <div className="flex h-full flex-col border-r bg-background">
            {/* Header */}
            <div className="border-b px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Entities — {worldState.entities.length}
                </p>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                    <Input
                        className="h-7 pl-6 text-xs"
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter…"
                        value={search}
                    />
                </div>
            </div>

            {/* Type filter chips */}
            <div className="border-b px-3 py-2 flex flex-wrap gap-1">
                <button
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        !activeType ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                    onClick={() => setActiveType(null)}
                >
                    All
                </button>
                {types.map((t) => (
                    <button
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            activeType === t ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                        key={t}
                        onClick={() => setActiveType(activeType === t ? null : t)}
                        style={activeType === t ? { background: ENTITY_COLORS[t] } : {}}
                    >
                        {ENTITY_TYPE_LABELS[t]} ({typeCounts[t]})
                    </button>
                ))}
            </div>

            {/* Entity list */}
            <ScrollArea className="flex-1">
                <div className="space-y-0.5 p-2">
                    {filtered.map((entity) => {
                        const color = ENTITY_COLORS[entity.type];
                        const isSelected = entity.id === selectedId;

                        return (
                            <button
                                className={`w-full text-left rounded-lg px-3 py-2 transition-colors flex items-center gap-2 group ${
                                    isSelected
                                        ? 'bg-accent text-accent-foreground'
                                        : 'hover:bg-muted/60'
                                }`}
                                key={entity.id}
                                onClick={() => onSelect(isSelected ? null : entity.id)}
                            >
                                <div
                                    className="size-2 rounded-full shrink-0"
                                    style={{ background: color }}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium leading-tight">
                                        {entity.label}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground" style={{ color: `${color}aa` }}>
                                        {ENTITY_TYPE_LABELS[entity.type]}
                                        {entity.status ? ` · ${entity.status}` : ''}
                                    </p>
                                </div>
                                {entity.highPriority && (
                                    <span className="text-[10px] shrink-0 font-semibold text-red-500">!</span>
                                )}
                            </button>
                        );
                    })}

                    {filtered.length === 0 && (
                        <p className="py-8 text-center text-xs text-muted-foreground">No entities found</p>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default WorldStateSidebar;
