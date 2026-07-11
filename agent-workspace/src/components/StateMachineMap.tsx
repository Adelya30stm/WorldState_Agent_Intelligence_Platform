import { AgentStatus } from '@/hooks/useAgentTransitions';

interface Props {
    currentStates: Record<string, AgentStatus>;
}

// Valid transitions in the agent state machine
const STATES: AgentStatus[] = ['created', 'waiting', 'running', 'finished', 'failed'];
const TRANSITIONS: [AgentStatus, AgentStatus][] = [
    ['created', 'waiting'],
    ['created', 'running'],
    ['created', 'failed'],
    ['waiting', 'running'],
    ['waiting', 'failed'],
    ['running', 'finished'],
    ['running', 'failed'],
    ['running', 'waiting'],
    ['finished', 'running'], // retry
];

const STATE_POS: Record<AgentStatus, { x: number; y: number }> = {
    created:  { x: 50,  y: 50  },
    waiting:  { x: 200, y: 20  },
    running:  { x: 200, y: 80  },
    finished: { x: 350, y: 50  },
    failed:   { x: 350, y: 110 },
};

const STATE_COLOR: Record<AgentStatus, string> = {
    created:  '#64748b',
    waiting:  '#d97706',
    running:  '#0284c7',
    finished: '#059669',
    failed:   '#dc2626',
};

export function StateMachineMap({ currentStates }: Props) {
    const W = 420, H = 150;
    const activeStates = new Set(Object.values(currentStates));

    return (
        <div className="bg-[#0d1117] rounded-xl border border-indigo-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-indigo-900/30">
                <p className="text-sm font-semibold text-slate-200">Agent State Machine</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Valid transitions · active states highlighted</p>
            </div>
            <div className="px-4 py-4">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '160px' }}>
                    <defs>
                        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="rgba(99,102,241,0.5)" />
                        </marker>
                        <marker id="arrow-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#6366f1" />
                        </marker>
                    </defs>

                    {/* Edges */}
                    {TRANSITIONS.map(([from, to], i) => {
                        const a = STATE_POS[from], b = STATE_POS[to];
                        const isActive = activeStates.has(from) || activeStates.has(to);
                        const dx = b.x - a.x, dy = b.y - a.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const r = 14;
                        const sx = a.x + (dx / len) * r;
                        const sy = a.y + (dy / len) * r;
                        const ex = b.x - (dx / len) * r;
                        const ey = b.y - (dy / len) * r;
                        const mx = (sx + ex) / 2 - (dy / len) * 15;
                        const my = (sy + ey) / 2 + (dx / len) * 15;
                        return (
                            <path
                                key={i}
                                d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`}
                                stroke={isActive ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.2)'}
                                strokeWidth={isActive ? 1.5 : 1}
                                fill="none"
                                markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
                            />
                        );
                    })}

                    {/* Nodes */}
                    {STATES.map(state => {
                        const pos = STATE_POS[state];
                        const color = STATE_COLOR[state];
                        const isActive = activeStates.has(state);
                        return (
                            <g key={state}>
                                {isActive && (
                                    <circle cx={pos.x} cy={pos.y} r={20} fill={color + '22'} />
                                )}
                                <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={14}
                                    fill={isActive ? color + 'cc' : color + '33'}
                                    stroke={color}
                                    strokeWidth={isActive ? 2 : 1}
                                />
                                <text
                                    x={pos.x}
                                    y={pos.y + 26}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fill={isActive ? '#e2e8f0' : '#64748b'}
                                    fontFamily="Inter, sans-serif"
                                    fontWeight={isActive ? 'bold' : 'normal'}
                                >
                                    {state}
                                </text>
                                {isActive && (
                                    <circle cx={pos.x} cy={pos.y} r={4} fill="white" opacity={0.8} />
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Active agents legend */}
                {Object.keys(currentStates).length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-white/[0.06]">
                        {Object.entries(currentStates).map(([agent, state]) => (
                            <div key={agent} className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLOR[state] }} />
                                <span className="text-[10px] text-slate-500">{agent}</span>
                                <span className="text-[10px]" style={{ color: STATE_COLOR[state] }}>{state}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
