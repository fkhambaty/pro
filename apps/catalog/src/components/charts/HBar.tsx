import type { NamedValue } from "../../lib/chartMath";

const TONE_CLASS: Record<NonNullable<NamedValue["tone"]>, string> = {
  accent: "hbar-fill-accent",
  lock: "hbar-fill-lock",
  ink: "hbar-fill-ink",
  warn: "hbar-fill-warn",
  muted: "hbar-fill-muted",
};

type Props = {
  rows: NamedValue[];
  formatValue?: (value: number) => string;
  maxRows?: number;
};

export default function HBar({
  rows,
  formatValue = (value) => value.toLocaleString(),
  maxRows = 8,
}: Props) {
  const list = rows.slice(0, maxRows);
  const top = Math.max(1, ...list.map((row) => row.value));

  if (list.length === 0) return null;

  return (
    <div className="hbar-list">
      {list.map((row, index) => {
        const width = Math.max(4, (row.value / top) * 100);
        return (
          <div className="hbar-row" key={row.id}>
            <div className="hbar-meta">
              <span className="hbar-label">{row.label}</span>
              <span className="hbar-value">{formatValue(row.value)}</span>
            </div>
            <div className="hbar-track">
              <div
                className={`hbar-fill ${TONE_CLASS[row.tone ?? "accent"]}`}
                style={{
                  width: `${width}%`,
                  animationDelay: `${index * 45}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
