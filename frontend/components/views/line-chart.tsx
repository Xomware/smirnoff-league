"use client";

import { AXIS, clip, HIGHLIGHTS, Legend, niceTicks, Swatch, useChartText, WIDTH } from "./chart-parts";

export interface Series {
  label: string;
  values: number[];
}

interface LineChartProps {
  label: string;
  xLabels: string[];
  // `top` is drawn in colour in rank order, `rest` muted underneath.
  top: Series[];
  rest: Series[];
  yTitle: string;
}

const [LEFT, RIGHT, TOP, BOTTOM, HEIGHT] = [34, 12, 10, 34, 210];

export function LineChart({ label, xLabels, top, rest, yTitle }: LineChartProps) {
  const { text, small } = useChartText();
  const ticks = niceTicks(Math.max(0, ...[...top, ...rest].flatMap((s) => s.values)));
  const yMax = ticks[ticks.length - 1];
  const plotW = WIDTH - LEFT - RIGHT;
  const plotH = HEIGHT - TOP - BOTTOM;
  const x = (i: number) => LEFT + (xLabels.length === 1 ? plotW / 2 : (i / (xLabels.length - 1)) * plotW);
  const y = (v: number) => TOP + plotH - (v / yMax) * plotH;
  const points = (s: Series) => s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = xLabels.length - 1;

  const summary = top.map((s) => `${s.label}: ${xLabels.map((w, i) => `${w} ${s.values[i]}`).join(", ")}`);
  if (rest.length) summary.push(`the other ${rest.length}: ${rest.map((s) => `${s.label} ${s.values[last]}`).join(", ")}`);

  return (
    <div className="grid gap-2">
      <svg
        role="img"
        aria-label={`${label}. ${summary.join("; ")}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full"
        style={{ maxWidth: WIDTH * 1.25 }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(t)} y2={y(t)} className={`${AXIS} opacity-50`} />
            <text x={LEFT - 5} y={y(t) + 4} textAnchor="end" className={text}>{t}</text>
          </g>
        ))}
        {xLabels.map((w, i) => (
          <text key={w} x={x(i)} y={TOP + plotH + 14} textAnchor="middle" className={xLabels.length > 9 ? small : text}>
            {w}
          </text>
        ))}
        <text x={LEFT + plotW / 2} y={HEIGHT - 3} textAnchor="middle" className={text}>Week</text>
        <text transform={`translate(10 ${TOP + plotH / 2}) rotate(-90)`} textAnchor="middle" className={text}>
          {yTitle}
        </text>
        {rest.map((s) => (
          <polyline key={s.label} points={points(s)} fill="none" strokeWidth={1.5} className="line-rest stroke-(--xp-face-shadow)">
            <title>{`${s.label}: ${s.values[last]}`}</title>
          </polyline>
        ))}
        {top.map((s, n) => (
          <g key={s.label} className="line-top">
            <title>{`${s.label}: ${s.values[last]}`}</title>
            <polyline points={points(s)} fill="none" strokeWidth={2.5} strokeDasharray={HIGHLIGHTS[n].dash} className={HIGHLIGHTS[n].stroke} />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} className={HIGHLIGHTS[n].fill} />
            ))}
          </g>
        ))}
      </svg>
      <Legend>
        {top.map((s, n) => (
          <li key={s.label} className="flex items-center gap-1">
            <Swatch className={HIGHLIGHTS[n].stroke} dash={HIGHLIGHTS[n].dash} />
            <span className="font-bold">{clip(s.label, 22)}</span> {s.values[last]}
          </li>
        ))}
        {rest.length > 0 && (
          <li className="flex items-center gap-1">
            <Swatch className="stroke-(--xp-face-shadow)" width={1.5} />
            Rest of the league
          </li>
        )}
      </Legend>
    </div>
  );
}
