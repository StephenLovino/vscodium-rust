import React, { useEffect, useState, useRef, useCallback } from 'react';
import { invoke } from '../tauri_bridge';
import { useStore } from '../store';

interface GitCommit {
    hash: string;
    author: string;
    date: string;
    message: string;
    parents: string[];
}

// ── Force-directed graph types ──
interface GraphNode {
    id: string;
    commit: GitCommit;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    radius: number;
    pinned: boolean;
}

interface GraphEdge {
    source: string;
    target: string;
    color: string;
}

const COLORS = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
    '#06b6d4', '#f43f5e', '#84cc16', '#6366f1', '#14b8a6',
    '#e879f9', '#fb923c', '#38bdf8', '#a3e635', '#c084fc'
];

function strHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h);
}

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
}

function timeAgo(d: string): string {
    try {
        if (!d) return '';
        // git's %ai is "2026-03-24 14:32:01 +0800"
        // Chrome/Safari handles this well, but let's be safe
        const dt = new Date(d.replace(' ', 'T'));
        const diff = Date.now() - dt.getTime();
        if (isNaN(diff)) return '';
        
        const s = Math.floor(diff / 1000);
        if (s < 60) return `${s}s ago`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        const days = Math.floor(h / 24);
        if (days === 0) return `${h}h ago`;
        if (days < 30) return `${days}d ${h % 24}h ago`;
        return `${Math.floor(days / 30)}mo ago`;
    } catch { return ''; }
}

// ── Force simulation ──
function runForceSimulation(
    nodes: GraphNode[],
    edges: GraphEdge[],
    width: number,
    height: number,
    iterations: number = 120,
    style: 'force' | 'maltego' = 'force'
) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const REPULSION = style === 'maltego' ? 5000 : 3500;
    const ATTRACTION = style === 'maltego' ? 0.015 : 0.008;
    const DAMPING = 0.85;
    const CENTER_GRAVITY = 0.01;
    const cx = width / 2;
    const cy = height / 2;

    for (let iter = 0; iter < iterations; iter++) {
        const temp = 1 - iter / iterations; // cooling

        // Repulsion (all pairs)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (REPULSION * temp) / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
                if (!b.pinned) { b.vx += fx; b.vy += fy; }
            }
        }

        // Attraction (edges)
        for (const edge of edges) {
            const a = nodeMap.get(edge.source);
            const b = nodeMap.get(edge.target);
            if (!a || !b) continue;
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = dist * ATTRACTION * temp;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (!a.pinned) { a.vx += fx; a.vy += fy; }
            if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
        }

        // Center gravity
        for (const n of nodes) {
            if (n.pinned) continue;
            n.vx += (cx - n.x) * CENTER_GRAVITY * temp;
            n.vy += (cy - n.y) * CENTER_GRAVITY * temp;
        }

        // Apply velocities
        for (const n of nodes) {
            if (n.pinned) continue;
            n.vx *= DAMPING;
            n.vy *= DAMPING;
            n.x += n.vx;
            n.y += n.vy;
            // Keep in bounds
            n.x = Math.max(40, Math.min(width - 40, n.x));
            n.y = Math.max(40, Math.min(height - 40, n.y));
        }
    }
}

