import { money } from "../../format";
import { BIDDING_MEMBERSHIP_CENTS } from "../../lib/supabase";
import { useStore } from "../../store";

export default function Earnings() {
  const { projects, developerAccount, name } = useStore();

  const myContracts = projects.filter(
    (project) => project.awardedTo && project.awardedTo === name
  );
  const demoContracts = myContracts.length > 0 ? myContracts : projects.filter((p) => p.awardedTo);

  const released = demoContracts
    .flatMap((project) => project.milestones)
    .filter((milestone) => milestone.status === "released")
    .reduce((sum, milestone) => sum + milestone.amount, 0);

  const pending = demoContracts
    .flatMap((project) => project.milestones)
    .filter((milestone) => ["funded", "submitted"].includes(milestone.status))
    .reduce((sum, milestone) => sum + milestone.amount, 0);

  const recurring = demoContracts.reduce(
    (sum, project) => sum + project.monthlyOps,
    0
  );

  return (
    <>
      <header className="topbar">
        <h1>Earnings</h1>
      </header>
      <div className="content">
        <div className="stat-row">
          <div className="stat">
            <span>Paid out</span>
            <strong>{money(released)}</strong>
          </div>
          <div className="stat">
            <span>In escrow</span>
            <strong>{money(pending)}</strong>
          </div>
          <div className="stat">
            <span>Monthly retainers</span>
            <strong>{money(recurring)}</strong>
          </div>
          <div className="stat">
            <span>Platform fees paid</span>
            <strong>
              {money(developerAccount.membershipPaid ? BIDDING_MEMBERSHIP_CENTS / 100 : 0)}
            </strong>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Payout history</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Milestone</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {demoContracts
                .flatMap((project) =>
                  project.milestones.map((milestone) => ({ project, milestone }))
                )
                .map(({ project, milestone }) => (
                  <tr key={milestone.id}>
                    <td>{project.lockId ?? project.title}</td>
                    <td>{milestone.title}</td>
                    <td>{money(milestone.amount)}</td>
                    <td>
                      <span
                        className={
                          milestone.status === "released"
                            ? "badge badge-lock"
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
        </div>

        <div className="card card-pad" style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
            How payouts work
          </h3>
          <p style={{ color: "var(--muted)" }}>
            The buyer funds each milestone into escrow before you start it. When
            they accept the work against the locked scope, escrow releases to your
            payout account. Disputes freeze the milestone until Okavo review
            decides against the contract.
          </p>
        </div>
      </div>
    </>
  );
}
