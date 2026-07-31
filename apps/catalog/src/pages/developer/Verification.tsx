import { useState } from "react";
import IdentityUpload from "./IdentityUpload";
import { money } from "../../format";
import { BIDDING_MEMBERSHIP_CENTS } from "../../lib/supabase";
import { useStore } from "../../store";

const MEMBERSHIP_PRICE = BIDDING_MEMBERSHIP_CENTS / 100;

const IDENTITY_LABEL: Record<string, string> = {
  not_started: "Not started",
  submitted: "In review",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

export default function Verification() {
  const { name, developerAccount, payMembership, submitInterview, refresh } =
    useStore();
  const [paying, setPaying] = useState(false);
  const [card, setCard] = useState("");

  const identityStatus = developerAccount.identityStatus;
  const identityApproved = identityStatus === "approved";

  const overall = Math.round(
    developerAccount.interviewScores.reduce((sum, s) => sum + s.score, 0) /
      developerAccount.interviewScores.length
  );

  function completePayment() {
    payMembership();
    setPaying(false);
    setCard("");
  }

  return (
    <>
      <header className="topbar">
        <h1>Verification and membership</h1>
        <div className="topbar-actions">
          {developerAccount.membershipPaid ? (
            <span className="badge badge-lock">Bidding active</span>
          ) : (
            <span className="badge badge-draft">Bidding locked</span>
          )}
        </div>
      </header>

      <div className="content content-narrow">
        <div className="stack">
          <div
            className={
              developerAccount.membershipPaid
                ? "card membership paid"
                : "card membership"
            }
          >
            <div className="membership-body">
              <div>
                <h2>One-time bidding membership</h2>
                <p>
                  {developerAccount.membershipPaid
                    ? `Paid on ${developerAccount.membershipPaidAt}. You can bid on any locked requirement.`
                    : "Pay once to unlock bidding. This keeps the board free of throwaway accounts and spam proposals."}
                </p>
              </div>
              <div className="membership-price">
                <strong>{money(MEMBERSHIP_PRICE)}</strong>
                <span>one time</span>
              </div>
            </div>

            {!developerAccount.membershipPaid && !paying && (
              <div className="membership-foot">
                <ul className="membership-list">
                  <li>Unlimited bids on locked requirements</li>
                  <li>Escrow-protected contracts</li>
                  <li>Payouts after buyer acceptance</li>
                  <li>Non-refundable, charged once per account</li>
                </ul>
                <button type="button" className="btn btn-lg" onClick={() => setPaying(true)}>
                  Pay {money(MEMBERSHIP_PRICE)} and activate bidding
                </button>
              </div>
            )}

            {paying && (
              <div className="membership-foot">
                <div className="field">
                  <label htmlFor="card">Card number</label>
                  <input
                    id="card"
                    value={card}
                    onChange={(event) => setCard(event.target.value)}
                    placeholder="4242 4242 4242 4242"
                  />
                  <span className="hint">
                    Demo checkout. Wire this to Stripe before going live.
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={card.trim().length < 4}
                    onClick={completePayment}
                  >
                    Pay {money(MEMBERSHIP_PRICE)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPaying(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {developerAccount.membershipPaid && (
              <div className="membership-foot">
                <div
                  className={identityApproved ? "callout callout-ok" : "callout callout-warn"}
                >
                  <span>{identityApproved ? "✓" : "!"}</span>
                  <span>
                    {identityApproved
                      ? "Membership active. You can bid on any locked requirement."
                      : "Membership paid. Bidding opens once your government ID is approved."}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Government ID</h2>
              <span
                className={
                  identityApproved
                    ? "badge badge-lock"
                    : identityStatus === "rejected"
                      ? "badge badge-danger"
                      : "badge badge-draft"
                }
              >
                {IDENTITY_LABEL[identityStatus] ?? identityStatus}
              </span>
            </div>
            <div style={{ padding: "1.25rem" }}>
              {identityApproved ? (
                <>
                  <div className="verify-item">
                    <span className="verify-icon">✓</span>
                    <div>
                      <strong>Identity confirmed</strong>
                      <p>
                        Your document passed review. Buyers see a verified badge,
                        never the document itself.
                      </p>
                    </div>
                  </div>
                  <div className="verify-item">
                    <span className="verify-icon pending">•</span>
                    <div>
                      <strong>Annual re-verification</strong>
                      <p>You will be reminded 30 days before it is due.</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ color: "var(--body)", marginBottom: "1.25rem" }}>
                    Bidding requires a verified identity. This is what makes a
                    buyer in another country comfortable sending you money.
                  </p>
                  <IdentityUpload status={identityStatus} onSubmitted={refresh} />
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Recorded build interview</h2>
              {developerAccount.interviewStatus === "approved" ? (
                <span className="badge badge-accent">Score {overall}</span>
              ) : (
                <span className="badge badge-draft">Awaiting submission</span>
              )}
            </div>
            <div style={{ padding: "1.25rem" }}>
              <p style={{ color: "var(--body)", marginBottom: "1.25rem" }}>
                {name || "You"} built a complete product end to end in a recorded
                four-hour session. AI tooling was permitted. The assessment scores
                the result, not the typing.
              </p>

              <div className="stack-sm">
                {developerAccount.interviewScores.map((criterion) => (
                  <div key={criterion.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span>{criterion.label}</span>
                      <strong>{criterion.score}</strong>
                    </div>
                    <div className="score-bar">
                      <i style={{ width: `${criterion.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {developerAccount.interviewStatus !== "approved" && (
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: "1.25rem" }}
                  onClick={submitInterview}
                >
                  Submit recording for assessment
                </button>
              )}

              <div className="callout callout-info" style={{ marginTop: "1.25rem" }}>
                <span>i</span>
                <span>
                  Buyers never see raw scores. They see your tier and your delivery
                  record against locked contracts.
                </span>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
              Delivery record
            </h3>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <div className="stat">
                <span>Contracts delivered</span>
                <strong>27</strong>
              </div>
              <div className="stat">
                <span>Accepted first pass</span>
                <strong>92%</strong>
              </div>
              <div className="stat">
                <span>Change orders raised</span>
                <strong>1.3</strong>
              </div>
              <div className="stat">
                <span>Disputes</span>
                <strong>0</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
