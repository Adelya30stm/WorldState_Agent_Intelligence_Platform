import {
    Background,
    BackgroundVariant,
    Controls,
    type Edge,
    type EdgeTypes,
    MarkerType,
    MiniMap,
    type Node,
    type NodeProps,
    ReactFlow,
    type ReactFlowInstance,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo, useCallback, useEffect, useRef } from 'react';

import type { GraphMode, WorldState, WorldStateEntity } from './world-state-types';
import { ENTITY_COLORS, ENTITY_TYPE_LABELS, GRAPH_MODE_ENTITIES } from './world-state-types';

// ─── Custom node ──────────────────────────────────────────────────────────────

interface EntityNodeData extends Record<string, unknown> {
    entity: WorldStateEntity;
    selected: boolean;
    onSelect: (id: string) => void;
}

const EntityNode = memo(({ data }: NodeProps) => {
    const { entity, selected, onSelect } = data as EntityNodeData;
    const color = ENTITY_COLORS[entity.type] ?? '#64748b';

    return (
        <div
            className={`
                group relative cursor-pointer rounded-xl border-2 bg-popover shadow-md
                transition-all duration-150 select-none
                ${selected ? 'shadow-lg scale-105' : 'hover:shadow-lg hover:scale-[1.02]'}
            `}
            onClick={() => onSelect(entity.id)}
            style={{
                borderColor: selected ? color : `${color}55`,
                minWidth: 160,
                maxWidth: 200,
            }}
        >
            {/* Color header bar */}
            <div
                className="rounded-t-[9px] px-3 py-1.5 flex items-center gap-2"
                style={{ background: `${color}22` }}
            >
                <div
                    className="size-2 rounded-full shrink-0"
                    style={{ background: color }}
                />
                <span
                    className="text-[10px] font-semibold uppercase tracking-wider truncate"
                    style={{ color }}
                >
                    {ENTITY_TYPE_LABELS[entity.type]}
                </span>
                {entity.highPriority && (
                    <span className="ml-auto text-[10px]">🚨</span>
                )}
            </div>

            {/* Label */}
            <div className="px-3 py-2">
                <p className="text-xs font-medium leading-tight break-words line-clamp-2">
                    {entity.label}
                </p>
                {entity.status && (
                    <span className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">
                        {entity.status}
                    </span>
                )}
                {entity.note && (
                    <p className="mt-1 text-[9px] text-muted-foreground italic line-clamp-1">
                        {entity.note}
                    </p>
                )}
            </div>

            {/* Risk indicator dot */}
            {entity.riskLevel !== 'none' && (
                <div className="absolute -top-1.5 -right-1.5 size-3 rounded-full border-2 border-background" style={{
                    background: entity.riskLevel === 'critical' ? '#dc2626'
                        : entity.riskLevel === 'high' ? '#ea580c'
                        : entity.riskLevel === 'medium' ? '#ca8a04'
                        : '#16a34a',
                }} />
            )}
        </div>
    );
});

EntityNode.displayName = 'EntityNode';

const nodeTypes = { entity: EntityNode };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNodes(
    worldState: WorldState,
    mode: GraphMode,
    selectedId: string | null,
    onSelect: (id: string) => void,
): Node[] {
    const allowed = new Set(GRAPH_MODE_ENTITIES[mode]);

    return worldState.entities
        .filter((e) => allowed.has(e.type))
        .map((e) => ({
            id: e.id,
            type: 'entity',
            position: e.position ?? { x: 0, y: 0 },
            data: { entity: e, selected: e.id === selectedId, onSelect } as EntityNodeData,
        }));
}

function buildEdges(worldState: WorldState, mode: GraphMode): Edge[] {
    const visibleIds = new Set(
        worldState.entities.filter((e) => GRAPH_MODE_ENTITIES[mode].includes(e.type)).map((e) => e.id),
    );

    return worldState.links
        .filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
        .map((l) => ({
            id: l.id,
            source: l.source,
            target: l.target,
            label: l.label,
            type: 'smoothstep',
            animated: l.type === 'discovered',
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
            style: {
                stroke: l.type === 'contains' ? '#94a3b8'
                    : l.type === 'discovered' ? '#0891b2'
                    : l.type === 'ran' ? '#7c3aed'
                    : '#94a3b8',
                strokeWidth: 1.5,
            },
        }));
}

// ─── Component ───────────────────────────────────────────────────────────────

interface WorldStateGraphProps {
    worldState: WorldState;
    mode: GraphMode;
    selectedEntityId: string | null;
    onEntitySelect: (id: string | null) => void;
}

const WorldStateGraph = ({ worldState, mode, selectedEntityId, onEntitySelect }: WorldStateGraphProps) => {
    const rfInstance = useRef<ReactFlowInstance | null>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const handleSelect = useCallback(
        (id: string) => {
            onEntitySelect(selectedEntityId === id ? null : id);
        },
        [selectedEntityId, onEntitySelect],
    );

    // Rebuild nodes/edges when world state, mode, or selection changes
    useEffect(() => {
        setNodes(buildNodes(worldState, mode, selectedEntityId, handleSelect));
        setEdges(buildEdges(worldState, mode));
    }, [worldState, mode, selectedEntityId, handleSelect, setNodes, setEdges]);

    // Fit view after initial render
    useEffect(() => {
        const timer = setTimeout(() => rfInstance.current?.fitView({ padding: 0.15 }), 100);
        return () => clearTimeout(timer);
    }, [worldState.flowId, mode]);

    const edgeTypes: EdgeTypes = {};

    return (
        <ReactFlow
            className="bg-muted/20"
            edges={edges}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
            maxZoom={2}
            nodeTypes={nodeTypes}
            nodes={nodes}
            onEdgesChange={onEdgesChange}
            onInit={(instance) => { rfInstance.current = instance; }}
            onNodesChange={onNodesChange}
            onPaneClick={() => onEntitySelect(null)}
            panOnScroll
            proOptions={{ hideAttribution: true }}
            selectionOnDrag
            zoomOnDoubleClick={false}
        >
            <Background
                color="#94a3b840"
                gap={20}
                variant={BackgroundVariant.Dots}
            />
            <Controls className="[&>button]:bg-background [&>button]:border-border [&>button]:text-foreground" />
            <MiniMap
                className="rounded-lg border bg-background shadow-md"
                nodeColor={(n) => {
                    const e = (n.data as EntityNodeData).entity;
                    return ENTITY_COLORS[e.type] ?? '#94a3b8';
                }}
                pannable
                zoomable
            />
        </ReactFlow>
    );
};

export default WorldStateGraph;
