'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { TopologyData, TopologyEdge } from '@/lib/cmdb/domains/types';
import type { Service } from '@/lib/cmdb/services/types';
import { AddLinkDialog } from './add-link-dialog';
import { domainKeys } from '@/lib/cmdb/domains/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const EDGE_STYLES: Record<string, { color: string; dash: string; label: string }> = {
  sync: { color: '#3b82f6', dash: 'none', label: 'Sync' },
  async_command: { color: '#f59e0b', dash: '6,3', label: 'Async Cmd' },
  async_event: { color: '#22c55e', dash: '3,3', label: 'Async Event' }
};

type Pos = { x: number; y: number };

// ── Force-directed layout ──
// Nodes repel each other (Coulomb), edges attract (Hooke), gravity centers.
// Runs in ~80 iterations with cooling. Naturally avoids edge-node crossings
// and node overlaps for graphs with cycles.

function forceLayout(
  services: { id: string }[],
  edges: { source: string; target: string }[],
  virtualW: number,
  virtualH: number
): Pos[] {
  const n = services.length;
  if (n === 0) return [];

  // Random initial positions spread across the virtual space
  const pos: Pos[] = services.map(() => ({
    x: virtualW * 0.15 + Math.random() * virtualW * 0.7,
    y: virtualH * 0.15 + Math.random() * virtualH * 0.7
  }));

  const centerX = virtualW / 2;
  const centerY = virtualH / 2;
  const idealEdgeLen = Math.min(virtualW, virtualH) * 0.3; // target edge length
  const repulsion = 25000;
  const attraction = 0.005;
  const gravity = 0.006;
  const damping = 0.55;
  const iterations = 80;

  // Build undirected adjacency
  const adj = new Map<string, Set<string>>();
  for (const s of services) adj.set(s.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const vel: Pos[] = Array.from({ length: n }, () => ({ x: 0, y: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    const force: Pos[] = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    const cooling = 1 - (iter / iterations) * 0.85;

    // Repulsion: every node repels every other node
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j].x - pos[i].x;
        let dy = pos[j].y - pos[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 5);
        const f = repulsion / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        force[i].x -= fx;
        force[i].y -= fy;
        force[j].x += fx;
        force[j].y += fy;
      }
    }

    // Attraction: edges pull connected nodes together
    for (const e of edges) {
      const si = services.findIndex((s) => s.id === e.source);
      const ti = services.findIndex((s) => s.id === e.target);
      if (si < 0 || ti < 0) continue;
      let dx = pos[ti].x - pos[si].x;
      let dy = pos[ti].y - pos[si].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 5);
      const f = attraction * (dist - idealEdgeLen);
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      force[si].x += fx;
      force[si].y += fy;
      force[ti].x -= fx;
      force[ti].y -= fy;
    }

    // Gravity: pull toward center so graph doesn't drift
    for (let i = 0; i < n; i++) {
      force[i].x += (centerX - pos[i].x) * gravity;
      force[i].y += (centerY - pos[i].y) * gravity;
    }

    // Apply forces with velocity damping
    for (let i = 0; i < n; i++) {
      vel[i].x = (vel[i].x + force[i].x) * damping * cooling;
      vel[i].y = (vel[i].y + force[i].y) * damping * cooling;
      pos[i].x += vel[i].x;
      pos[i].y += vel[i].y;
    }
  }

  // Center the result
  const cx = pos.reduce((s, p) => s + p.x, 0) / n;
  const cy = pos.reduce((s, p) => s + p.y, 0) / n;
  const ox = centerX - cx;
  const oy = centerY - cy;
  for (const p of pos) {
    p.x += ox;
    p.y += oy;
  }

  return pos;
}

