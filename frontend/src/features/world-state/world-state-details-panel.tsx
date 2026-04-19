import { X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import EntityActionMenu from './entity-action-menu';
import type { EntityAction, WorldState, WorldStateEntity } from './world-state-types';
import { ENTITY_COLORS, ENTITY_TYPE_LABELS, RISK_BADGE } from './world-state-types';

interface WorldStateDetailsPanelProps {
    entity: WorldStateEntity | null;
    worldState: WorldState;
    onClose: () => void;
    onEntityUpdate: (updated: WorldStateEntity) => void;
}

const MetaRow = ({ label, value }: { label: string; value: string | number | boolean | null }) => (
    <div className="flex flex-col gap-0.5 py-2 border-b last:border-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-xs break-all font-mono">{String(value ?? '—')}</span>
    </div>
);

const WorldStateDetailsPanel = ({
    entity,
    worldState,
    onClose,
    onEntityUpdate,
}: WorldStateDetailsPanelProps) => {
    const [noteText, setNoteText] = useState('');

    const handleAction = useCallback(
        (action: EntityAction, target: WorldStateEntity) => {
            switch (action) {
                case 'mark-high-priority': {
                    const updated: WorldStateEntity = { ...target, highPriority: true };
                    onEntityUpdate(updated);
                    toast.success(`${target.label} marked as high priority`);
                    break;
                }
                case 'add-note': {
                    if (!noteText.trim()) {
                        toast.error('Enter a note first');
                        return;
                    }
                    const updated: WorldStateEntity = { ...target, note: noteText.trim() };
                    onEntityUpdate(updated);
                    setNoteText('');
                    toast.success('Note added');
                    break;
                }
                case 'create-subflow': {
                    toast.info(`Creating subflow scoped to "${target.label}"…`, { duration: 3000 });
                    // Future: POST /api/flows/:flowId/world-state/subflows
                    break;
                }
                case 'safe-probe': {
                    toast.success(`Safe probe queued for ${target.label}`);
                    break;
                }
                case 'deep-scan': {
                    toast.success(`Deep scan authorized and queued for ${target.label}`);
                    break;
                }
                case 'enumerate-endpoints': {
                    toast.success(`Endpoint enumeration queued for ${target.label}`);
                    break;
                }
                default: {
                    toast.info(`Action "${action}" triggered for ${target.label}`);
                }
            }
        },
        [noteText, onEntityUpdate],
    );

    if (!entity) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground p-6">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-2xl">🎯</span>
                </div>
                <p className="text-sm text-center">Click any node in the graph to inspect it and trigger actions</p>
            </div>
        );
    }

    const color = ENTITY_COLORS[entity.type];
    const risk = RISK_BADGE[entity.riskLevel];

    // Count incoming links
    const incomingLinks = worldState.links.filter((l) => l.target === entity.id);
    const outgoingLinks = worldState.links.filter((l) => l.source === entity.id);

    return (
        <div className="flex h-full flex-col border-l bg-background">
            {/* Header */}
            <div
                className="px-4 py-3 border-b flex items-start gap-3"
                style={{ background: `${color}15` }}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <div className="size-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
                            {ENTITY_TYPE_LABELS[entity.type]}
                        </span>
                        <span className={`ml-auto text-[10px] font-medium rounded-full px-2 py-0.5 ${risk.cls}`}>
                            {risk.label}
                        </span>
                    </div>
                    <p className="text-sm font-semibold break-words leading-snug">{entity.label}</p>
                    {entity.status && (
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {entity.status}
                        </span>
                    )}
                    {entity.highPriority && (
                        <span className="ml-1 mt-1 inline-block rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px]">
                            🚨 High Priority
                        </span>
                    )}
                </div>
                <Button
                    className="shrink-0 size-6"
                    onClick={onClose}
                    size="icon"
                    variant="ghost"
                >
                    <X className="size-3" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {/* Relationships */}
                    {(incomingLinks.length > 0 || outgoingLinks.length > 0) && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Relationships
                            </p>
                            <div className="space-y-1 text-xs">
                                {incomingLinks.map((l) => {
                                    const src = worldState.entities.find((e) => e.id === l.source);
                                    return src ? (
                                        <div className="flex items-center gap-1.5 text-muted-foreground" key={l.id}>
                                            <span>←</span>
                                            <span className="font-medium truncate" style={{ color: ENTITY_COLORS[src.type] }}>
                                                {src.label}
                                            </span>
                                            <span className="text-[10px] opacity-60">{l.type}</span>
                                        </div>
                                    ) : null;
                                })}
                                {outgoingLinks.map((l) => {
                                    const tgt = worldState.entities.find((e) => e.id === l.target);
                                    return tgt ? (
                                        <div className="flex items-center gap-1.5 text-muted-foreground" key={l.id}>
                                            <span>→</span>
                                            <span className="font-medium truncate" style={{ color: ENTITY_COLORS[tgt.type] }}>
                                                {tgt.label}
                                            </span>
                                            <span className="text-[10px] opacity-60">{l.type}</span>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    {Object.keys(entity.metadata).length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Metadata
                            </p>
                            <div className="rounded-lg border bg-muted/30 px-3 divide-y">
                                {Object.entries(entity.metadata).map(([k, v]) => (
                                    <MetaRow
                                        key={k}
                                        label={k}
                                        value={v}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    {entity.note && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Note
                            </p>
                            <p className="text-xs bg-yellow-50 dark:bg-yellow-950/40 rounded-lg px-3 py-2 text-yellow-900 dark:text-yellow-200 italic">
                                {entity.note}
                            </p>
                        </div>
                    )}

                    {/* Add note textarea */}
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Add Note
                        </p>
                        <textarea
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add an analyst note…"
                            rows={2}
                            value={noteText}
                        />
                    </div>

                    {/* Actions */}
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            Actions
                        </p>
                        <EntityActionMenu
                            entity={entity}
                            onAction={handleAction}
                        />
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};

export default WorldStateDetailsPanel;