const GitGraph: React.FC = () => {
    const [history, setHistory] = useState<GitCommit[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedHash, setSelectedHash] = useState<string | null>(null);
    const [hoveredHash, setHoveredHash] = useState<string | null>(null);
    const [dragNode, setDragNode] = useState<string | null>(null);
    const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
    const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [layout, setLayout] = useState<'force' | 'tree' | 'maltego'>('force');
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeRoot = useStore(state => state.activeRoot);

    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true);
            const data = await invoke<GitCommit[]>('get_git_history', { path: activeRoot || "." });
            setHistory(data.slice(0, 50));
        } catch (e) {
            console.error("Git history error:", e);
        } finally {
            setLoading(false);
        }
    }, [activeRoot]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Build graph when history or layout changes
    useEffect(() => {
        if (history.length === 0) return;
        const rect = containerRef.current?.getBoundingClientRect();
        const w = rect?.width || 500;
        const h = rect?.height || 600;

        // Create nodes
        let nodes: GraphNode[] = history.map((commit, i) => {
            const authorColor = COLORS[strHash(commit.author) % COLORS.length];
            return {
                id: commit.hash,
                commit,
                x: w/2, y: h/2,
                vx: 0, vy: 0,
                color: authorColor,
                radius: commit.parents.length > 1 ? 18 : 14,
                pinned: false
            };
        });

        // Create edges
        const edges: GraphEdge[] = [];
        for (const node of nodes) {
            for (const parentHash of node.commit.parents) {
                const parent = nodes.find(n =>
                    n.id.startsWith(parentHash) || parentHash.startsWith(n.id.substring(0, 7))
                );
                if (parent) {
                    edges.push({
                        source: node.id,
                        target: parent.id,
                        color: node.color
                    });
                }
            }
        }

        // Apply distinct layout algorithms
        if (layout === 'tree') {
            // Topological sort/Depth calculation for Tree
            const depthMap = new Map<string, number>();
            const calcDepth = (id: string, d: number) => {
                if ((depthMap.get(id) || -1) >= d) return;
                depthMap.set(id, d);
                const children = edges.filter(e => e.target === id).map(e => e.source);
                children.forEach(c => calcDepth(c, d + 1));
            };
            
            // Assume first node is HEAD (0 depth)
            if (nodes[0]) {
                const visited = new Set<string>();
                const stack: [string, number][] = [[nodes[0].id, 0]];
                while(stack.length) {
                    const [curr, d] = stack.pop()!;
                    if (visited.has(curr)) continue;
                    visited.add(curr);
                    depthMap.set(curr, Math.max(depthMap.get(curr) || 0, d));
                    edges.filter(e => e.source === curr).forEach(e => stack.push([e.target, d + 1]));
                }
            }

            const nodesByDepth: { [d: number]: string[] } = {};
            nodes.forEach(n => {
                const d = depthMap.get(n.id) || 0;
                if (!nodesByDepth[d]) nodesByDepth[d] = [];
                nodesByDepth[d].push(n.id);
            });

            nodes = nodes.map(n => {
                const d = depthMap.get(n.id) || 0;
                const siblings = nodesByDepth[d];
                const idx = siblings.indexOf(n.id);
                const x = (w / (siblings.length + 1)) * (idx + 1);
                const y = 60 + d * 80;
                return { ...n, x, y, pinned: true };
            });
        } else {
            // Initial placement for force/maltego
            nodes = nodes.map((n, i) => {
                const angle = i * (layout === 'maltego' ? 0.3 : 0.6);
                const r = 50 + i * (layout === 'maltego' ? 12 : 8);
                return {
                    ...n,
                    x: w / 2 + r * Math.cos(angle),
                    y: h / 2 + r * Math.sin(angle)
                };
            });
            runForceSimulation(nodes, edges, w, h, 200, layout === 'maltego' ? 'maltego' : 'force');
        }

        setGraphNodes(nodes);
        setGraphEdges(edges);
        setPan({ x: 0, y: 0 });
        setZoom(1);
    }, [history, layout]);

    // ── Drag handling ──
    const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        setDragNode(nodeId);
        setSelectedHash(nodeId);
    };

    const handleSvgMouseDown = (e: React.MouseEvent) => {
        if (dragNode) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (dragNode) {
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const x = (e.clientX - rect.left - pan.x) / zoom;
            const y = (e.clientY - rect.top - pan.y) / zoom;
            setGraphNodes(prev => prev.map(n =>
                n.id === dragNode ? { ...n, x, y, pinned: true } : n
            ));
        } else if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        }
    }, [dragNode, isPanning, pan, zoom, panStart]);

    const handleMouseUp = useCallback(() => {
        setDragNode(null);
        setIsPanning(false);
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
    }, []);

    const selectedNode = graphNodes.find(n => n.id === selectedHash);
    const nodeMap = new Map(graphNodes.map(n => [n.id, n]));

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, fontSize: 12, opacity: 0.6 }}>
            <div style={{ width: 16, height: 16, border: '2px solid var(--vscode-focusBorder)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Building graph…
        </div>
    );

    if (history.length === 0) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
            <i className="codicon codicon-git-commit" style={{ fontSize: 36, marginBottom: 10 }} />
            <div style={{ fontSize: 12 }}>No commits found</div>
        </div>
    );

    return (
        <div ref={containerRef} style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: '#1a1a2e', position: 'relative', overflow: 'hidden'
        }}>
            {/* ── Canvas toolbar ── */}
            <div style={{
                position: 'absolute', top: 8, left: 8, zIndex: 10,
                display: 'flex', gap: 6, background: 'rgba(0,0,0,0.5)',
                padding: '4px 6px', borderRadius: 8, backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: 2 }}>
                    {[
                        { id: 'force', icon: 'hubot', label: 'Force' },
                        { id: 'tree', icon: 'list-tree', label: 'Tree' },
                        { id: 'maltego', icon: 'organization', label: 'Maltego' }
                    ].map(opt => (
                        <button key={opt.id}
                            onClick={() => setLayout(opt.id as any)}
                            title={opt.label}
                            style={{
                                background: layout === opt.id ? 'rgba(59, 130, 246, 0.4)' : 'transparent',
                                border: 'none', color: layout === opt.id ? '#fff' : 'rgba(255,255,255,0.5)',
                                padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11,
                                display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s'
                            }}>
                            <i className={`codicon codicon-${opt.icon}`} style={{ fontSize: 12 }}></i>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{
                position: 'absolute', top: 8, right: 8, zIndex: 10,
                display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)',
                padding: '4px 6px', borderRadius: 8, backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <button onClick={() => setZoom(z => Math.min(3, z * 1.2))}
                    title="Zoom In"
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>+</button>
                <button onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
                    title="Zoom Out"
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>−</button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                    title="Reset View"
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>⟲</button>
            </div>

            {/* ── SVG Canvas ── */}
            <svg ref={svgRef}
                style={{ flex: 1, cursor: isPanning ? 'grabbing' : dragNode ? 'grabbing' : 'grab', width: '100%' }}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                {/* Background grid */}
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <circle cx="20" cy="20" r="0.5" fill="rgba(255,255,255,0.06)" />
                    </pattern>
                    {/* Glow filter */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Arrow marker */}
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.2)" />
                    </marker>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* ── Edges ── */}
                    {graphEdges.map((edge, i) => {
                        const source = nodeMap.get(edge.source);
                        const target = nodeMap.get(edge.target);
                        if (!source || !target) return null;

                        const dx = target.x - source.x;
                        const dy = target.y - source.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                        // Shorten line by node radius
                        const sx = source.x + (dx / dist) * source.radius;
                        const sy = source.y + (dy / dist) * source.radius;
                        const tx = target.x - (dx / dist) * target.radius;
                        const ty = target.y - (dy / dist) * target.radius;

                        const isHighlighted = selectedHash === edge.source || selectedHash === edge.target;

                        // Curved edge
                        const midX = (sx + tx) / 2 + (dy / dist) * 20;
                        const midY = (sy + ty) / 2 - (dx / dist) * 20;

                        return (
                            <path key={i}
                                d={`M${sx},${sy} Q${midX},${midY} ${tx},${ty}`}
                                stroke={edge.color}
                                strokeWidth={isHighlighted ? 2.5 : 1.5}
                                opacity={isHighlighted ? 0.7 : 0.2}
                                fill="none"
                                markerEnd="url(#arrowhead)"
                                style={{ transition: 'opacity 0.2s' }}
                            />
                        );
                    })}

                    {/* ── Nodes ── */}
                    {graphNodes.map(node => {
                        const isSelected = selectedHash === node.id;
                        const isHovered = hoveredHash === node.id;
                        const isConnected = graphEdges.some(e =>
                            (e.source === selectedHash && e.target === node.id) ||
                            (e.target === selectedHash && e.source === node.id)
                        );
                        const r = node.radius;
                        const active = isSelected || isHovered || isConnected;

                        return (
                            <g key={node.id}
                                onMouseDown={(e) => handleMouseDown(e, node.id)}
                                onMouseEnter={() => setHoveredHash(node.id)}
                                onMouseLeave={() => setHoveredHash(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Outer glow */}
                                {active && (
                                    <circle cx={node.x} cy={node.y} r={r + 8}
                                        fill="none" stroke={node.color}
                                        strokeWidth="2" opacity={isSelected ? 0.5 : 0.25}
                                        filter="url(#glow)"
                                    />
                                )}

                                {/* Node body */}
                                <circle cx={node.x} cy={node.y} r={r}
                                    fill={isSelected ? node.color : '#252540'}
                                    stroke={node.color}
                                    strokeWidth={isSelected ? 3 : 2}
                                    opacity={active || !selectedHash ? 1 : 0.4}
                                    style={{ transition: 'opacity 0.2s, fill 0.15s' }}
                                />

                                {/* Author initials */}
                                <text x={node.x} y={node.y + 1}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fontSize={r > 16 ? 10 : 8} fontWeight="700"
                                    fill={isSelected ? '#fff' : node.color}
                                    opacity={active || !selectedHash ? 1 : 0.4}
                                    style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: '-apple-system, system-ui, sans-serif' }}
                                >
                                    {initials(node.commit.author)}
                                </text>

                                {/* Hash label */}
                                {(active || zoom > 1.2) && (
                                    <text x={node.x} y={node.y + r + 12}
                                        textAnchor="middle" fontSize="9"
                                        fill={node.color} opacity="0.7"
                                        style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
                                    >
                                        {node.commit.hash.substring(0, 7)}
                                    </text>
                                )}

                                {/* Commit message tooltip on hover */}
                                {isHovered && !isSelected && (
                                    <g>
                                        <rect x={node.x + r + 8} y={node.y - 20}
                                            width={Math.min(node.commit.message.split('\n')[0].length * 6.5 + 16, 220)}
                                            height={36} rx={6}
                                            fill="rgba(0,0,0,0.85)" stroke={node.color} strokeWidth="1"
                                        />
                                        <text x={node.x + r + 16} y={node.y - 5}
                                            fontSize="10" fill="#fff"
                                            style={{ pointerEvents: 'none', fontFamily: '-apple-system, system-ui, sans-serif' }}
                                        >
                                            {node.commit.message.split('\n')[0].substring(0, 32)}
                                            {node.commit.message.split('\n')[0].length > 32 ? '…' : ''}
                                        </text>
                                        <text x={node.x + r + 16} y={node.y + 8}
                                            fontSize="9" fill="rgba(255,255,255,0.4)"
                                            style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
                                        >
                                            {node.commit.author.split(' ')[0]} · {timeAgo(node.commit.date)}
                                        </text>
                                    </g>
                                )}

                                {/* Merge badge */}
                                {node.commit.parents.length > 1 && (
                                    <g>
                                        <circle cx={node.x + r - 2} cy={node.y - r + 2}
                                            r={5} fill="#a78bfa" stroke="#1a1a2e" strokeWidth="1.5" />
                                        <text x={node.x + r - 2} y={node.y - r + 3}
                                            textAnchor="middle" dominantBaseline="middle"
                                            fontSize="7" fill="#fff" fontWeight="700"
                                            style={{ pointerEvents: 'none' }}
                                        >M</text>
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>

            {/* ── Selected node detail panel ── */}
            {selectedNode && (
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(15, 15, 30, 0.95)',
                    backdropFilter: 'blur(12px)',
                    borderTop: `2px solid ${selectedNode.color}`,
                    padding: '12px 14px',
                    maxHeight: '40%',
                    overflowY: 'auto',
                    zIndex: 20,
                    animation: 'slideUp 0.2s ease-out'
                }}>
                    <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: `linear-gradient(135deg, ${selectedNode.color}, ${selectedNode.color}80)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, color: '#fff',
                                boxShadow: `0 0 12px ${selectedNode.color}40`
                            }}>
                                {initials(selectedNode.commit.author)}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{selectedNode.commit.author}</div>
                                <div style={{ fontSize: 10, opacity: 0.4 }}>{timeAgo(selectedNode.commit.date)}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <code style={{
                                background: `${selectedNode.color}25`, color: selectedNode.color,
                                padding: '3px 10px', borderRadius: 12,
                                fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                                border: `1px solid ${selectedNode.color}30`
                            }}>
                                {selectedNode.commit.hash.substring(0, 12)}
                            </code>
                            <button onClick={() => setSelectedHash(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                                    width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontSize: 12
                                }}>×</button>
                        </div>
                    </div>

                    {/* Message */}
                    <div style={{
                        fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 6,
                        borderLeft: `3px solid ${selectedNode.color}`
                    }}>
                        {selectedNode.commit.message}
                    </div>

                    {/* Parents */}
                    {selectedNode.commit.parents.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 10, opacity: 0.4 }}>
                            <span>{selectedNode.commit.parents.length > 1 ? '⤴ Merge →' : 'Parent →'}</span>
                            {selectedNode.commit.parents.map((p, i) => (
                                <code key={i}
                                    onClick={() => setSelectedHash(p)}
                                    style={{
                                        background: 'rgba(255,255,255,0.06)', padding: '2px 8px',
                                        borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace'
                                    }}
                                >{p.substring(0, 7)}</code>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GitGraph;
