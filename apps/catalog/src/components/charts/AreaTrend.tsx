import { useId, useMemo } from "react";
import { buildPath, type TrendPoint } from "../../lib/chartMath";

type Props = {
  points: TrendPoint[];
  height?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
};

export default function AreaTrend({
  points,
  height = 160,
  primaryLabel = "value",
  secondaryLabel,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const width = 640;

  const primaryPath = useMemo(
    () => buildPath(points.map((point) => point.value), width, height),
    [points, height]
  );
  const secondaryPath = useMemo(
    () =>
      buildPath(
        points.map((point) => point.secondary ?? 0),
        width,
        height
      ),
    [points, height]
  );

  const values = points.map((point) => point.value);
  const hasSecondary =
    Boolean(secondaryLabel) &&
    points.some((point) => (point.secondary ?? 0) > 0);

  const peak = Math.max(1, ...values, ...(hasSecondary ? points.map((p) => p.secondary ?? 0) : [0]));
  const first = points[0]?.label ?? "";
  const last = points[points.length - 1]?.label ?? "";

  if (points.length === 0) return null;

  return (
    <div className="area-trend">
      <svg
        className="area-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${primaryLabel} trend`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`fill2-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lock)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--lock)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            className="area-trend-grid"
            x1="0"
            x2={width}
            y1={height * fraction}
            y2={height * fraction}
          />
        ))}

        <path
          className="area-trend-area"
          d={primaryPath.area}
          fill={`url(#fill-${uid})`}
        />
        <path
          className="area-trend-line"
          d={primaryPath.line}
          fill="none"
          stroke="var(--accent-deep)"
        />

        {hasSecondary && (
          <>
            <path
              className="area-trend-area area-trend-area-secondary"
              d={secondaryPath.area}
              fill={`url(#fill2-${uid})`}
            />
            <path
              className="area-trend-line area-trend-line-secondary"
              d={secondaryPath.line}
              fill="none"
              stroke="var(--lock)"
            />
          </>
        )}

        {points.map((point, index) => {
          const top = Math.max(1, ...values);
          const step =
            values.length === 1 ? 0 : (width - 16) / (values.length - 1);
          const x = 8 + step * index;
          const y = 8 + (height - 16) - (point.value / top) * (height - 16);
          return (
            <circle
              key={point.id}
              className="area-trend-dot"
              cx={x}
              cy={y}
              r="3.5"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              <title>
                {point.label}: {point.value.toLocaleString()} {primaryLabel}
                {hasSecondary && point.secondary != null
                  ? ` · ${point.secondary.toLocaleString()} ${secondaryLabel}`
                  : ""}
              </title>
            </circle>
          );
        })}
      </svg>

      <div className="area-trend-axis">
        <span>{first}</span>
        <span>
          Peak {peak.toLocaleString()} {primaryLabel}
          {peak === 1 ? "" : "s"}
        </span>
        <span>{last}</span>
      </div>

      {hasSecondary && (
        <div className="chart-legend">
          <span className="chart-legend-item accent">{primaryLabel}</span>
          <span className="chart-legend-item lock">{secondaryLabel}</span>
        </div>
      )}
    </div>
  );
}
