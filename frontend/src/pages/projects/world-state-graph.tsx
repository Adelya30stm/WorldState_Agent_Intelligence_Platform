import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface WSEntity {
    id: string;
    type: string;
    label: string;
    riskLevel: string;
    metadata: Record<string, string>;
}

export interface WSLink {
    id: string;
    source: string;
    target: string;
    label?: string;
}

// ── Sector layout ───────────────────────────────────────────────────
// Each pentest phase gets a gravity center on the canvas.
const W = 900;
const H = 560;

const SECTORS: Record<string, { x: number; y: number; label: string; nodeColor: string; bg: string; textColor: string }> = {
    target:        { x: 220, y: 130, label: 'Attack Surface',  nodeColor: '#e11d48', bg: 'rgba(225,29,72,0.07)',    textColor: '#be185d' },
    endpoint:      { x: 680, y: 130, label: 'Endpoints',       nodeColor: '#0284c7', bg: 'rgba(2,132,199,0.07)',    textColor: '#0369a1' },
    domain:        { x: 100, y: 370, label: 'Network',         nodeColor: '#64748b', bg: 'rgba(100,116,139,0.07)',  textColor: '#475569' },
    finding:       { x: 450, y: 490, label: 'Findings',        nodeColor: '#0891b2', bg: 'rgba(8,145,178,0.07)',    textColor: '#0e7490' },
    vulnerability: { x: 760, y: 400, label: 'Vulnerabilities', nodeColor: '#ea580c', bg: 'rgba(234,88,12,0.07)',    textColor: '#c2410c' },
    threat:        { x: 800, y: 200, label: 'Threats',         nodeColor: '#7c3aed', bg: 'rgba(124,58,237,0.07)',   textColor: '#6d28d9' },
};

const DEFAULT_SECTOR = { x: 450, y: 280, label: '', nodeColor: '#94a3b8', bg: 'transparent', textColor: '#64748b' };

// ── Force simulation ─────────────────────────────────────────────────
const REPULSION  = 2800;
const SPRING_K   = 0.04;
const REST_LEN   = 110;
const GRAVITY    = 0.028;
const DAMPING    = 0.82;
const NODE_R     = 14;

interface SimNode extends WSEntity {
    x: number;
    y: number;
    vx: number;
    vy: number;
    pinned?: boolean;
}

function initNodes(entities: WSEntity[]): SimNode[] {
    return entities.map((e) => {
        const s = SECTORS[e.type] ?? DEFAULT_SECTOR;
        return {
            ...e,
            x: s.x + (Math.random() - 0.5) * 120,
            y: s.y + (Math.random() - 0.5) * 120,
            vx: 0,
            vy: 0,
        };
    });
}

function tickOnce(nodes: SimNode[], links: WSLink[]) {
    const idxMap: Record<string, number> = {};
    nodes.forEach((n, i) => { idxMap[n.id] = i; });

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const ni = nodes[i]!;
            const nj = nodes[j]!;
            const dx = nj.x - ni.x || 0.01;
            const dy = nj.y - ni.y || 0.01;
            const d2 = dx * dx + dy * dy;
            const d  = Math.sqrt(d2) || 1;
            const f  = REPULSION / d2;
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            if (!ni.pinned) { ni.vx -= fx; ni.vy -= fy; }
            if (!nj.pinned) { nj.vx += fx; nj.vy += fy; }
        }
    }

    // Spring on edges
    for (const lnk of links) {
        const si = idxMap[lnk.source];
        const ti = idxMap[lnk.target];
        if (si === undefined || ti === undefined) continue;
        const src = nodes[si];
        const tgt = nodes[ti];
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x || 0.01;
        const dy = tgt.y - src.y || 0.01;
        const d  = Math.sqrt(dx * dx + dy * dy) || 1;
        const f  = SPRING_K * (d - REST_LEN);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (!src.pinned) { src.vx += fx; src.vy += fy; }
        if (!tgt.pinned) { tgt.vx -= fx; tgt.vy -= fy; }
    }

    // Sector gravity
    for (const n of nodes) {
        if (n.pinned) continue;
        const s = SECTORS[n.type] ?? DEFAULT_SECTOR;
        n.vx += (s.x - n.x) * GRAVITY;
        n.vy += (s.y - n.y) * GRAVITY;
    }

    // Integrate + clamp
    for (const n of nodes) {
        if (n.pinned) continue;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x = Math.max(NODE_R + 4, Math.min(W - NODE_R - 4, n.x + n.vx));
        n.y = Math.max(NODE_R + 4, Math.min(H - NODE_R - 4, n.y + n.vy));
    }
}

// ── Risk colors for nodes ────────────────────────────────────────────
const RISK_STROKE: Record<string, string> = {
    critical: '#dc2626',
    high:     '#ea580c',
    medium:   '#ca8a04',
    low:      '#2563eb',
    none:     'transparent',
};

// ── Component ────────────────────────────────────────────────────────
interface Props {
    entities: WSEntity[];
    links:    WSLink[];
}

