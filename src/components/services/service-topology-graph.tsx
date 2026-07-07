'use client';

export function ServiceTopologyGraph({
  serviceName,
  assets = []
}: {
  serviceName: string;
  assets: { id: string; name: string; type: string; state: string }[];
}) {
  const centerX = 350;
  const centerY = 200;
  const nodeR = 28;

  const count = assets.length;
  const [root, ...children] = assets;

  // Children arranged in semicircle below root
  const arcRadius = 140;
  const childCount = Math.min(children.length, 7);
  const startAngle = -Math.PI * 0.6;
  const endAngle = Math.PI * 0.6;
  const angleStep = childCount > 1 ? (endAngle - startAngle) / (childCount - 1) : 0;

  const childPositions = children.slice(0, 7).map((_, i) => {
    const angle = childCount > 1 ? startAngle + i * angleStep : 0;
    return {
      x: centerX + Math.sin(angle) * arcRadius,
      y: centerY + Math.cos(angle) * arcRadius * 0.65 + 40
    };
  });

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
      <svg
        viewBox='0 0 700 400'
        className='w-full max-w-[700px] h-auto mx-auto'
        xmlns='http://www.w3.org/2000/svg'
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
              x1={centerX}
              y1={centerY + nodeR}
              x2={pos.x}
              y2={pos.y - nodeR}
              stroke='#94a3b8'
              strokeWidth={1.5}
              strokeDasharray='4,3'
              markerEnd='url(#arrow-child)'
            />
          );
        })}

        {/* ── Root (center) ── */}
        <g filter='url(#shadow)'>
          <rect
            x={centerX - 75}
            y={centerY - 30}
            width={150}
            height={60}
            rx={14}
            className='fill-emerald-100 dark:fill-emerald-950/40'
            stroke='#22c55e'
            strokeWidth={2}
          />
          <text
            x={centerX}
            y={centerY - 5}
            textAnchor='middle'
            dominantBaseline='middle'
            className='fill-emerald-700 dark:fill-emerald-300'
            fontSize='11'
            fontWeight='700'
          >
            {root.name.length > 16 ? root.name.slice(0, 14) + '…' : root.name}
          </text>
          <text
            x={centerX}
            y={centerY + 14}
            textAnchor='middle'
            dominantBaseline='middle'
            className='fill-muted-foreground'
            fontSize='9'
          >
            {root.type}
            <tspan
              dx='4'
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
            x={centerX - 36}
            y={centerY - 44}
            width={72}
            height={16}
            rx={8}
            className='fill-primary/20'
          />
          <text
            x={centerX}
            y={centerY - 37}
            textAnchor='middle'
            dominantBaseline='middle'
            className='fill-primary'
            fontSize='9'
            fontWeight='600'
          >
            {serviceName.length > 12 ? serviceName.slice(0, 10) + '…' : serviceName}
          </text>
        </g>

        {/* ── Children ── */}
        {children.slice(0, 7).map((child, i) => {
          const pos = childPositions[i];
          return (
            <g key={`c-${child.id}`}>
              <rect
                x={pos.x - 55}
                y={pos.y - nodeR}
                width={110}
                height={nodeR * 2}
                rx={8}
                className='fill-sky-100 dark:fill-sky-950/40'
                stroke='#3b82f6'
                strokeWidth={1.5}
                filter='url(#shadow)'
              />
              <text
                x={pos.x}
                y={pos.y - 3}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-sky-700 dark:fill-sky-300'
                fontSize='10'
                fontWeight='600'
              >
                {child.name.length > 14 ? child.name.slice(0, 12) + '…' : child.name}
              </text>
              <text
                x={pos.x}
                y={pos.y + 14}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-muted-foreground'
                fontSize='9'
              >
                {child.type}
                <tspan
                  dx='4'
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
            y={370}
            textAnchor='middle'
            className='fill-muted-foreground'
            fontSize='11'
          >
            +{count - 8} more assets (graph shows max 8)
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
