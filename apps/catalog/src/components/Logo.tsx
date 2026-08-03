type Props = {
  /** Size of the mark in pixels. The wordmark scales with it. */
  size?: number;
  /** Hide the wordmark and render only the mark. */
  markOnly?: boolean;
};

/**
 * The Okavo mark: a solid tile closed by a bar — the requirement lock.
 *
 * Solid rather than outlined so it still reads at 16px in a browser tab. The
 * tile takes `currentColor`, which means it inverts correctly between the ink
 * sidebar and the paper marketing pages without a second asset.
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
        <rect x="1" y="1" width="22" height="22" rx="7" fill="currentColor" />
        <rect
          x="6.4"
          y="10.2"
          width="11.2"
          height="3.6"
          rx="1.8"
          fill="var(--accent)"
        />
      </svg>
      {!markOnly && <span className="logo-word">Okavo</span>}
    </span>
  );
}
