import { useMemo } from "react";
import { share, sumValues, type NamedValue } from "../../lib/chartMath";

const TONE_VAR: Record<NonNullable<NamedValue["tone"]>, string> = {
  accent: "var(--accent)",
  lock: "var(--lock)",
  ink: "var(--ink)",
  warn: "var(--warn)",
  muted: "var(--faint)",
};

type Props = {
  slices: NamedValue[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
};

function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polar(cx, cy, radius, endAngle);
  const end = polar(cx, cy, radius, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 0 ${end.x} ${end.y}`;
}

export default function Donut({
  slices,
  size = 180,
  centerLabel,
  centerValue,
}: Props) {
  const total = sumValues(slices);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const stroke = size * 0.14;

  const arcs = useMemo(() => {
    let angle = 0;
    return slices
      .filter((slice) => slice.value > 0)
      .map((slice, index) => {
        const portion = share(slice.value, total);
        // SVG arcs cannot draw a full 360° path; treat near-full as a circle.
        const sweep = Math.min(portion * 360, 359.99);
        const start = angle;
        const end = angle + Math.max(sweep, portion > 0 ? 0.8 : 0);
        angle = end;
        return {
          ...slice,
          start,
          end,
          portion,
          full: portion >= 0.999,
          path: arcPath(cx, cy, radius, start, end),
          delay: index * 60,
        };
      });
  }, [slices, total, cx, cy, radius]);

  if (total <= 0) return null;

  return (
    <div className="donut">
      <svg
        className="donut-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={centerLabel ?? "Distribution"}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--line-2)"
          strokeWidth={stroke}
        />
        {arcs.map((arc) =>
          arc.full ? (
            <circle
              key={arc.id}
              className="donut-arc"
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={TONE_VAR[arc.tone ?? "accent"]}
              strokeWidth={stroke}
              style={{ animationDelay: `${arc.delay}ms` }}
            >
              <title>
                {arc.label}: {arc.value.toLocaleString()} (100%)
              </title>
            </circle>
          ) : (
            <path
              key={arc.id}
              className="donut-arc"
              d={arc.path}
              fill="none"
              stroke={TONE_VAR[arc.tone ?? "accent"]}
              strokeWidth={stroke}
              strokeLinecap="butt"
              style={{ animationDelay: `${arc.delay}ms` }}
            >
              <title>
                {arc.label}: {arc.value.toLocaleString()} (
                {Math.round(arc.portion * 100)}%)
              </title>
            </path>
          )
        )}
        <text
          x={cx}
          y={cy - (centerLabel ? 6 : 0)}
          textAnchor="middle"
          className="donut-center-value"
        >
          {centerValue ?? total.toLocaleString()}
        </text>
        {centerLabel && (
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            className="donut-center-label"
          >
            {centerLabel}
          </text>
        )}
      </svg>

      <ul className="donut-legend">
        {arcs.map((arc) => (
          <li key={arc.id}>
            <span
              className="donut-swatch"
              style={{ background: TONE_VAR[arc.tone ?? "accent"] }}
            />
            <span className="donut-legend-label">{arc.label}</span>
            <strong>{arc.value.toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
