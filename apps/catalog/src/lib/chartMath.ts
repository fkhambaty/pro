/** Chart series helpers — only aggregates from data the viewer already owns. */

export type NamedValue = {
  id: string;
  label: string;
  value: number;
  tone?: "accent" | "lock" | "ink" | "warn" | "muted";
};

export type TrendPoint = {
  id: string;
  label: string;
  value: number;
  secondary?: number;
};

export function sumValues(rows: NamedValue[]): number {
  return rows.reduce((total, row) => total + row.value, 0);
}

export function share(value: number, total: number): number {
  if (total <= 0) return 0;
  return value / total;
}

/** Evenly spaced SVG polyline for an area/line chart. */
export function buildPath(
  values: number[],
  width: number,
  height: number,
  pad = 8
): { line: string; area: string } {
  if (values.length === 0) {
    return { line: "", area: "" };
  }

  const top = Math.max(1, ...values);
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const step = values.length === 1 ? 0 : usableW / (values.length - 1);

  const points = values.map((value, index) => {
    const x = pad + step * index;
    const y = pad + usableH - (value / top) * usableH;
    return { x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${last.x.toFixed(1)} ${(height - pad).toFixed(1)} L${first.x.toFixed(1)} ${(height - pad).toFixed(1)} Z`;

  return { line, area };
}
