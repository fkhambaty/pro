import { money } from "../format";
import type { Project } from "../types";

type Props = {
  project: Project;
  viewer: "buyer" | "developer";
  onLock?: () => void;
};

export default function ContractPanel({ project, viewer, onLock }: Props) {
  const locked = project.stage !== "drafting";
  const included = project.scope.filter((item) => item.included);
  const excluded = project.scope.filter((item) => !item.included);

  return (
    <div className="contract">
      <div className="contract-head">
        <div>
          <h2>Requirement Lock</h2>
          <p>
            {locked
              ? `Signed ${project.lockedAt}. This is the only definition of done.`
              : "Not locked yet. Bidding stays closed until both sides sign."}
          </p>
        </div>
        {locked ? (
          <span className="contract-id">{project.lockId}</span>
        ) : (
          <span className="badge badge-draft">Draft</span>
        )}
      </div>

      <div className="contract-section">
        <h3>Commercial terms</h3>
        <div className="terms">
          <div className="term">
            <span>Build budget</span>
            <strong>
              {money(project.budgetMin)} – {money(project.budgetMax)}
            </strong>
          </div>
          <div className="term">
            <span>Monthly running cost</span>
            <strong>{money(project.monthlyOps)}</strong>
          </div>
          <div className="term">
            <span>Timeline</span>
            <strong>{project.timelineWeeks} weeks</strong>
          </div>
        </div>
      </div>

      <div className="contract-section">
        <h3>In scope — must be delivered</h3>
        <div>
          {included.map((item) => (
            <div className="scope-item" key={item.id}>
              <span className="scope-mark">✓</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {excluded.length > 0 && (
        <div className="contract-section">
          <h3>Explicitly out of scope</h3>
          <div>
            {excluded.map((item) => (
              <div className="scope-item" key={item.id}>
                <span className="scope-mark out">✕</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="contract-section">
        <h3>Signatures</h3>
        <div className="signature-row">
          <div className={`signature${locked ? " signed" : ""}`}>
            <span>Buyer</span>
            <strong>
              {locked ? `${project.org} — signed ${project.lockedAt}` : "Awaiting signature"}
            </strong>
          </div>
          <div className={`signature${project.stage === "hired" ? " signed" : ""}`}>
            <span>Developer</span>
            <strong>
              {project.stage === "hired"
                ? `${project.bids.find((b) => b.status === "awarded")?.developerName ?? "Awarded"} — countersigned`
                : "Signs on award"}
            </strong>
          </div>
        </div>
      </div>

      <div className="contract-section">
        <div className={`callout ${locked ? "callout-ok" : "callout-warn"}`}>
          <span>{locked ? "✓" : "!"}</span>
          <span>
            {locked
              ? "Anything not listed above is a change order with its own price and timeline. Delivery is accepted against this list, not against opinion."
              : viewer === "buyer"
                ? "Lock this requirement to open bidding. You can still edit scope until you sign."
                : "The buyer is still finalising scope. You cannot bid until the lock is signed."}
          </span>
        </div>
        {!locked && viewer === "buyer" && onLock && (
          <button
            type="button"
            className="btn btn-lg"
            style={{ marginTop: "1rem" }}
            onClick={onLock}
          >
            Sign and lock requirement
          </button>
        )}
      </div>
    </div>
  );
}
