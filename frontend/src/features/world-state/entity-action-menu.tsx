import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import type { EntityAction, WorldStateEntity } from './world-state-types';
import { ACTION_ICONS, ACTION_LABELS, ACTION_RISKY, ENTITY_ACTIONS } from './world-state-types';

interface EntityActionMenuProps {
    entity: WorldStateEntity;
    onAction: (action: EntityAction, entity: WorldStateEntity) => void;
}

const EntityActionMenu = ({ entity, onAction }: EntityActionMenuProps) => {
    const [pendingAction, setPendingAction] = useState<EntityAction | null>(null);
    const [justification, setJustification] = useState('');

    const actions = ENTITY_ACTIONS[entity.type] ?? [];

    const handleClick = (action: EntityAction) => {
        if (ACTION_RISKY[action]) {
            setPendingAction(action);
        } else {
            onAction(action, entity);
        }
    };

    const handleConfirm = () => {
        if (!pendingAction) return;
        onAction(pendingAction, entity);
        setPendingAction(null);
        setJustification('');
    };

    return (
        <>
            <div className="space-y-1">
                {actions.map((action) => {
                    const risky = ACTION_RISKY[action];
                    return (
                        <button
                            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left
                                ${risky
                                    ? 'hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300'
                                    : 'hover:bg-muted'
                                }`}
                            key={action}
                            onClick={() => handleClick(action)}
                        >
                            <span className="text-base">{ACTION_ICONS[action]}</span>
                            <span className="flex-1">{ACTION_LABELS[action]}</span>
                            {risky && (
                                <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                            )}
                            <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                        </button>
                    );
                })}
            </div>

            {/* Risky action confirmation dialog */}
            <Dialog onOpenChange={(o) => { if (!o) setPendingAction(null); }} open={!!pendingAction}>
                <DialogContent className="max-w-md border-2 border-amber-500">
                    <div className="bg-amber-500 -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-white">
                                <AlertTriangle className="size-5" />
                                Authorization required
                            </DialogTitle>
                        </DialogHeader>
                    </div>
                    <div className="space-y-3 pt-2">
                        <p className="text-sm">
                            <strong>{pendingAction && ACTION_LABELS[pendingAction]}</strong> on{' '}
                            <strong className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{entity.label}</strong>{' '}
                            is a potentially intrusive action. Are you authorized to perform this?
                        </p>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Justification (required)</p>
                            <Textarea
                                className="text-sm"
                                onChange={(e) => setJustification(e.target.value)}
                                placeholder="Describe why this action is authorized…"
                                rows={2}
                                value={justification}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            onClick={() => setPendingAction(null)}
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            disabled={!justification.trim()}
                            onClick={handleConfirm}
                        >
                            Confirm & Execute
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default EntityActionMenu;
