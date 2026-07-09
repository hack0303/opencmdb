'use client';

import { useState, useRef, useCallback } from 'react';

type Pos = { x: number; y: number };

export function ServiceTopologyGraph({
  serviceName,
  assets = []
}: {
  serviceName: string;
  assets: { id: string; name: string; type: string; state: string }[];
}) {
  const count = assets.length;
  const [root, ...children] = assets;

  // Compact layout
  const centerX = 220;
  const centerY = 50;
  const nodeR = 16;
  const arcRadius = 60;
  const svgW = 450;
  const svgH = 120;

  const childCount = Math.min(children.length, 7);
  const startAngle = -Math.PI * 0.6;
  const endAngle = Math.PI * 0.6;
  const angleStep = childCount > 1 ? (endAngle - startAngle) / (childCount - 1) : 0;

  const initialChildPositions = children.slice(0, 7).map((_, i) => {
    const angle = childCount > 1 ? startAngle + i * angleStep : 0;
    return {
      x: centerX + Math.sin(angle) * arcRadius,
      y: centerY + Math.cos(angle) * arcRadius * 0.6 + 20
    };
  });

  const [rootPos, setRootPos] = useState<Pos>({ x: centerX, y: centerY });
  const [childPositions, setChildPositions] = useState<Pos[]>(initialChildPositions);
  const [scale, setScale] = useState(0.7);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    type: 'root' | 'child';
    index: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, type: 'root' | 'child', index: number) => {
      e.preventDefault();
      const pt = getSVGPoint(e);
      const pos = type === 'root' ? rootPos : childPositions[index];
      dragRef.current = {
        type,
        index,
        startX: pt.x,
        startY: pt.y,
        origX: pos.x,
        origY: pos.y,
        moved: false
      };
    },
    [getSVGPoint, rootPos, childPositions]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pt = getSVGPoint(e);
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      if (!drag.moved) return;
      const newX = drag.origX + dx;
      const newY = drag.origY + dy;
      if (drag.type === 'root') {
        setRootPos({ x: newX, y: newY });
      } else {
        setChildPositions((prev) => {
          const next = [...prev];
          next[drag.index] = { x: newX, y: newY };
          return next;
        });
      }
    },
    [getSVGPoint]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  if (count === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-10 text-center text-muted-foreground'>
        <p className='text-sm'>No bound assets.</p>
        <p className='text-xs mt-1'>
          Click &quot;Bind Asset&quot; to link infrastructure resources.
        </p>
      </div>
    );
  }

  return (
    <div className='w-full overflow-x-auto'>
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
        viewBox={`${(svgW * (1 - 1 / scale)) / 2} ${(svgH * (1 - 1 / scale)) / 2} ${svgW / scale} ${svgH / scale}`}
        className='w-full h-auto mx-auto'
        xmlns='http://www.w3.org/2000/svg'
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker
            id='arrow-child'
            viewBox='0 0 10 10'
            refX='10'
            refY='5'
            markerWidth='7'
            markerHeight='7'
            orient='auto-start-reverse'
          >
            <path d='M 0 0 L 10 5 L 0 10 z' fill='#94a3b8' />
          </marker>
          <filter id='shadow' x='-20%' y='-20%' width='140%' height='140%'>
            <feDropShadow dx='0' dy='2' stdDeviation='3' floodOpacity='0.12' />
          </filter>
        </defs>

        {/* ── Edges: root → children ── */}
        {children.slice(0, 7).map((child, i) => {
          const pos = childPositions[i];
          return (
            <line
              key={`e-${child.id}`}
              x1={rootPos.x}
              y1={rootPos.y + nodeR}
              x2={pos.x}
              y2={pos.y - nodeR}
              stroke='#94a3b8'
              strokeWidth={1.2}
              strokeDasharray='3,3'
              markerEnd='url(#arrow-child)'
            />
          );
        })}

        {/* ── Root (center) ── */}
        <g
          filter='url(#shadow)'
          onMouseDown={(e) => handleMouseDown(e, 'root', 0)}
          style={{ cursor: 'grab' }}
        >
          <rect
            x={rootPos.x - 55}
            y={rootPos.y - 22}
            width={110}
            height={44}
            rx={10}
            className='fill-emerald-100 dark:fill-emerald-950/40'
            stroke='#22c55e'
            strokeWidth={1.5}
          />
          <text
            x={rootPos.x}
            y={rootPos.y - 4}
            textAnchor='middle'
            dominantBaseline='middle'
            className='fill-emerald-700 dark:fill-emerald-300'
            fontSize='10'
            fontWeight='700'
            pointerEvents='none'
          >
            {root.name.length > 14 ? root.name.slice(0, 12) + '…' : root.name}
          </text>
          <text
            x={rootPos.x}
            y={rootPos.y + 11}
            textAnchor='middle'
            dominantBaseline='middle'
            className='fill-muted-foreground'
            fontSize='8'
            pointerEvents='none'
          >
            {root.type}
            <tspan
              dx='3'
              className={
                root.state === 'RUNNING' || root.state === 'READY'
                  ? 'fill-green-500'
                  : 'fill-amber-500'
              }
            >
              · {root.state}
            </tspan>
          </text>
          {/* Service label on root */}
          <rect
            x={rootPos.x - 28}
            y={rootPos.y - 32}
            width={56}
            height={14}
            rx={7}
            className='fill-primary/20'
          />
          <text
            x={rootPos.x}
            y={rootPos.y - 26}
            textAnchor='middle'
            dominantBaseline='middle'
            className='fill-primary'
            fontSize='8'
            fontWeight='600'
            pointerEvents='none'
          >
            {serviceName.length > 10 ? serviceName.slice(0, 8) + '…' : serviceName}
          </text>
        </g>

        {/* ── Children ── */}
        {children.slice(0, 7).map((child, i) => {
          const pos = childPositions[i];
          return (
            <g
              key={`c-${child.id}`}
              onMouseDown={(e) => handleMouseDown(e, 'child', i)}
              style={{ cursor: 'grab' }}
            >
              <rect
                x={pos.x - 42}
                y={pos.y - nodeR}
                width={84}
                height={nodeR * 2}
                rx={6}
                className='fill-sky-100 dark:fill-sky-950/40'
                stroke='#3b82f6'
                strokeWidth={1.2}
                filter='url(#shadow)'
              />
              <text
                x={pos.x}
                y={pos.y - 2}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-sky-700 dark:fill-sky-300'
                fontSize='9'
                fontWeight='600'
                pointerEvents='none'
              >
                {child.name.length > 12 ? child.name.slice(0, 10) + '…' : child.name}
              </text>
              <text
                x={pos.x}
                y={pos.y + 11}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-muted-foreground'
                fontSize='8'
                pointerEvents='none'
              >
                {child.type}
                <tspan
                  dx='3'
                  className={
                    child.state === 'RUNNING' || child.state === 'READY'
                      ? 'fill-green-500'
                      : 'fill-amber-500'
                  }
                >
                  · {child.state}
                </tspan>
              </text>
            </g>
          );
        })}

        {count > 8 && (
          <text
            x={centerX}
            y={svgH - 10}
            textAnchor='middle'
            className='fill-muted-foreground'
            fontSize='10'
          >
            +{count - 8} more
          </text>
        )}
      </svg>

      {count > 0 && (
        <div className='flex justify-center gap-6 mt-2 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <span className='inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-500' />{' '}
            Root (order 0)
          </span>
          <span className='flex items-center gap-1.5'>
            <span className='inline-block w-3 h-3 rounded bg-sky-100 border border-blue-500' />{' '}
            Linked Asset
          </span>
          <span className='flex items-center gap-1.5'>
            <span
              className='w-3 h-0 border-t-2 border-dashed border-slate-400 inline-block'
              style={{ height: 0 }}
            />{' '}
            Binding
          </span>
        </div>
      )}
    </div>
  );
}
