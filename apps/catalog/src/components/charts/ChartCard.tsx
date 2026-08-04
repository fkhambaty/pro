import type { ReactNode } from "react";

type Props = {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  empty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
};

export default function ChartCard({
  title,
  hint,
  action,
  children,
  empty,
  emptyTitle = "Nothing to chart yet",
  emptyBody,
}: Props) {
  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3 className="chart-card-title">{title}</h3>
          {hint && <span className="hint">{hint}</span>}
        </div>
        {action}
      </div>
      <div className="chart-card-body">
        {empty ? (
          <div className="chart-empty">
            <strong>{emptyTitle}</strong>
            {emptyBody && <p>{emptyBody}</p>}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
