type Props = {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  tone?: "accent" | "lock";
};

export default function Meter({
  value,
  max = 100,
  label,
  caption,
  tone = "accent",
}: Props) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="meter">
      <svg viewBox="0 0 140 140" className="meter-svg" role="img" aria-label={label}>
        <circle
          className="meter-track"
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="12"
        />
        <circle
          className={`meter-progress meter-progress-${tone}`}
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="66" textAnchor="middle" className="meter-value">
          {pct}%
        </text>
        <text x="70" y="88" textAnchor="middle" className="meter-label">
          {label}
        </text>
      </svg>
      {caption && <p className="meter-caption">{caption}</p>}
    </div>
  );
}
