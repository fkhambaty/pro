import { money } from "../format";
import { downloadBuildBible } from "../lib/api";
import type { Project } from "../types";

type Props = {
  project: Project;
  viewer: "buyer" | "developer";
  onLock?: () => void;
};

export default function ContractPanel({ project, viewer, onLock }: Props) {
  const frozen =
    project.stage !== "drafting" && project.stage !== "clarifying";
  const clarifying = project.stage === "clarifying";
  const included = project.scope.filter((item) => item.included);
  const excluded = project.scope.filter((item) => !item.included);

  return (
    <div className="contract">
      <div className="contract-head">
        <div>
          <h2>Requirement Lock</h2>
          <p>
            {frozen
              ? `Signed ${project.lockedAt}. This is the only definition of done.`
              : clarifying
                ? "Open for clarification. Bidding stays closed until you freeze."
                : "Not published yet. Finish the draft, then open Q&A or lock."}
          </p>
        </div>
        {frozen ? (
          <span className="contract-id">{project.lockId}</span>
        ) : clarifying ? (
          <span className="badge badge-accent">Q&amp;A window</span>
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
                {item.acceptanceCriteria && (
                  <p style={{ marginTop: "0.3rem", color: "var(--accent)" }}>
                    Accepted when: {item.acceptanceCriteria}
                  </p>
                )}
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
          <div className={`signature${frozen ? " signed" : ""}`}>
            <span>Buyer</span>
            <strong>
              {frozen
                ? `${project.org} — signed ${project.lockedAt}`
                : "Awaiting freeze signature"}
            </strong>
          </div>
          <div
            className={`signature${
              project.developerSignedAt ||
              project.stage === "in_delivery" ||
              project.stage === "delivered" ||
              project.stage === "closed"
                ? " signed"
                : ""
            }`}
          >
            <span>Developer</span>
            <strong>
              {project.developerSignedAt ||
              project.stage === "in_delivery" ||
              project.stage === "delivered" ||
              project.stage === "closed"
                ? `${project.bids.find((b) => b.status === "awarded")?.developerName ?? "Awarded"} — countersigned${project.developerSignedAt ? ` ${project.developerSignedAt}` : ""}`
                : project.stage === "hired"
                  ? "Awarded — funds first milestone, then countersigns"
                  : "Signs after hire + funding gate"}
            </strong>
          </div>
        </div>
      </div>

      <div className="contract-section">
        <div
          className={`callout ${frozen ? "callout-ok" : "callout-warn"}`}
        >
          <span>{frozen ? "✓" : "!"}</span>
          <span>
            {frozen
              ? "Anything not listed above is a change order with its own price and timeline. Delivery is accepted against this list, not against opinion."
              : clarifying
                ? viewer === "buyer"
                  ? "Recommended: leave Q&A open ~48 hours, answer every line question, then sign to freeze and open bids."
                  : "Ask line-item clarifications now. You cannot bid until the buyer freezes this pack."
                : viewer === "buyer"
                  ? "Publish for Q&A or lock when the preview and checklist look right."
                  : "The buyer is still drafting. This brief is not on the board yet."}
          </span>
        </div>
        {!frozen && viewer === "buyer" && onLock && (
          <button
            type="button"
            className="btn btn-lg"
            style={{ marginTop: "1rem" }}
            onClick={onLock}
          >
            {clarifying
              ? "Freeze requirement & open bidding"
              : "Sign and lock requirement"}
          </button>
        )}
        {frozen && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: "1rem" }}
            onClick={() => downloadBuildBible(project)}
          >
            Export build bible (JSON)
          </button>
        )}
      </div>
    </div>
  );
}
