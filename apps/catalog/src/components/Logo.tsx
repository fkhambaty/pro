type Props = {
  /** Size of the mark in pixels. The wordmark scales with it. */
  size?: number;
  /** Hide the wordmark and render only the mark. */
  markOnly?: boolean;
};

/**
 * The Okavo mark: an aperture closed by a bar — the requirement lock.
 */
export default function Logo({ size = 24, markOnly = false }: Props) {
  return (
    <span className="logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="logo-mark"
      >
        <rect
          x="2.25"
          y="2.25"
          width="19.5"
          height="19.5"
          rx="6.5"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <rect x="7" y="10.4" width="10" height="3.2" rx="1.6" fill="var(--accent)" />
      </svg>
      {!markOnly && <span className="logo-word">Okavo</span>}
    </span>
  );
}
