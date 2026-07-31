import { Link } from "react-router-dom";
import { money } from "../../format";
import { useStore } from "../../store";

export default function DevBids() {
  const { projects, userId } = useStore();

  const rows = projects.flatMap((project) =>
    project.bids
      .filter((bid) => bid.developerId === userId || bid.developerId === "me")
      .map((bid) => ({ project, bid }))
  );

  return (
    <>
      <header className="topbar">
        <h1>My bids</h1>
        <div className="topbar-actions">
          <span className="badge">{rows.length} active</span>
        </div>
      </header>
      <div className="content">
        {rows.length === 0 ? (
          <div className="card empty">
            <strong>You have not bid yet</strong>
            Open a locked project and submit a fixed price.
            <div style={{ marginTop: "1rem" }}>
              <Link className="btn btn-sm" to="/app">
                Find projects
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-head">
              <h2>Submitted bids</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Buyer</th>
                  <th>Your price</th>
                  <th>Monthly</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ project, bid }) => (
                  <tr key={bid.id}>
                    <td>
                      <Link to={`/app/project/${project.id}`}>{project.title}</Link>
                    </td>
                    <td>{project.org}</td>
                    <td>{money(bid.amount)}</td>
                    <td>{money(bid.monthlyOps)}</td>
                    <td>
                      {bid.status === "awarded" ? (
                        <span className="badge badge-lock">Won</span>
                      ) : bid.status === "shortlisted" ? (
                        <span className="badge badge-accent">Shortlisted</span>
                      ) : bid.status === "declined" ? (
                        <span className="badge badge-danger">Declined</span>
                      ) : (
                        <span className="badge">Submitted</span>
                      )}
                    </td>
                    <td>
                      {bid.status === "awarded" && (
                        <Link to={`/app/contract/${project.id}`}>Open contract</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
