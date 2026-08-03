import { Link } from "react-router-dom";
import StatCard from "../../components/StatCard";
import { money } from "../../format";
import { useStore } from "../../store";

export default function BuyerHome() {
  const { myProjects, loading, hydrated } = useStore();
  const list = myProjects;

  const totalBids = list.reduce((sum, p) => sum + p.bids.length, 0);
  const locked = list.filter((p) => p.stage !== "drafting").length;
  const committed = list.reduce((sum, p) => sum + p.monthlyOps, 0);

  // If bids are waiting on a decision, that is where the number should lead.
  const awaitingChoice = list.find(
    (project) => !project.awardedTo && project.bids.length > 0
  );

  return (
    <>
      <header className="topbar">
        <h1>Overview</h1>
        <div className="topbar-actions">
          <Link className="btn btn-sm" to="/app/new">
            New requirement
          </Link>
        </div>
      </header>

      <div className="content">
        <div className="stat-row">
          <StatCard
            label="Requirements"
            value={list.length}
            to={list.length ? "/app/contracts" : "/app/new"}
          />
          <StatCard
            label="Locked contracts"
            value={locked}
            to="/app/contracts"
          />
          <StatCard
            label="Bids received"
            value={totalBids}
            to={awaitingChoice ? `/app/project/${awaitingChoice.id}` : "/app/contracts"}
            note={awaitingChoice ? "Waiting on your decision" : undefined}
          />
          <StatCard
            label="Monthly run cost"
            value={money(committed)}
            to="/app/payments"
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Your requirements</h2>
            <Link className="btn btn-secondary btn-sm" to="/app/new">
              Add another
            </Link>
          </div>
          <div style={{ padding: "1rem 1.25rem" }} className="stack-sm">
            {!hydrated && loading && (
              <p className="hint">Loading your requirements…</p>
            )}

            {hydrated && list.length === 0 && (
              <div className="empty-inline">
                <strong>You have not posted a requirement yet</strong>
                <p>
                  Describe what you need in plain language. We turn it into an
                  agreement you sign before any developer sees it.
                </p>
                <Link className="btn btn-accent btn-sm" to="/app/new">
                  Describe what you need
                </Link>
              </div>
            )}

            {list.map((project) => (
              // Until someone is hired the useful screen is the bid list, not
              // an empty contract.
              <Link
                to={
                  project.awardedTo
                    ? `/app/contract/${project.id}`
                    : `/app/project/${project.id}`
                }
                key={project.id}
                className="project-row"
              >
                <div className="project-top">
                  <div>
                    <h3>{project.title}</h3>
                    <div className="project-meta">
                      <span>{project.category}</span>
                      <span>{project.bids.length} bids</span>
                      {project.stage === "drafting" ? (
                        <span className="badge badge-draft">Not locked</span>
                      ) : (
                        <span className="badge badge-lock">
                          {project.lockId}
                        </span>
                      )}
                      {project.awardedTo && (
                        <span className="badge badge-accent">
                          {project.awardedTo} hired
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="money">
                    <strong>
                      {money(project.budgetMin)} – {money(project.budgetMax)}
                    </strong>
                    <span>{money(project.monthlyOps)} / month to run</span>
                  </div>
                </div>
                <p className="project-outcome">{project.outcome}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
