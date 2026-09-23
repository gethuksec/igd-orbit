import { useRef } from 'react';

// IGDERP-185: 3x3 phone-pattern pad. Drag (mouse + touch) across dots,
// live connecting line, numbered order badges. Nodes are 0-8, row-major.
const POS = [50, 150, 250];
const xy = (i: number) => ({ x: POS[i % 3], y: POS[Math.floor(i / 3)] });

interface PatternPadProps {
  value?: number[];
  onChange?: (nodes: number[]) => void;
  readOnly?: boolean;
}

export default function PatternPad({ value = [], onChange, readOnly = false }: PatternPadProps) {
  const ref = useRef<SVGSVGElement>(null);

  const toLocal = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * 300) / r.width, y: ((e.clientY - r.top) * 300) / r.height };
  };

  const hit = (p: { x: number; y: number }) => {
    for (let i = 0; i < 9; i++) {
      const c = xy(i);
      if (Math.hypot(c.x - p.x, c.y - p.y) <= 30) return i;
    }
    return -1;
  };

  const push = (i: number) => {
    if (i >= 0 && !value.includes(i)) onChange?.([...value, i]);
  };

  const line = value.map((i) => `${xy(i).x},${xy(i).y}`).join(' ');

  return (
    <svg
      ref={ref}
      viewBox="0 0 300 300"
      className={`w-full rounded-xl bg-slate-900 ${readOnly ? '' : 'touch-none select-none'}`}
      onPointerDown={(e) => {
        if (readOnly) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        push(hit(toLocal(e)));
      }}
      onPointerMove={(e) => {
        if (readOnly || e.buttons !== 1) return;
        push(hit(toLocal(e)));
      }}
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8]
        .filter((i) => !value.includes(i))
        .map((i) => (
          <g key={i}>
            <circle cx={xy(i).x} cy={xy(i).y} r={14} fill="none" stroke="#475569" strokeWidth={2} />
            <circle cx={xy(i).x} cy={xy(i).y} r={5} fill="#475569" />
          </g>
        ))}
      {value.length > 1 && (
        <polyline points={line} fill="none" stroke="#34d399" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {value.map((n, order) => (
        <g key={n}>
          <circle cx={xy(n).x} cy={xy(n).y} r={20} fill="#059669" stroke="#34d399" strokeWidth={2.5} />
          <text x={xy(n).x} y={xy(n).y + 5} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#ecfdf5">
            {order + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
