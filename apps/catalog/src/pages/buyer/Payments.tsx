import { money } from "../../format";
import { useStore } from "../../store";

export default function Payments() {
  const { projects } = useStore();

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
            <span>Held in escrow</span>
            <strong>{money(funded)}</strong>
          </div>
          <div className="stat">
            <span>Released to developers</span>
            <strong>{money(released)}</strong>
          </div>
          <div className="stat">
            <span>Not yet funded</span>
            <strong>{money(upcoming)}</strong>
          </div>
          <div className="stat">
            <span>Monthly running cost</span>
            <strong>{money(monthly)}</strong>
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
