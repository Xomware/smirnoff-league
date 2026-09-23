"use client";

import { clip, Legend, useChartText, WIDTH } from "./chart-parts";

export interface HeatRow {
  label: string;
  values: number[];
}

interface HeatmapProps {
  label: string;
  columns: string[];
  rows: HeatRow[];
}

const [LEFT, TOP] = [104, 18];
const LEVELS = ["fill-(--ice-heat-1)", "fill-(--ice-heat-2)", "fill-(--ice-heat-3)", "fill-(--ice-heat-4)"];
const level = (v: number) => LEVELS[Math.min(v, LEVELS.length - 1)];

export function Heatmap({ label, columns, rows }: HeatmapProps) {
  const { text, small, phone } = useChartText();
  const ROW = phone ? 22 : 18;
  const cell = Math.min(40, (WIDTH - LEFT - 4) / columns.length);
  const max = Math.max(0, ...rows.flatMap((r) => r.values));
  const height = TOP + rows.length * ROW + 2;
  const hot = rows
    .map((r) => `${r.label}: ${r.values.flatMap((v, i) => (v ? [`${columns[i]} ${v}`] : [])).join(", ")}`)
    .filter((s) => !s.endsWith(": "));

  return (
    <div className="grid gap-2">
      <svg
        role="img"
        aria-label={`${label}. ${hot.length ? hot.join("; ") : "No ices yet"}; everyone else none.`}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="block h-auto w-full"
        style={{ maxWidth: WIDTH * 1.25 }}
      >
        {columns.map((c, i) => (
          <text key={c} x={LEFT + i * cell + cell / 2} y={TOP - 5} textAnchor="middle" className={small}>
            {c}
          </text>
        ))}
        {rows.map((r, ri) => {
          const y = TOP + ri * ROW;
          return (
            <g key={`${r.label}-${ri}`}>
              <text x={LEFT - 5} y={y + ROW / 2 + 4} textAnchor="end" className={text}>{clip(r.label, phone ? 13 : 16)}</text>
              {r.values.map((v, i) => {
                const worst = v > 0 && v === max;
                return (
                  <g key={i} className={worst ? "heat-cell heat-worst" : "heat-cell"}>
                    <title>{`${r.label}, ${columns[i]}: ${v}`}</title>
                    <rect
                      x={LEFT + i * cell + 1}
                      y={y + 1}
                      width={cell - 2}
                      height={ROW - 2}
                      strokeWidth={worst ? 2 : 1}
                      className={`${level(v)} ${worst ? "stroke-(--smirnoff-red)" : "stroke-(--xp-face-shadow)"}`}
                    />
                    {v > 0 && (
                      <text x={LEFT + i * cell + cell / 2} y={y + ROW / 2 + 4} textAnchor="middle" className={`${text} font-bold`}>
                        {v}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <Legend>
        {["0", "1", "2", "3+"].map((l, i) => (
          <li key={l} className="flex items-center gap-1">
            <svg width="12" height="10" aria-hidden className="shrink-0">
              <rect x="0.5" y="0.5" width="11" height="9" className={`${LEVELS[i]} stroke-(--xp-face-shadow)`} />
            </svg>
            {l}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <svg width="12" height="10" aria-hidden className="shrink-0">
            <rect x="1" y="1" width="10" height="8" strokeWidth={2} className="fill-(--ice-heat-4) stroke-(--smirnoff-red)" />
          </svg>
          Worst week
        </li>
      </Legend>
    </div>
  );
}
