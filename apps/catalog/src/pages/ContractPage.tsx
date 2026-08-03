import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { money } from "../format";
import { REVIEW_CRITERIA, formatRating } from "../lib/reviewCriteria";
import { useStore } from "../store";
import type { ReviewScores } from "../types";

export default function ContractPage() {
  const { id } = useParams();
  const {
    projects,
    role,
    name,
    connected,
    fundMilestone,
    submitMilestone,
    acceptMilestone,
    createChangeOrder,
    priceChangeOrder,
    decideChangeOrder,
    raiseDispute,
    resolveDispute,
    leaveReview,
  } = useStore();

  const project = projects.find((p) => p.id === id);
  const isBuyer = role === "buyer";

  const [changeTitle, setChangeTitle] = useState("");
  const [changeDetail, setChangeDetail] = useState("");
  const [deliverySummary, setDeliverySummary] = useState("");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [activeMilestone, setActiveMilestone] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [scores, setScores] = useState<ReviewScores>({
    scope: 5,
    quality: 5,
    communication: 5,
    timeliness: 5,
  });
  const reviewAverage =
    (scores.scope + scores.quality + scores.communication + scores.timeliness) / 4;
  const [payError, setPayError] = useState<string | null>(null);

  // Escrow moves money to a developer, which needs payout rails Okavo has not
  // switched on yet. Until then the button says so rather than pretending.
  const escrowLive = false;

  function fundEscrow(projectId: string, milestoneId: string) {
    if (!connected) {
      fundMilestone(projectId, milestoneId);
      return;
    }
    setPayError(
      "Escrow is not switched on yet, so this milestone cannot be funded through Okavo. Agree payment directly with your developer for now — the signed scope still governs what has to be delivered."
    );
  }

  if (!project) {
    return (
      <>
        <header className="topbar">
          <h1>Contract</h1>
        </header>
        <div className="content">
          <div className="card empty">
            <strong>Contract not found</strong>
            <Link to="/app">Back to workspace</Link>
          </div>
        </div>
      </>
    );
  }

  const included = project.scope.filter((item) => item.included);
  const excluded = project.scope.filter((item) => !item.included);
  const awarded = project.bids.find((bid) => bid.status === "awarded");
  const contractValue = awarded?.amount ?? project.budgetMax;
  const releasedTotal = project.milestones
    .filter((m) => m.status === "released")
    .reduce((sum, m) => sum + m.amount, 0);
  const escrowTotal = project.milestones
    .filter((m) => m.status === "funded" || m.status === "submitted")
    .reduce((sum, m) => sum + m.amount, 0);
  const canReview =
    project.stage === "delivered" && project.reviews.length === 0 && isBuyer;

  function submitChangeOrder() {
    if (!project || !changeTitle.trim()) return;
    createChangeOrder(project.id, {
      title: changeTitle.trim(),
      description: changeDetail.trim() || "No further detail provided.",
      raisedBy: isBuyer ? "buyer" : "developer",
    });
    setChangeTitle("");
    setChangeDetail("");
  }

  function submitWork(milestoneId: string) {
    if (!project) return;
    submitMilestone(
      project.id,
      milestoneId,
      deliverySummary.trim() || "Work submitted for review.",
      deliveryUrl.trim()
    );
    setActiveMilestone(null);
    setDeliverySummary("");
    setDeliveryUrl("");
  }

  return (
    <>
      <header className="topbar">
        <h1>{project.title}</h1>
        <div className="topbar-actions">
          <span className="badge">{project.lockId ?? "Unsigned"}</span>
          <Link className="btn btn-secondary btn-sm" to={`/app/project/${project.id}`}>
            Requirement and bids
          </Link>
        </div>
      </header>

      <div className="content">
        <div className="split">
          <div className="stack">
            <div className="contract">
              <div className="contract-head">
                <div>
                  <h2>Contract {project.lockId}</h2>
                  <p>
                    {project.org} and {project.awardedTo ?? "an awarded developer"} ·
                    Locked {project.lockedAt}
                  </p>
                </div>
                <span className="contract-id">v{project.versions.length}</span>
              </div>

              <div className="contract-section">
                <h3>Commercial terms</h3>
                <div className="terms">
                  <div className="term">
                    <span>Agreed build price</span>
                    <strong>{money(contractValue)}</strong>
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
                <h3>In scope — the definition of done</h3>
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

              {excluded.length > 0 && (
                <div className="contract-section">
                  <h3>Out of scope</h3>
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
              )}

              <div className="contract-section">
                <h3>Signatures</h3>
                <div className="signature-row">
                  <div className="signature signed">
                    <span>Buyer</span>
                    <strong>
                      {project.org} — signed {project.lockedAt}
                    </strong>
                  </div>
                  <div className={`signature${awarded ? " signed" : ""}`}>
                    <span>Developer</span>
                    <strong>
                      {awarded
                        ? `${awarded.developerName} — countersigned`
                        : "Signs on award"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="contract-section">
                <h3>Warranty</h3>
                <p style={{ color: "var(--body)" }}>
                  Defects measured against this scope are fixed free for{" "}
                  {project.warrantyDays} days after acceptance. New behaviour is a
                  change order, not a warranty claim.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Milestones and escrow</h2>
                <span className="badge">
                  {money(releasedTotal)} released · {money(escrowTotal)} held
                </span>
              </div>
              <div style={{ padding: "1.25rem" }} className="stack-sm">
                {payError && (
                  <div className="callout callout-warn" role="alert">
                    <span>!</span>
                    <span>{payError}</span>
                  </div>
                )}

                {project.milestones.length === 0 && (
                  <div className="empty">
                    <strong>No milestones yet</strong>
                    Milestones are created when a bid is awarded.
                  </div>
                )}

                {project.milestones.map((milestone) => (
                  <div className="milestone" key={milestone.id}>
                    <div className="milestone-top">
                      <div>
                        <strong>{milestone.title}</strong>
                        <p>{milestone.description}</p>
                      </div>
                      <div className="money">
                        <strong>{money(milestone.amount)}</strong>
                        <span>{milestone.status.replace("_", " ")}</span>
                      </div>
                    </div>

                    {milestone.deliverable && (
                      <div className="deliverable">
                        <strong>Submitted {milestone.deliverable.submittedAt}</strong>
                        <p>{milestone.deliverable.summary}</p>
                        {milestone.deliverable.previewUrl && (
                          <a
                            href={milestone.deliverable.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {milestone.deliverable.previewUrl}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="bid-actions">
                      {isBuyer && milestone.status === "pending" && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => fundEscrow(project.id, milestone.id)}
                        >
                          {escrowLive
                            ? `Fund escrow ${money(milestone.amount)}`
                            : `Escrow ${money(milestone.amount)} — not live yet`}
                        </button>
                      )}
                      {isBuyer && milestone.status === "submitted" && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => acceptMilestone(project.id, milestone.id)}
                        >
                          Accept and release
                        </button>
                      )}
                      {!isBuyer &&
                        (milestone.status === "funded" ||
                          milestone.status === "in_progress") && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setActiveMilestone(milestone.id)}
                          >
                            Submit work
                          </button>
                        )}
                      {milestone.status === "released" && (
                        <span className="badge badge-lock">Paid out</span>
                      )}
                      {!isBuyer && milestone.status === "pending" && (
                        <span className="badge badge-draft">Awaiting escrow funding</span>
                      )}
                    </div>

                    {activeMilestone === milestone.id && (
                      <div className="submit-box">
                        <div className="field">
                          <label htmlFor="summary">What did you deliver?</label>
                          <textarea
                            id="summary"
                            rows={3}
                            value={deliverySummary}
                            onChange={(event) => setDeliverySummary(event.target.value)}
                            placeholder="Which locked scope items this covers."
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="url">Preview link</label>
                          <input
                            id="url"
                            value={deliveryUrl}
                            onChange={(event) => setDeliveryUrl(event.target.value)}
                            placeholder="https://staging.example.com"
                          />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => submitWork(milestone.id)}
                          >
                            Submit for review
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveMilestone(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Change orders</h2>
                <span className="badge">{project.changeOrders.length}</span>
              </div>
              <div style={{ padding: "1.25rem" }} className="stack-sm">
                <div className="callout callout-info">
                  <span>i</span>
                  <span>
                    Anything outside the locked scope lives here with its own price
                    and timeline. The original promise never silently changes.
                  </span>
                </div>

                {project.changeOrders.map((order) => (
                  <div className="bid" key={order.id}>
                    <div className="bid-top">
                      <div>
                        <strong>{order.title}</strong>
                        <p style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                          Raised by {order.raisedBy} on {order.createdAt}
                        </p>
                      </div>
                      <div className="money">
                        <strong>
                          {order.amount ? money(order.amount) : "Not priced"}
                        </strong>
                        <span>
                          {order.addedWeeks > 0
                            ? `+${order.addedWeeks} week${order.addedWeeks > 1 ? "s" : ""}`
                            : "No timeline impact"}
                        </span>
                      </div>
                    </div>
                    <p className="bid-note">{order.description}</p>
                    <div className="bid-actions">
                      {order.status === "proposed" && !isBuyer && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            priceChangeOrder(project.id, order.id, 900, 1)
                          }
                        >
                          Price at $900, +1 week
                        </button>
                      )}
                      {order.status === "priced" && isBuyer && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              decideChangeOrder(project.id, order.id, true)
                            }
                          >
                            Accept and add to scope
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              decideChangeOrder(project.id, order.id, false)
                            }
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {order.status === "accepted" && (
                        <span className="badge badge-lock">Added to scope</span>
                      )}
                      {order.status === "declined" && (
                        <span className="badge badge-danger">Declined</span>
                      )}
                      {order.status === "proposed" && isBuyer && (
                        <span className="badge badge-draft">Awaiting a price</span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="submit-box">
                  <div className="field">
                    <label htmlFor="co-title">Raise a change order</label>
                    <input
                      id="co-title"
                      value={changeTitle}
                      onChange={(event) => setChangeTitle(event.target.value)}
                      placeholder="Add a yearly statement PDF"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="co-detail">Why is it needed?</label>
                    <textarea
                      id="co-detail"
                      rows={2}
                      value={changeDetail}
                      onChange={(event) => setChangeDetail(event.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!changeTitle.trim()}
                    onClick={submitChangeOrder}
                  >
                    Submit change order
                  </button>
                </div>
              </div>
            </div>

            {canReview && (
              <div className="card">
                <div className="card-head">
                  <h2>Close the contract</h2>
                  <span className="badge badge-accent">
                    Overall {reviewAverage.toFixed(1)} / 5
                  </span>
                </div>
                <div style={{ padding: "1.25rem" }}>
                  <p className="hint" style={{ marginBottom: "1.25rem" }}>
                    Four questions, answered from the contract you signed. The
                    overall score is their average — you do not set it
                    separately, so the number always matches the detail.
                  </p>

                  {REVIEW_CRITERIA.map((criterion) => (
                    <div className="field" key={criterion.key}>
                      <label htmlFor={`score-${criterion.key}`}>
                        {criterion.label}
                      </label>
                      <span
                        className="hint"
                        style={{ display: "block", marginBottom: "0.4rem" }}
                      >
                        {criterion.help}
                      </span>
                      <select
                        id={`score-${criterion.key}`}
                        value={scores[criterion.key]}
                        onChange={(event) =>
                          setScores((prev) => ({
                            ...prev,
                            [criterion.key]: Number(event.target.value),
                          }))
                        }
                      >
                        {criterion.options.map((option, index) => (
                          <option key={option} value={5 - index}>
                            {5 - index} — {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}

                  <div className="field">
                    <label htmlFor="review">
                      Anything the next buyer should know
                    </label>
                    <textarea
                      id="review"
                      rows={3}
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="What went well, and what you would watch for."
                    />
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      leaveReview(project.id, {
                        scores,
                        comment: reviewComment.trim() || "No comment left.",
                        author: name || project.org,
                      })
                    }
                  >
                    Publish review and close
                  </button>
                </div>
              </div>
            )}

            {project.reviews.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h2>Review</h2>
                </div>
                <div style={{ padding: "1.25rem" }}>
                  {project.reviews.map((review) => (
                    <div key={review.id}>
                      <strong>
                        {formatRating(review.rating)} / 5 ·{" "}
                        {review.matchedExpectation
                          ? "Matched the locked expectation"
                          : "Did not match"}
                      </strong>
                      <div className="score-grid">
                        {REVIEW_CRITERIA.map((criterion) => (
                          <div className="score-cell" key={criterion.key}>
                            <span>{criterion.short}</span>
                            <strong>{review.scores[criterion.key]}</strong>
                          </div>
                        ))}
                      </div>
                      <p style={{ color: "var(--body)", marginTop: "0.35rem" }}>
                        {review.comment}
                      </p>
                      <p style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                        {review.author} · {review.createdAt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="sticky-side">
            <div className="card card-pad">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
                Money
              </h3>
              <div className="stat-row" style={{ gridTemplateColumns: "1fr", marginBottom: 0, gap: "0.6rem" }}>
                <div className="stat">
                  <span>Contract value</span>
                  <strong>{money(contractValue)}</strong>
                </div>
                <div className="stat">
                  <span>Held in escrow</span>
                  <strong>{money(escrowTotal)}</strong>
                </div>
                <div className="stat">
                  <span>Released</span>
                  <strong>{money(releasedTotal)}</strong>
                </div>
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
                Version history
              </h3>
              <div className="timeline">
                {project.versions.map((version) => (
                  <div className="timeline-item" key={version.version}>
                    <strong>v{version.version}</strong>
                    <p>{version.reason}</p>
                    <span>{version.createdAt}</span>
                  </div>
                ))}
                {project.versions.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>Not locked yet.</p>
                )}
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.6rem" }}>
                Dispute
              </h3>
              {project.dispute ? (
                <>
                  <span
                    className={
                      project.dispute.status === "resolved"
                        ? "badge badge-lock"
                        : "badge badge-danger"
                    }
                  >
                    {project.dispute.status}
                  </span>
                  <p style={{ color: "var(--body)", margin: "0.6rem 0" }}>
                    {project.dispute.reason}
                  </p>
                  {project.dispute.resolutionNote && (
                    <p style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                      {project.dispute.resolutionNote}
                    </p>
                  )}
                  {project.dispute.status !== "resolved" && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-block"
                      onClick={() =>
                        resolveDispute(
                          project.id,
                          "Resolved by Okavo review against the locked scope."
                        )
                      }
                    >
                      Mark resolved
                    </button>
                  )}
                </>
              ) : showDispute ? (
                <>
                  <div className="field">
                    <label htmlFor="dispute">What went wrong?</label>
                    <textarea
                      id="dispute"
                      rows={3}
                      value={disputeReason}
                      onChange={(event) => setDisputeReason(event.target.value)}
                      placeholder="Point to the scope item that was not met."
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-block"
                    disabled={!disputeReason.trim()}
                    onClick={() => {
                      raiseDispute(
                        project.id,
                        disputeReason,
                        isBuyer ? "buyer" : "developer"
                      );
                      setShowDispute(false);
                      setDisputeReason("");
                    }}
                  >
                    Open dispute
                  </button>
                </>
              ) : (
                <>
                  <p style={{ color: "var(--muted)", marginBottom: "0.85rem" }}>
                    Escrow is held while a dispute is reviewed against the locked
                    scope.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-block"
                    onClick={() => setShowDispute(true)}
                  >
                    Raise a dispute
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
