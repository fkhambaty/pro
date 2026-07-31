import { Link } from "react-router-dom";
import { money } from "../format";
import { useStore } from "../store";

const STAGE_LABEL: Record<string, string> = {
  drafting: "Draft",
  locked: "Locked",
  hired: "Hired",
  in_delivery: "In delivery",
  delivered: "Delivered",
  closed: "Closed",
};

export default function ContractsList() {
  const { projects, myProjects, role, userId, loading, hydrated } = useStore();
  const isBuyer = role === "buyer";

  const list = isBuyer
    ? myProjects
    : projects.filter((project) =>
        project.bids.some(
          (bid) => bid.developerId === userId || bid.developerId === "me"
        )
      );

  return (
    <>
      <header className="topbar">
        <h1>Contracts</h1>
        <div className="topbar-actions">
          <span className="badge">
            {list.filter((p) => p.stage !== "drafting").length} locked
          </span>
        </div>
      </header>
      <div className="content">
        {!hydrated && loading && (
          <div className="card empty">
            <strong>Loading contracts…</strong>
          </div>
        )}

        {hydrated && list.length === 0 && (
          <div className="card empty">
            <strong>No contracts yet</strong>
            <p>
              {isBuyer
                ? "A contract appears here once you lock a requirement and hire a developer."
                : "A contract appears here once a buyer awards you a locked requirement."}
            </p>
            <Link to={isBuyer ? "/app/new" : "/app"}>
              {isBuyer ? "Describe what you need" : "Find projects"}
            </Link>
          </div>
        )}

        {list.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Lock</th>
                <th>Requirement</th>
                <th>{isBuyer ? "Developer" : "Buyer"}</th>
                <th>Value</th>
                <th>Monthly</th>
                <th>Stage</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((project) => {
                const awarded = project.bids.find((b) => b.status === "awarded");
                const value = awarded?.amount ?? project.budgetMax;
                return (
                  <tr key={project.id}>
                    <td>
                      <span
                        className="contract-id"
                        style={{ background: "var(--line-2)", color: "var(--ink)" }}
                      >
                        {project.lockId ?? "—"}
                      </span>
                    </td>
                    <td>{project.title}</td>
                    <td>{isBuyer ? project.awardedTo ?? "Not awarded" : project.org}</td>
                    <td>{money(value)}</td>
                    <td>{money(project.monthlyOps)}</td>
                    <td>
                      <span
                        className={
                          project.stage === "drafting"
                            ? "badge badge-draft"
                            : project.stage === "closed"
                              ? "badge"
                              : "badge badge-lock"
                        }
                      >
                        {STAGE_LABEL[project.stage] ?? project.stage}
                      </span>
                    </td>
                    <td>
                      {project.stage === "drafting" ? (
                        <Link to={`/app/project/${project.id}`}>Open draft</Link>
                      ) : (
                        <Link to={`/app/contract/${project.id}`}>Open contract</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </>
  );
}
