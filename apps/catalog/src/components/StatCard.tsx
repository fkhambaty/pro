import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  label: string;
  value: ReactNode;
  /** When set, the whole card becomes a link to the detail behind the number. */
  to?: string;
  /** Shown under the value, e.g. "3 awaiting your review". */
  note?: string;
};

/** A headline number. Clickable whenever there is somewhere useful to go. */
export default function StatCard({ label, value, to, note }: Props) {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <em className="stat-note">{note}</em>}
    </>
  );

  if (!to) return <div className="stat">{body}</div>;

  return (
    <Link className="stat stat-link" to={to}>
      {body}
    </Link>
  );
}
