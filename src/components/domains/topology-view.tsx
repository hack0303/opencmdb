'use client';

import { useState, useRef, useCallback } from 'react';
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

function initPositions(count: number, cx: number, cy: number, r: number): Pos[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
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

  const svgW = 800;
  const svgH = 420;
  const centerX = svgW / 2;
  const centerY = svgH / 2;
  const nodeW = 150;
  const nodeH = 44;
  const radius = 160;

  const nodeCount = services.length;
  const hasEdges = nodeCount > 0 && edges.length > 0;

  const [positions, setPositions] = useState<Pos[]>(() =>
    initPositions(nodeCount, centerX, centerY, radius)
  );

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
  } | null>(null);
  const [linkDialog, setLinkDialog] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [editEdge, setEditEdge] = useState<TopologyEdge | null>(null);
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
      setLinkDrag({ sourceIdx: index, mouseX: pt.x, mouseY: pt.y });
    },
    [getSVGPoint]
  );

  // ── Global mouse move ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pt = getSVGPoint(e);

      // Update node drag
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
    <div className='w-full overflow-x-auto'>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className='w-full max-w-[800px] h-auto mx-auto select-none'
        xmlns='http://www.w3.org/2000/svg'
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
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
                x1={src.x + nodeW / 2}
                y1={src.y}
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
                y={pos.y - 5}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-foreground'
                fontSize='11'
                fontWeight='600'
                pointerEvents='none'
              >
                {svc.name.length > 20 ? svc.name.slice(0, 18) + '…' : svc.name}
              </text>
              <text
                x={pos.x}
                y={pos.y + 13}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-muted-foreground'
                fontSize='9'
                pointerEvents='none'
              >
                {svc.semanticRoles
                  ?.slice(0, 2)
                  .map((r: { role: string }) => r.role)
                  .join(' · ') ?? ''}
              </text>
              <circle
                cx={pos.x + nodeW / 2 + 2}
                cy={pos.y}
                r={8}
                className='fill-primary/20 stroke-primary cursor-crosshair'
                strokeWidth={1.5}
                onMouseDown={(e) => handleLinkDragStart(e, i)}
              />
              <text
                x={pos.x + nodeW / 2 + 2}
                y={pos.y + 1}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-primary'
                fontSize='10'
                fontWeight='700'
                pointerEvents='none'
              >
                ⚡
              </text>
            </g>
          );
        })}

        {/* ── Edges + Arrows (after nodes so on top) ── */}
        {hasEdges &&
          edges.map((edge) => {
            const srcIdx = services.findIndex((s) => s.id === edge.source);
            const tgtIdx = services.findIndex((s) => s.id === edge.target);
            if (srcIdx < 0 || tgtIdx < 0) return null;
            const src = positions[srcIdx];
            const tgt = positions[tgtIdx];
            const style = EDGE_STYLES[edge.type] ?? EDGE_STYLES.sync;
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const gap = 14;
            const offX = (dx / dist) * (nodeH / 2 + gap);
            const offY = (dy / dist) * (nodeH / 2 + gap);
            const endX = tgt.x - offX;
            const endY = tgt.y - offY;
            const aLen = 10,
              aAng = 0.5,
              angle = Math.atan2(dy, dx);
            const ax1 = endX - aLen * Math.cos(angle - aAng);
            const ay1 = endY - aLen * Math.sin(angle - aAng);
            const ax2 = endX - aLen * Math.cos(angle + aAng);
            const ay2 = endY - aLen * Math.sin(angle + aAng);
            const mx = (src.x + offX + endX) / 2;
            const my = (src.y + offY + endY) / 2;
            return (
              <g key={edge.id}>
                <line
                  x1={src.x + offX}
                  y1={src.y + offY}
                  x2={endX}
                  y2={endY}
                  stroke={style.color}
                  strokeWidth={2}
                  strokeDasharray={style.dash}
                />
                <polygon
                  points={`${endX},${endY} ${ax1},${ay1} ${ax2},${ay2}`}
                  fill={style.color}
                />
                <rect
                  x={mx - 60}
                  y={my - 12}
                  width={120}
                  height={24}
                  rx={4}
                  className='fill-card/90'
                />
                <text
                  x={mx}
                  y={my + 1}
                  textAnchor='middle'
                  dominantBaseline='middle'
                  fill={style.color}
                  fontSize='10'
                  fontWeight='500'
                  pointerEvents='none'
                >
                  {edge.label
                    ? edge.label.length > 20
                      ? edge.label.slice(0, 18) + '…'
                      : edge.label
                    : '—'}
                </text>
                <g
                  style={{ cursor: 'pointer' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setEditEdge(edge);
                  }}
                >
                  <circle cx={mx + 55} cy={my - 8} r={6} className='fill-muted-foreground/20' />
                  <text
                    x={mx + 55}
                    y={my - 7}
                    textAnchor='middle'
                    dominantBaseline='middle'
                    className='fill-muted-foreground'
                    fontSize='8'
                    pointerEvents='none'
                  >
                    ✎
                  </text>
                </g>
                <g
                  style={{ cursor: 'pointer' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this link?')) deleteLink.mutate(edge);
                  }}
                >
                  <circle cx={mx + 55} cy={my + 8} r={6} className='fill-destructive/20' />
                  <text
                    x={mx + 55}
                    y={my + 9}
                    textAnchor='middle'
                    dominantBaseline='middle'
                    className='fill-destructive'
                    fontSize='8'
                    pointerEvents='none'
                  >
                    ✕
                  </text>
                </g>
              </g>
            );
          })}

        {/* No edges hint */}
        {!hasEdges && (
          <text
            x={centerX}
            y={400}
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
  isPending
}: {
  edge: TopologyEdge;
  onSave: (linkType: string, label: string) => void;
  onCancel: () => void;
  isPending: boolean;
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
