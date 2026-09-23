"use client";

import { AXIS, clip, Legend, Swatch, useChartText, WIDTH } from "./chart-parts";

export interface BarGroup {
  label: string;
  values: number[];
  worst?: boolean;
}

interface GroupedBarsProps {
  label: string;
  series: string[];
  groups: BarGroup[];
  format: (v: number) => string;
  axis: string;
  max?: number;
  reference?: { value: number; label: string };
}

const FILLS = ["fill-(--ice-frost) stroke-(--ice-deep)", "fill-(--ice-deep) stroke-(--ice-label)"];
const WORST = ["fill-(--smirnoff-red) stroke-(--xp-close-dark)", "fill-(--xp-close-dark) stroke-(--xp-close-dark)"];
const [LEFT, RIGHT, GAP] = [104, 46, 7];

export function GroupedBars({ label, series, groups, format, axis, max, reference }: GroupedBarsProps) {
  const { text, small, phone } = useChartText();
  const BAR = phone ? 14 : 10;
  const top = reference ? 18 : 4;
  const plot = WIDTH - LEFT - RIGHT;
  const scale = max ?? Math.max(reference?.value ?? 0, ...groups.flatMap((g) => g.values));
  const w = (v: number) => (scale > 0 && v > 0 ? (v / scale) * plot : 0);
  const rowH = series.length * BAR + GAP;
  const plotH = groups.length * rowH;
  const height = top + plotH + (phone ? 34 : 30);

  const summary = groups.map((g) => `${g.label} ${g.values.map(format).join(" / ")}`).join(", ");
  const ref = reference ? `; ${reference.label} ${format(reference.value)}` : "";

  return (
    <div className="grid gap-2">
      <svg
        role="img"
        aria-label={`${label} (${series.join(" / ")}): ${summary}${ref}`}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="block h-auto w-full"
        style={{ maxWidth: WIDTH * 1.25 }}
      >
        <line x1={LEFT} x2={LEFT} y1={top} y2={top + plotH} className={AXIS} />
        <line x1={LEFT} x2={LEFT + plot} y1={top + plotH} y2={top + plotH} className={AXIS} />
        <text x={LEFT} y={top + plotH + (phone ? 14 : 12)} textAnchor="middle" className={text}>{format(0)}</text>
        <text x={LEFT + plot} y={top + plotH + (phone ? 14 : 12)} textAnchor="middle" className={text}>{format(scale)}</text>
        <text x={LEFT + plot / 2} y={height - 3} textAnchor="middle" className={text}>{axis}</text>
        {groups.map((g, gi) => {
          const y0 = top + gi * rowH + GAP / 2;
          return (
            <g key={`${g.label}-${gi}`} className={g.worst ? "bar-group bar-worst" : "bar-group"}>
              <title>{`${g.label}: ${g.values.map((v, i) => `${series[i]} ${format(v)}`).join(", ")}`}</title>
              <text x={LEFT - 5} y={y0 + (rowH - GAP) / 2 + 4} textAnchor="end" className={`${text} ${g.worst ? "font-bold" : ""}`}>
                {clip(g.label, phone ? 13 : 16)}
              </text>
              {g.values.map((v, i) => (
                <g key={i}>
                  <rect x={LEFT} y={y0 + i * BAR} width={w(v)} height={BAR - 1} className={(g.worst ? WORST : FILLS)[i]} />
                  <text x={LEFT + w(v) + 3} y={y0 + (i + 1) * BAR - 3} className={small}>{format(v)}</text>
                </g>
              ))}
            </g>
          );
        })}
        {reference && (
          <g className="bar-reference">
            <line
              x1={LEFT + w(reference.value)}
              x2={LEFT + w(reference.value)}
              y1={top - 2}
              y2={top + plotH}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              className="stroke-(--xp-text)"
            />
            <text x={LEFT + w(reference.value)} y={top - 5} textAnchor="middle" className={text}>
              {reference.label} {format(reference.value)}
            </text>
          </g>
        )}
      </svg>
      <Legend>
        {series.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <svg width="12" height="10" aria-hidden className="shrink-0">
              <rect x="0.5" y="0.5" width="11" height="9" className={FILLS[i]} />
            </svg>
            {s}
          </li>
        ))}
        {groups.some((g) => g.worst) && (
          <li className="flex items-center gap-1">
            <svg width="12" height="10" aria-hidden className="shrink-0">
              <rect x="0.5" y="0.5" width="11" height="9" className={WORST[0]} />
            </svg>
            Worst
          </li>
        )}
        {reference && (
          <li className="flex items-center gap-1">
            <Swatch className="stroke-(--xp-text)" dash="4 3" width={1.5} />
            {reference.label}
          </li>
        )}
      </Legend>
    </div>
  );
}