export function TopologyView({
  domainId,
  topologyData,
  services = []
}: {
  domainId: string;
  topologyData: TopologyData;
  services?: Service[];
}) {
  const router = useRouter();
  const { edges = [] } = topologyData;

  const nodeW = 100;
  const nodeH = 30;
  const nodeCount = services.length;
  const hasEdges = nodeCount > 0 && edges.length > 0;

  // Force-directed layout — auto-spreads in virtual space, viewBox adapts
  const VIRTUAL_W = 1600;
  const VIRTUAL_H = 1200;

  const [positions, setPositions] = useState<Pos[]>(() =>
    forceLayout(services, edges, VIRTUAL_W, VIRTUAL_H)
  );

  // Compute bounds from actual positions for SVG viewBox
  const padX = 10;
  const padY = 5;
  const contentMinX = Math.min(...positions.map((p) => p.x)) - padX;
  const contentMaxX = Math.max(...positions.map((p) => p.x)) + padX + nodeW;
  const contentMinY = Math.min(...positions.map((p) => p.y)) - padY;
  const contentMaxY = Math.max(...positions.map((p) => p.y)) + padY + nodeH;
  const contentW = Math.max(400, contentMaxX - contentMinX);
  const contentH = Math.max(200, contentMaxY - contentMinY);
  // Add vertical padding to center the tree in the SVG
  const extraV = Math.round(contentH * 0.04);
  const svgW = contentW;
  const svgH = contentH + extraV * 2;
  const viewBoxX = contentMinX;
  const viewBoxY = contentMinY - extraV;

  // ── Drag-to-move state ──
  const dragRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  // ── Link-drag state (drawing a line between nodes) ──
  const [linkDrag, setLinkDrag] = useState<{
    sourceIdx: number;
    mouseX: number;
    mouseY: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );
  const [linkDialog, setLinkDialog] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [editEdge, setEditEdge] = useState<TopologyEdge | null>(null);
  // Per-edge label offset (dx, dy) for dragging labels
  const labelOffsets = useRef<Map<string, { dx: number; dy: number }>>(new Map());
  const labelDragRef = useRef<{
    edgeId: string;
    startX: number;
    startY: number;
    origDx: number;
    origDy: number;
  } | null>(null);
  const queryClient = useQueryClient();

  const deleteLink = useMutation({
    mutationFn: async (edge: TopologyEdge) => {
      const { deleteServiceLink } = await import('@/lib/cmdb/services/service');
      return deleteServiceLink(edge.id, domainId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });
      toast.success('Link deleted');
    },
    onError: () => toast.error('Failed to delete link')
  });

  const updateLink = useMutation({
    mutationFn: async ({
      edge,
      linkType,
      label
    }: {
      edge: TopologyEdge;
      linkType: string;
      label: string;
    }) => {
      const { updateServiceLink } = await import('@/lib/cmdb/services/service');
      return updateServiceLink({
        linkId: edge.id,
        domainId,
        sourceSvcId: edge.source,
        targetSvcId: edge.target,
        linkType: linkType as 'sync' | 'async_command' | 'async_event',
        label
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });
      toast.success('Link updated');
      setEditEdge(null);
    },
    onError: () => toast.error('Failed to update link')
  });

  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // ── Node drag: move ──
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      const pt = getSVGPoint(e);
      dragRef.current = {
        index,
        startX: pt.x,
        startY: pt.y,
        origX: positions[index].x,
        origY: positions[index].y,
        moved: false
      };
    },
    [getSVGPoint, positions]
  );

  // ── Link drag: start from handle ──
  const handleLinkDragStart = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      e.preventDefault();
      const pt = getSVGPoint(e);
      // Store mouse position relative to source node center for direction
      const src = positions[index];
      setLinkDrag({
        sourceIdx: index,
        mouseX: pt.x,
        mouseY: pt.y,
        dx: pt.x - src.x,
        dy: pt.y - src.y
      });
    },
    [getSVGPoint]
  );

  // ── Global mouse move ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pt = getSVGPoint(e);

      // Node drag takes priority over canvas pan
      const drag = dragRef.current;
      if (drag) {
        const dx = pt.x - drag.startX;
        const dy = pt.y - drag.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        setPositions((prev) => {
          const next = [...prev];
          next[drag.index] = { x: drag.origX + dx, y: drag.origY + dy };
          return next;
        });
        return;
      }

      // Canvas pan
      const p = panRef.current;
      if (p) {
        setPan({
          x: p.origX + ((pt.x - p.startX) / scale) * 0.3,
          y: p.origY + ((pt.y - p.startY) / scale) * 0.3
        });
        return;
      }

      // Update label drag
      const ld = labelDragRef.current;
      if (ld) {
        const dx = pt.x - ld.startX;
        const dy = pt.y - ld.startY;
        labelOffsets.current.set(ld.edgeId, { dx: ld.origDx + dx, dy: ld.origDy + dy });
        setEditEdge((prev) => (prev ? { ...prev } : null)); // force re-render
        return;
      }

      // Update link drag line
      if (linkDrag) {
        setLinkDrag((prev) => (prev ? { ...prev, mouseX: pt.x, mouseY: pt.y } : null));
      }
    },
    [getSVGPoint, linkDrag]
  );

  // ── Global mouse up ──
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (drag) {
        if (!drag.moved) {
          router.push(`/dashboard/services/${services[drag.index].id}`);
        }
        dragRef.current = null;
        return;
      }

      // Canvas pan end
      if (panRef.current) {
        panRef.current = null;
        return;
      }

      // Label drag end
      if (labelDragRef.current) {
        labelDragRef.current = null;
        return;
      }

      // Link drag end: find nearest node
      if (linkDrag) {
        const pt = getSVGPoint(e);
        const threshold = 30;
        let targetIdx = -1;
        for (let i = 0; i < positions.length; i++) {
          if (i === linkDrag.sourceIdx) continue;
          const dx = positions[i].x - pt.x;
          const dy = positions[i].y - pt.y;
          if (Math.sqrt(dx * dx + dy * dy) < threshold) {
            targetIdx = i;
            break;
          }
        }
        if (targetIdx >= 0) {
          setLinkDialog({
            sourceId: services[linkDrag.sourceIdx].id,
            targetId: services[targetIdx].id
          });
        }
        setLinkDrag(null);
      }
    },
    [linkDrag, getSVGPoint, positions, services, router]
  );

  const nodeBox = (pos: Pos) => ({
    x: pos.x - nodeW / 2,
    y: pos.y - nodeH / 2,
    w: nodeW,
    h: nodeH
  });

  if (nodeCount === 0) {
    return (
      <div className='flex flex-col items-center py-6 text-center text-muted-foreground'>
        <Icons.stack2 className='h-10 w-10 mb-2 opacity-30' />
        <p className='text-sm'>No services in this domain yet.</p>
      </div>
    );
  }

  return (
    <div className='w-full overflow-x-auto' suppressHydrationWarning>
      {/* Zoom controls */}
      <div className='sticky top-2 left-2 z-10 flex items-center gap-1 w-fit rounded-lg border bg-background/80 backdrop-blur-sm p-1 mb-2'>
        <button
          onClick={() => setScale((s) => Math.max(0.3, s - 0.2))}
          className='p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs'
          title='Zoom out'
        >
          −
        </button>
        <span className='text-xs tabular-nums w-10 text-center text-muted-foreground'>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          className='p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs'
          title='Zoom in'
        >
          +
        </button>
        <button
          onClick={() => setScale(1)}
          className='p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs ml-1'
          title='Reset zoom'
        >
          ⟲
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${viewBoxX + (svgW - svgW / scale) / 2 + pan.x} ${viewBoxY + (svgH - svgH / scale) / 2 + pan.y} ${svgW / scale} ${svgH / scale}`}
        className='w-full h-auto mx-auto select-none'
        xmlns='http://www.w3.org/2000/svg'
        onMouseDown={(e) => {
          // Start canvas pan only on background clicks (not nodes/edges)
          const target = e.target as Element;
          if (target === svgRef.current || target.closest('.canvas-bg')) {
            const pt = getSVGPoint(e);
            panRef.current = { startX: pt.x, startY: pt.y, origX: pan.x, origY: pan.y };
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background rect for canvas pan detection */}
        <rect
          className='canvas-bg'
          x={-svgW}
          y={-svgH}
          width={svgW * 3}
          height={svgH * 3}
          fill='transparent'
        />
        <defs>
          <filter id='sh' x='-20%' y='-20%' width='140%' height='140%'>
            <feDropShadow dx='0' dy='1' stdDeviation='2' floodOpacity='0.12' />
          </filter>
        </defs>

        {/* Temporary link-drag line */}
        {linkDrag &&
          (() => {
            const src = positions[linkDrag.sourceIdx];
            return (
              <line
                x1={
                  src.x +
                  (Math.abs(linkDrag.dx) > Math.abs(linkDrag.dy)
                    ? linkDrag.dx > 0
                      ? nodeW / 2
                      : -nodeW / 2
                    : 0)
                }
                y1={
                  src.y +
                  (Math.abs(linkDrag.dx) > Math.abs(linkDrag.dy)
                    ? 0
                    : linkDrag.dy > 0
                      ? nodeH / 2
                      : -nodeH / 2)
                }
                x2={linkDrag.mouseX}
                y2={linkDrag.mouseY}
                stroke='#94a3b8'
                strokeWidth={2}
                strokeDasharray='6,3'
                style={{ pointerEvents: 'none' }}
              />
            );
          })()}

        {/* ── Nodes ── */}
        {services.map((svc, i) => {
          const pos = positions[i];
          return (
            <g
              key={svc.id}
              filter='url(#sh)'
              onMouseDown={(e) => handleNodeMouseDown(e, i)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={pos.x - nodeW / 2}
                y={pos.y - nodeH / 2}
                width={nodeW}
                height={nodeH}
                rx={10}
                className='fill-card stroke-muted-foreground/30'
                strokeWidth={1.5}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-foreground'
                fontSize='9'
                fontWeight='600'
                pointerEvents='none'
              >
                {svc.name.length > 20 ? svc.name.slice(0, 18) + '…' : svc.name}
              </text>

              {/* 4-direction link-drag dots */}
              <circle
                cx={pos.x + nodeW / 2}
                cy={pos.y}
                r={4}
                className='fill-muted-foreground/20 hover:fill-primary/60'
                stroke='none'
                style={{ cursor: 'crosshair' }}
                onMouseDown={(e) => handleLinkDragStart(e, i)}
              />
              <circle
                cx={pos.x - nodeW / 2}
                cy={pos.y}
                r={4}
                className='fill-muted-foreground/20 hover:fill-primary/60'
                stroke='none'
                style={{ cursor: 'crosshair' }}
                onMouseDown={(e) => handleLinkDragStart(e, i)}
              />
              <circle
                cx={pos.x}
                cy={pos.y - nodeH / 2}
                r={4}
                className='fill-muted-foreground/20 hover:fill-primary/60'
                stroke='none'
                style={{ cursor: 'crosshair' }}
                onMouseDown={(e) => handleLinkDragStart(e, i)}
              />
              <circle
                cx={pos.x}
                cy={pos.y + nodeH / 2}
                r={4}
                className='fill-muted-foreground/20 hover:fill-primary/60'
                stroke='none'
                style={{ cursor: 'crosshair' }}
                onMouseDown={(e) => handleLinkDragStart(e, i)}
              />
            </g>
          );
        })}

        {/* ── Edges + Arrows with multi-link support ── */}
        {hasEdges &&
          (() => {
            // Group edges by source-target pair (undirected key)
            const edgeGroups = new Map<string, typeof edges>();
            for (const edge of edges) {
              // Group by undirected pair (A↔B) so opposite-direction edges spread apart
              const key = [edge.source, edge.target].sort().join('↔');
              const group = edgeGroups.get(key) || [];
              group.push(edge);
              edgeGroups.set(key, group);
            }

            return Array.from(edgeGroups.entries()).flatMap(([_key, groupEdges]) => {
              const first = groupEdges[0];
              const srcIdx = services.findIndex((s) => s.id === first.source);
              const tgtIdx = services.findIndex((s) => s.id === first.target);
              if (srcIdx < 0 || tgtIdx < 0) return [];
              const src = positions[srcIdx];
              const tgt = positions[tgtIdx];
              const dx = tgt.x - src.x;
              const dy = tgt.y - src.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              // Perpendicular unit (vertical offset for parallel edges)
              const nx = -dy / dist;
              const ny = dx / dist;
              const aLen = 10,
                aAng = 0.5,
                angle = Math.atan2(dy, dx);

              return groupEdges.map((edge, gi) => {
                const multiCount = groupEdges.length;
                const mid = multiCount - 1;
                const offset = gi - mid / 2;
                const spread = 40;
                const pox = nx * offset * spread;
                const poy = ny * offset * spread;

                // Per-edge source/target for correct direction
                const eSrcIdx = services.findIndex((s) => s.id === edge.source);
                const eTgtIdx = services.findIndex((s) => s.id === edge.target);
                const eSrc = positions[eSrcIdx];
                const eTgt = positions[eTgtIdx];

                // Determine connection sides for THIS edge's direction
                const rdx = eTgt.x - eSrc.x;
                const rdy = eTgt.y - eSrc.y;
                const absDx = Math.abs(rdx);
                const absDy = Math.abs(rdy);

                let sOffX = 0,
                  sOffY = 0,
                  tOffX = 0,
                  tOffY = 0;

                if (absDx > absDy) {
                  sOffX = rdx > 0 ? nodeW / 2 : -nodeW / 2;
                  tOffX = rdx > 0 ? -nodeW / 2 : nodeW / 2;
                } else {
                  sOffY = rdy > 0 ? nodeH / 2 : -nodeH / 2;
                  tOffY = rdy > 0 ? -nodeH / 2 : nodeH / 2;
                }

                // Fixed connection at node edge center, spread only the bezier control point
                const startX = eSrc.x + sOffX;
                const startY = eSrc.y + sOffY;
                const eX = eTgt.x + tOffX;
                const eY = eTgt.y + tOffY;

                // Quadratic bezier control point — spread for parallel edges
                const midX = (startX + eX) / 2 + pox * 2.5;
                const midY = (startY + eY) / 2 + poy * 2.5;

                // Arrow at end of bezier
                const aT = 0.92;
                const ax0 = (1 - aT) * (1 - aT) * startX + 2 * (1 - aT) * aT * midX + aT * aT * eX;
                const ay0 = (1 - aT) * (1 - aT) * startY + 2 * (1 - aT) * aT * midY + aT * aT * eY;
                const aDx = eX - ax0;
                const aDy = eY - ay0;
                const aDist = Math.sqrt(aDx * aDx + aDy * aDy) || 1;
                const aAng2 = Math.atan2(aDy, aDx);
                const ax1 = eX - aLen * Math.cos(aAng2 - aAng);
                const ay1 = eY - aLen * Math.sin(aAng2 - aAng);
                const ax2 = eX - aLen * Math.cos(aAng2 + aAng);
                const ay2 = eY - aLen * Math.sin(aAng2 + aAng);

                const style = EDGE_STYLES[edge.type] ?? EDGE_STYLES.sync;

                return (
                  <g
                    key={edge.id}
                    style={{ cursor: 'pointer' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setEditEdge(edge);
                    }}
                  >
                    <title>{`${edge.label || '—'} (${edge.type})`}</title>
                    {/* Invisible clickable tube */}
                    <path
                      d={`M ${startX} ${startY} Q ${midX} ${midY} ${eX} ${eY}`}
                      fill='none'
                      stroke='#fff'
                      strokeWidth={20}
                      strokeLinecap='round'
                      opacity={0.01}
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Visible edge path */}
                    <path
                      d={`M ${startX} ${startY} Q ${midX} ${midY} ${eX} ${eY}`}
                      fill='none'
                      stroke={style.color}
                      strokeWidth={2}
                      strokeDasharray={style.dash}
                      style={{ pointerEvents: 'none' }}
                    />
                    <polygon
                      points={`${eX},${eY} ${ax1},${ay1} ${ax2},${ay2}`}
                      fill={style.color}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Edge label centered on the line */}
                    {(() => {
                      // Position label at the bezier control point (midX, midY) for clearer separation
                      const lx = midX;
                      const ly = midY;
                      const labelText = (edge.label || '—') + (multiCount > 1 ? ` #${gi + 1}` : '');
                      const lo = labelOffsets.current.get(edge.id) || { dx: 0, dy: 0 };
                      const lpx = lx + lo.dx;
                      const lpy = ly + lo.dy;
                      return (
                        <g
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const pt = getSVGPoint(e);
                            const cur = labelOffsets.current.get(edge.id) || { dx: 0, dy: 0 };
                            labelDragRef.current = {
                              edgeId: edge.id,
                              startX: pt.x,
                              startY: pt.y,
                              origDx: cur.dx,
                              origDy: cur.dy
                            };
                          }}
                        >
                          <text
                            x={lpx}
                            y={lpy + 3}
                            textAnchor='middle'
                            dominantBaseline='middle'
                            fill={style.color}
                            fontSize='6'
                            fontWeight='500'
                            stroke='#ffffff'
                            strokeWidth='1.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            paintOrder='stroke'
                            style={{ pointerEvents: 'none' }}
                          >
                            {labelText}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              });
            });
          })()}

        {/* No edges hint */}
        {!hasEdges && (
          <text
            x={svgW / 2}
            y={svgH - 20}
            textAnchor='middle'
            className='fill-muted-foreground'
            fontSize='11'
            fontStyle='italic'
          >
            Drag the ⚡ handle from a node to another to create a link
          </text>
        )}
      </svg>

      {/* Link-type dialog */}
      {linkDialog && (
        <div className='flex justify-center mt-3'>
          <AddLinkDialog
            domainId={domainId}
            services={services}
            defaultSourceId={linkDialog.sourceId}
            defaultTargetId={linkDialog.targetId}
            open={true}
            onClose={() => setLinkDialog(null)}
          />
        </div>
      )}

      {/* Edit link inline form */}
      {editEdge && (
        <EditLinkForm
          edge={editEdge}
          onSave={(linkType, label) => updateLink.mutate({ edge: editEdge, linkType, label })}
          onCancel={() => setEditEdge(null)}
          isPending={updateLink.isPending}
          deleteLink={deleteLink}
        />
      )}

      {/* Legend */}
      {hasEdges && (
        <div className='flex justify-center gap-6 mt-2 text-xs text-muted-foreground'>
          {Object.entries(EDGE_STYLES).map(([type, s]) => (
            <span key={type} className='flex items-center gap-1.5'>
              <span
                className='inline-block w-4 h-0'
                style={{ borderTop: `2px ${s.dash === 'none' ? 'solid' : 'dashed'} ${s.color}` }}
              />
              {s.label}
            </span>
          ))}
          <span className='flex items-center gap-1.5'>
            <span className='inline-block w-2.5 h-2.5 rounded border border-muted-foreground/50 bg-card' />{' '}
            Service
          </span>
        </div>
      )}
    </div>
  );
}

