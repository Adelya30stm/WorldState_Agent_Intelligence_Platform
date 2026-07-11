import { useEffect, useRef, useState } from 'react';
import { WorldStateEntity, WorldStateLink } from '@/lib/api';
import { RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
    entities: WorldStateEntity[];
    links: WorldStateLink[];
    loading: boolean;
    onRefresh: () => void;
}

const NODE_COLORS: Record<string, string> = {
    host: '#6366f1',
    service: '#0ea5e9',
    vulnerability: '#ef4444',
    credential: '#f59e0b',
    network: '#10b981',
    user: '#8b5cf6',
    domain: '#ec4899',
    default: '#64748b',
};

const RISK_GLOW: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

interface SimNode extends WorldStateEntity {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

function runLayout(nodes: SimNode[], links: WorldStateLink[], w: number, h: number) {
    const cx = w / 2, cy = h / 2;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (let iter = 0; iter < 80; iter++) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                const force = 3000 / (dist * dist);
                const fx = (dx / dist) * force, fy = (dy / dist) * force;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
            }
        }
        // Attraction along links
        for (const link of links) {
            const a = nodeMap.get(link.source), b = nodeMap.get(link.target);
            if (!a || !b) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
            const target = 120;
            const force = (dist - target) * 0.03;
            const fx = (dx / dist) * force, fy = (dy / dist) * force;
            a.vx += fx; a.vy += fy;
            b.vx -= fx; b.vy -= fy;
        }
        // Gravity toward center
        for (const n of nodes) {
            n.vx += (cx - n.x) * 0.005;
            n.vy += (cy - n.y) * 0.005;
        }
        // Integrate
        const damping = 0.7;
        for (const n of nodes) {
            n.x += n.vx * damping;
            n.y += n.vy * damping;
            n.vx *= 0.6;
            n.vy *= 0.6;
            n.x = Math.max(40, Math.min(w - 40, n.x));
            n.y = Math.max(40, Math.min(h - 40, n.y));
        }
    }
}

export function WorldStateGraph({ entities, links, loading, onRefresh }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [selected, setSelected] = useState<WorldStateEntity | null>(null);
    const nodesRef = useRef<SimNode[]>([]);
    const [size, setSize] = useState({ w: 800, h: 500 });

    // Observe container size
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setSize({ w: width, h: height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Recalculate layout when entities change
    useEffect(() => {
        const { w, h } = size;
        const nodes: SimNode[] = entities.map((e, i) => {
            const existing = nodesRef.current.find(n => n.id === e.id);
            return {
                ...e,
                x: existing?.x ?? w / 2 + (Math.random() - 0.5) * 200,
                y: existing?.y ?? h / 2 + (Math.random() - 0.5) * 200,
                vx: 0,
                vy: 0,
            };
        });
        runLayout(nodes, links, w, h);
        nodesRef.current = nodes;
        draw();
    }, [entities, links, size, zoom]);

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { w, h } = size;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.save();

        const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]));

        // Draw links
        for (const link of links) {
            const a = nodeMap.get(link.source), b = nodeMap.get(link.target);
            if (!a || !b) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = 'rgba(99,102,241,0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Arrow
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            ctx.beginPath();
            ctx.moveTo(mx + Math.cos(angle) * 6, my + Math.sin(angle) * 6);
            ctx.lineTo(mx + Math.cos(angle - 2.4) * 5, my + Math.sin(angle - 2.4) * 5);
            ctx.lineTo(mx + Math.cos(angle + 2.4) * 5, my + Math.sin(angle + 2.4) * 5);
            ctx.closePath();
            ctx.fillStyle = 'rgba(99,102,241,0.5)';
            ctx.fill();

            if (link.label) {
                ctx.font = '9px Inter, sans-serif';
                ctx.fillStyle = 'rgba(148,163,184,0.8)';
                ctx.fillText(link.label, mx + 4, my - 4);
            }
        }

        // Draw nodes
        for (const node of nodesRef.current) {
            const color = NODE_COLORS[node.type] ?? NODE_COLORS.default;
            const glow = node.riskLevel ? RISK_GLOW[node.riskLevel] : null;
            const isSelected = selected?.id === node.id;
            const r = isSelected ? 22 : 18;

            // Glow
            if (glow) {
                const grad = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 2);
                grad.addColorStop(0, glow + '55');
                grad.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.arc(node.x, node.y, r * 2, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fillStyle = color + (isSelected ? 'ff' : 'cc');
            ctx.fill();
            if (isSelected) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Label
            ctx.font = `${isSelected ? 'bold ' : ''}11px Inter, sans-serif`;
            ctx.fillStyle = '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.fillText(node.label, node.x, node.y + r + 14);
            ctx.textAlign = 'left';

            // Type badge
            ctx.font = '9px Inter, sans-serif';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.fillText(node.type.toUpperCase(), node.x, node.y + 4);
            ctx.textAlign = 'left';
        }

        ctx.restore();
    }

    function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        for (const node of nodesRef.current) {
            const dx = mx - node.x, dy = my - node.y;
            if (Math.sqrt(dx * dx + dy * dy) < 22) {
                setSelected(prev => prev?.id === node.id ? null : node);
                return;
            }
        }
        setSelected(null);
    }

    const isEmpty = entities.length === 0 && !loading;

    return (
        <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-indigo-900/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-900/30">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-sm font-semibold text-slate-200">World State Graph</span>
                    {entities.length > 0 && (
                        <span className="text-xs text-slate-500">{entities.length} entities · {links.length} links</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setZoom(z => Math.min(z + 0.2, 2))} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                        <ZoomIn size={14} />
                    </button>
                    <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                        <ZoomOut size={14} />
                    </button>
                    <button onClick={onRefresh} disabled={loading} className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors disabled:opacity-40">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div ref={containerRef} className="relative flex-1">
                {isEmpty ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-3">
                        <Maximize2 size={32} className="opacity-30" />
                        <p className="text-sm">No world state yet</p>
                        <p className="text-xs">Appears after agents start discovering assets</p>
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        width={size.w}
                        height={size.h}
                        onClick={handleClick}
                        className="cursor-pointer w-full h-full"
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                    />
                )}

                {/* Selected node detail */}
                {selected && (
                    <div className="absolute bottom-4 left-4 right-4 bg-[#161b22] border border-indigo-900/50 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS[selected.type] ?? NODE_COLORS.default }} />
                                <span className="font-semibold text-white">{selected.label}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300">{selected.type}</span>
                            </div>
                            {selected.riskLevel && (
                                <span className="text-xs font-medium" style={{ color: RISK_GLOW[selected.riskLevel] ?? '#94a3b8' }}>
                                    {selected.riskLevel.toUpperCase()} RISK
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {Object.entries(selected.metadata ?? {}).slice(0, 6).map(([k, v]) => (
                                <div key={k} className="text-xs">
                                    <span className="text-slate-500">{k}: </span>
                                    <span className="text-slate-300 font-mono">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 px-4 py-2 border-t border-indigo-900/30 overflow-x-auto">
                {Object.entries(NODE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5 shrink-0">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-[10px] text-slate-500">{type}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
