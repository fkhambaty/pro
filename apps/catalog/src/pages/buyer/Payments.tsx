import { money } from "../../format";
import { POSTING_FEE_LABEL, POSTING_FEE_MINOR, fee, POSTING_SETTLEMENT_HINT } from "../../lib/pricing";
import { useStore } from "../../store";

export default function Payments() {
  const { myProjects, postingFeesPaid } = useStore();
  const projects = myProjects;

  const rows = projects.flatMap((project) =>
    project.milestones.map((milestone) => ({
      project,
      milestone,
    }))
  );

  const funded = rows
    .filter(({ milestone }) =>
      ["funded", "submitted"].includes(milestone.status)
    )
    .reduce((sum, { milestone }) => sum + milestone.amount, 0);
  const released = rows
    .filter(({ milestone }) => milestone.status === "released")
    .reduce((sum, { milestone }) => sum + milestone.amount, 0);
  const upcoming = rows
    .filter(({ milestone }) => milestone.status === "pending")
    .reduce((sum, { milestone }) => sum + milestone.amount, 0);
  const monthly = projects
    .filter((project) => project.stage !== "drafting")
    .reduce((sum, project) => sum + project.monthlyOps, 0);

  return (
    <>
      <header className="topbar">
        <h1>Payments</h1>
      </header>
      <div className="content">
        <div className="stat-row">
          <div className="stat">
            <span>Confirmed outside Okavo</span>
            <strong>{money(funded)}</strong>
          </div>
          <div className="stat">
            <span>Accepted</span>
            <strong>{money(released)}</strong>
          </div>
          <div className="stat">
            <span>Not yet confirmed</span>
            <strong>{money(upcoming)}</strong>
          </div>
          <div className="stat">
            <span>Monthly running cost</span>
            <strong>{money(monthly)}</strong>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.2rem" }}>
                Posting fees
              </h3>
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                {POSTING_FEE_LABEL} per requirement, charged once at creation.
                Not deducted from your build budget. {POSTING_SETTLEMENT_HINT}
              </p>
            </div>
            <div className="money">
              <strong>
                {fee(postingFeesPaid * POSTING_FEE_MINOR)}
              </strong>
              <span>
                {postingFeesPaid} requirement{postingFeesPaid === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Milestone ledger</h2>
            <span className="badge">{rows.length} entries</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty">
              <strong>No payments yet</strong>
              Milestones appear here once you award a contract.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Milestone</th>
                  <th>Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ project, milestone }) => (
                  <tr key={milestone.id}>
                    <td>{project.lockId ?? project.title}</td>
                    <td>{milestone.title}</td>
                    <td>{money(milestone.amount)}</td>
                    <td>{milestone.dueOn}</td>
                    <td>
                      <span
                        className={
                          milestone.status === "released"
                            ? "badge badge-lock"
                            : milestone.status === "pending"
                              ? "badge badge-draft"
                              : "badge badge-accent"
                        }
                      >
                        {milestone.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
