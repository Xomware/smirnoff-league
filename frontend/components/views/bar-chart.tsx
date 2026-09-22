export interface Bar {
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  bars: Bar[];
  horizontal?: boolean;
  empty?: string;
}

const ices = (n: number) => `${n} ${n === 1 ? "ice" : "ices"}`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const BAR = "stats-bar fill-(--ice-frost) stroke-(--ice-deep)";
const TEXT = "fill-(--xp-text) text-[11px]";
const AXIS = "stroke-(--xp-face-shadow)";

function Vertical({ bars, max }: { bars: Bar[]; max: number }) {
  const [left, top, plot, slot] = [24, 16, 120, 40];
  const width = left + bars.length * slot + 8;
  return (
    <svg viewBox={`0 0 ${width} ${top + plot + 20}`} className="block h-auto w-full" style={{ maxWidth: width * 1.25 }}>
      <line x1={left} y1={top} x2={left} y2={top + plot} className={AXIS} />
      <line x1={left} y1={top + plot} x2={width} y2={top + plot} className={AXIS} />
      <text x={left - 4} y={top + 4} textAnchor="end" className={TEXT}>{max}</text>
      <text x={left - 4} y={top + plot} textAnchor="end" className={TEXT}>0</text>
      {bars.map((b, i) => {
        const h = (b.value / max) * plot;
        const x = left + i * slot + 6;
        return (
          <g key={i}>
            <title>{`${b.label}: ${ices(b.value)}`}</title>
            <rect x={x} y={top + plot - h} width={slot - 12} height={h} className={BAR} />
            <text x={x + (slot - 12) / 2} y={top + plot - h - 3} textAnchor="middle" className={`stats-value ${TEXT}`}>
              {b.value}
            </text>
            <text x={x + (slot - 12) / 2} y={top + plot + 14} textAnchor="middle" className={`stats-label ${TEXT}`}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Horizontal({ bars, max }: { bars: Bar[]; max: number }) {
  const [left, plot, row] = [110, 200, 22];
  const [width, height] = [left + plot + 30, bars.length * row + 18];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" style={{ maxWidth: width * 1.25 }}>
      <line x1={left} y1={0} x2={left} y2={height - 18} className={AXIS} />
      <text x={left} y={height - 4} className={TEXT}>0</text>
      <text x={left + plot} y={height - 4} textAnchor="end" className={TEXT}>{max}</text>
      {bars.map((b, i) => {
        const y = i * row + 4;
        const w = (b.value / max) * plot;
        return (
          <g key={i}>
            <title>{`${b.label}: ${ices(b.value)}`}</title>
            <text x={left - 6} y={y + 11} textAnchor="end" className={`stats-label ${TEXT}`}>
              {clip(b.label, 17)}
            </text>
            <rect x={left} y={y} width={w} height={row - 8} className={BAR} />
            <text x={left + w + 4} y={y + 11} className={`stats-value ${TEXT}`}>{b.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function BarChart({ title, bars, horizontal = false, empty = "Nothing to chart yet." }: BarChartProps) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 font-bold">{title}</figcaption>
      {max === 0 ? (
        <p>{empty}</p>
      ) : (
        <div role="img" aria-label={`${title}: ${bars.map((b) => `${b.label} ${b.value}`).join(", ")}`}>
          {horizontal ? <Horizontal bars={bars} max={max} /> : <Vertical bars={bars} max={max} />}
        </div>
      )}
    </figure>
  );
}