export function WorldStateGraph({ entities, links }: Props) {
    const svgRef  = useRef<SVGSVGElement>(null);
    const nodesRef = useRef<SimNode[]>([]);
    const rafRef   = useRef<number>(0);
    const dragRef  = useRef<{ id: string; ox: number; oy: number } | null>(null);
    const panRef   = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);

    const [transform, setTransform] = useState({ tx: 0, ty: 0, scale: 1 });
    const [, setTick] = useState(0);
    const [selected, setSelected] = useState<SimNode | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // Re-init simulation when entities change
    useEffect(() => {
        nodesRef.current = initNodes(entities);
        setSelected(null);
        let step = 0;
        const run = () => {
            for (let i = 0; i < 3; i++) tickOnce(nodesRef.current, links);
            step++;
            setTick(step);
            if (step < 120) rafRef.current = requestAnimationFrame(run);
        };
        rafRef.current = requestAnimationFrame(run);
        return () => cancelAnimationFrame(rafRef.current);
    }, [entities, links]);

    // Zoom
    const onWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setTransform((t) => ({
            ...t,
            scale: Math.max(0.3, Math.min(3, t.scale * delta)),
        }));
    }, []);

    // Pan (background drag)
    const onBgMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as SVGElement).dataset['node']) return;
        panRef.current = { startX: e.clientX, startY: e.clientY, tx: transform.tx, ty: transform.ty };
    }, [transform]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        // Node drag
        if (dragRef.current) {
            const svgRect = svgRef.current?.getBoundingClientRect();
            if (!svgRect) return;
            const mx = (e.clientX - svgRect.left - transform.tx) / transform.scale;
            const my = (e.clientY - svgRect.top  - transform.ty) / transform.scale;
            const node = nodesRef.current.find((n) => n.id === dragRef.current!.id);
            if (node) { node.x = mx; node.y = my; node.vx = 0; node.vy = 0; }
            setTick((t) => t + 1);
            return;
        }
        // Pan
        if (panRef.current) {
            const dx = e.clientX - panRef.current.startX;
            const dy = e.clientY - panRef.current.startY;
            setTransform((t) => ({ ...t, tx: panRef.current!.tx + dx, ty: panRef.current!.ty + dy }));
        }
    }, [transform]);

    const onMouseUp = useCallback(() => {
        if (dragRef.current) {
            const node = nodesRef.current.find((n) => n.id === dragRef.current!.id);
            if (node) node.pinned = false;
            dragRef.current = null;
        }
        panRef.current = null;
    }, []);

    const onNodeMouseDown = useCallback((e: React.MouseEvent, node: SimNode) => {
        e.stopPropagation();
        node.pinned = true;
        dragRef.current = { id: node.id, ox: e.clientX - node.x, oy: e.clientY - node.y };
    }, []);

    const onNodeClick = useCallback((e: React.MouseEvent, node: SimNode) => {
        e.stopPropagation();
        setSelected((prev) => prev?.id === node.id ? null : { ...node });
    }, []);

    const nodes = nodesRef.current;
    const { tx, ty, scale } = transform;

    // Filter edges to only those with both endpoints present
    const visibleLinks = links.filter((l) =>
        nodes.some((n) => n.id === l.source) && nodes.some((n) => n.id === l.target),
    );

    return (
        <div className="relative flex h-[560px] w-full overflow-hidden rounded-lg border bg-background">
            {/* Graph SVG */}
            <svg
                className="flex-1 cursor-grab select-none active:cursor-grabbing"
                height={H}
                onMouseDown={onBgMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onWheel={onWheel}
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
            >
                <g transform={`translate(${tx},${ty}) scale(${scale})`}>
                    {/* Sector background blobs */}
                    {Object.entries(SECTORS).map(([type, s]) => (
                        <g key={type}>
                            <ellipse
                                cx={s.x} cy={s.y} rx={130} ry={100}
                                fill={s.bg} stroke="none"
                            />
                            <text
                                x={s.x} y={s.y - 94}
                                fill={s.textColor}
                                fontSize="10"
                                fontWeight="600"
                                textAnchor="middle"
                                opacity="0.8"
                            >
                                {s.label}
                            </text>
                        </g>
                    ))}

                    {/* Edges */}
                    {visibleLinks.map((lnk) => {
                        const src = nodes.find((n) => n.id === lnk.source);
                        const tgt = nodes.find((n) => n.id === lnk.target);
                        if (!src || !tgt) return null;
                        const mx = (src.x + tgt.x) / 2;
                        const my = (src.y + tgt.y) / 2;
                        const highlight = hoveredId === lnk.source || hoveredId === lnk.target;
                        return (
                            <g key={lnk.id}>
                                <line
                                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                                    stroke={highlight ? '#64748b' : '#cbd5e1'}
                                    strokeWidth={highlight ? 1.5 : 1}
                                    opacity={highlight ? 0.8 : 0.4}
                                />
                                {lnk.label && highlight && (
                                    <text x={mx} y={my - 3} fontSize="7" fill="#94a3b8" textAnchor="middle">
                                        {lnk.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map((n) => {
                        const s = SECTORS[n.type] ?? DEFAULT_SECTOR;
                        const isSelected = selected?.id === n.id;
                        const isHovered  = hoveredId === n.id;
                        const risk = n.riskLevel || 'none';
                        return (
                            <g
                                key={n.id}
                                transform={`translate(${n.x},${n.y})`}
                                style={{ cursor: 'pointer' }}
                                data-node="1"
                                onMouseDown={(e) => onNodeMouseDown(e, n)}
                                onClick={(e) => onNodeClick(e, n)}
                                onMouseEnter={() => setHoveredId(n.id)}
                                onMouseLeave={() => setHoveredId(null)}
                            >
                                {/* Selection glow */}
                                {(isSelected || isHovered) && (
                                    <circle r={NODE_R + 5} fill={s.nodeColor} opacity={0.18} />
                                )}
                                {/* Risk ring */}
                                {risk !== 'none' && (
                                    <circle r={NODE_R + 3} fill="none" stroke={RISK_STROKE[risk]} strokeWidth={2} opacity={0.7} />
                                )}
                                {/* Main circle */}
                                <circle
                                    r={NODE_R}
                                    fill={isSelected ? s.nodeColor : `${s.nodeColor}dd`}
                                    stroke={isSelected ? '#fff' : s.nodeColor}
                                    strokeWidth={isSelected ? 2 : 1}
                                />
                                {/* Type icon (first letter) */}
                                <text
                                    dominantBaseline="central"
                                    fill="#fff"
                                    fontSize="9"
                                    fontWeight="700"
                                    textAnchor="middle"
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {n.type.slice(0, 1).toUpperCase()}
                                </text>
                                {/* Label below */}
                                <text
                                    y={NODE_R + 10}
                                    dominantBaseline="hanging"
                                    fill={isSelected ? s.nodeColor : '#334155'}
                                    fontSize="8.5"
                                    fontWeight={isSelected ? '700' : '500'}
                                    textAnchor="middle"
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {n.label.length > 18 ? n.label.slice(0, 18) + '…' : n.label}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>

            {/* Detail panel */}
            {selected && (
                <div className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l bg-background p-4 text-xs">
                    <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-foreground leading-snug">{selected.label}</p>
                        <button
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setSelected(null)}
                            type="button"
                        >×</button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                            {selected.type}
                        </span>
                        {selected.riskLevel !== 'none' && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${WS_RISK_CLS[selected.riskLevel] ?? ''}`}>
                                {selected.riskLevel}
                            </span>
                        )}
                    </div>

                    {selected.metadata?.summary && (
                        <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                            <p className="text-[11px] leading-relaxed text-foreground">{selected.metadata.summary}</p>
                        </div>
                    )}

                    {selected.metadata?.labels && (
                        <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Labels</p>
                            <div className="flex flex-wrap gap-1">
                                {selected.metadata.labels.split(',').map((l) => (
                                    <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{l}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Connections */}
                    {(() => {
                        const connected = links
                            .filter((l) => l.source === selected.id || l.target === selected.id)
                            .map((l) => {
                                const otherId = l.source === selected.id ? l.target : l.source;
                                const other = entities.find((e) => e.id === otherId);
                                return { link: l, other };
                            })
                            .filter((c) => c.other);
                        if (!connected.length) return null;
                        return (
                            <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Connections ({connected.length})
                                </p>
                                <div className="flex flex-col gap-1">
                                    {connected.slice(0, 8).map(({ link, other }) => (
                                        <button
                                            key={link.id}
                                            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-muted"
                                            onClick={() => {
                                                const node = nodesRef.current.find((n) => n.id === other!.id);
                                                if (node) setSelected({ ...node });
                                            }}
                                            type="button"
                                        >
                                            <span className="text-[10px] text-muted-foreground">{link.label ?? '→'}</span>
                                            <span className="truncate text-[10px] font-medium text-foreground">{other!.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-2 left-2 flex flex-col gap-0.5 rounded-lg border bg-background/90 px-2.5 py-2 text-[9px] backdrop-blur">
                {Object.entries(SECTORS).map(([type, s]) => (
                    <div key={type} className="flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full" style={{ backgroundColor: s.nodeColor }} />
                        <span className="text-muted-foreground">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Controls hint */}
            <div className="absolute bottom-2 right-2 text-[9px] text-muted-foreground">
                scroll to zoom · drag to pan · click node to inspect
            </div>
        </div>
    );
}

// re-export risk classes so graph can use them
export const WS_RISK_CLS: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high:     'bg-orange-100 text-orange-700 border-orange-200',
    medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    low:      'bg-blue-100 text-blue-600 border-blue-200',
    none:     'bg-slate-100 text-slate-600 border-slate-200',
};