function EditLinkForm({
  edge,
  onSave,
  onCancel,
  isPending,
  deleteLink: delMut
}: {
  edge: TopologyEdge;
  onSave: (linkType: string, label: string) => void;
  onCancel: () => void;
  isPending: boolean;
  deleteLink: { mutate: (edge: TopologyEdge) => void; isPending: boolean };
}) {
  const [linkType, setLinkType] = useState<string>(edge.type);
  const [label, setLabel] = useState(edge.label ?? '');

  return (
    <div className='flex items-center justify-center gap-3 mt-3 p-3 rounded-lg border bg-muted/30'>
      <div className='flex items-center gap-2'>
        <Label className='text-xs shrink-0'>Type</Label>
        <Select value={linkType} onValueChange={setLinkType}>
          <SelectTrigger className='h-8 w-[140px] text-xs'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='sync'>Sync</SelectItem>
            <SelectItem value='async_command'>Async Cmd</SelectItem>
            <SelectItem value='async_event'>Async Event</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='flex items-center gap-2'>
        <Label className='text-xs shrink-0'>Label</Label>
        <Input
          className='h-8 w-[200px] text-xs'
          placeholder='(optional)'
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <Button
        size='sm'
        variant='destructive'
        onClick={() => {
          if (confirm('Delete this link?')) delMut.mutate(edge);
        }}
        disabled={delMut.isPending}
      >
        {delMut.isPending ? (
          <Icons.spinner className='h-3 w-3 animate-spin mr-1' />
        ) : (
          <Icons.trash className='h-3 w-3 mr-1' />
        )}
        Delete
      </Button>
      <Button size='sm' variant='outline' onClick={onCancel}>
        Cancel
      </Button>
      <Button size='sm' onClick={() => onSave(linkType, label)} disabled={isPending}>
        {isPending ? <Icons.spinner className='h-3 w-3 animate-spin mr-1' /> : null}
        Save
      </Button>
    </div>
  );
}
