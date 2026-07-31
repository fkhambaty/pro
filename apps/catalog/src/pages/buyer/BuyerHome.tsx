import { Link } from "react-router-dom";
import { money } from "../../format";
import { useStore } from "../../store";

export default function BuyerHome() {
  const { projects, name } = useStore();
  const mine = projects.filter((p) => p.ownedByMe || p.org === name);
  const list = mine.length > 0 ? mine : projects.slice(0, 3);

  const totalBids = list.reduce((sum, p) => sum + p.bids.length, 0);
  const locked = list.filter((p) => p.stage !== "drafting").length;
  const committed = list.reduce((sum, p) => sum + p.monthlyOps, 0);

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
          <div className="stat">
            <span>Requirements</span>
            <strong>{list.length}</strong>
          </div>
          <div className="stat">
            <span>Locked contracts</span>
            <strong>{locked}</strong>
          </div>
          <div className="stat">
            <span>Bids received</span>
            <strong>{totalBids}</strong>
          </div>
          <div className="stat">
            <span>Monthly run cost</span>
            <strong>{money(committed)}</strong>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Your requirements</h2>
            <Link className="btn btn-secondary btn-sm" to="/app/new">
              Add another
            </Link>
          </div>
          <div style={{ padding: "1rem 1.25rem" }} className="stack-sm">
            {list.map((project) => (
              <Link
                to={
                  project.stage === "drafting"
                    ? `/app/project/${project.id}`
                    : `/app/contract/${project.id}`
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
