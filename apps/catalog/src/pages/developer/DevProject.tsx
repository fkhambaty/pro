import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ContractPanel from "../../components/ContractPanel";
import { money } from "../../format";
import { useStore } from "../../store";

export default function DevProject() {
  const { id } = useParams();
  const { projects, placeBid, developerAccount } = useStore();
  const project = projects.find((p) => p.id === id);

  const [amount, setAmount] = useState("");
  const [monthly, setMonthly] = useState("");
  const [weeks, setWeeks] = useState("");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!project) {
    return (
      <>
        <header className="topbar">
          <h1>Project</h1>
        </header>
        <div className="content">
          <div className="card empty">
            <strong>This project is no longer listed</strong>
            <Link to="/app">Back to board</Link>
          </div>
        </div>
      </>
    );
  }

  const locked = project.stage !== "drafting";
  const identityApproved = developerAccount.identityStatus === "approved";
  const canBid = locked && developerAccount.membershipPaid && identityApproved;
  const readyToSubmit = canBid && accepted && amount.trim() !== "" && !submitted;

  async function submitBid() {
    if (!project) return;

    const bidAmount = Number(amount);
    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      setFormError("Enter a build price greater than zero.");
      return;
    }
    const bidWeeks = weeks.trim() === "" ? project.timelineWeeks : Number(weeks);
    if (!Number.isFinite(bidWeeks) || bidWeeks <= 0) {
      setFormError("Delivery time must be a positive number of weeks.");
      return;
    }
    const bidMonthly =
      monthly.trim() === "" ? project.monthlyOps : Number(monthly);
    if (!Number.isFinite(bidMonthly) || bidMonthly < 0) {
      setFormError("Monthly running cost must be zero or more.");
      return;
    }

    setFormError(null);
    setBusy(true);
    const ok = await placeBid(project.id, {
      amount: bidAmount,
      monthlyOps: bidMonthly,
      weeks: bidWeeks,
      note: note || "Bid submitted against the locked requirement.",
    });
    setBusy(false);

    if (ok) {
      setSubmitted(true);
      return;
    }
    setFormError(
      "Your bid was not accepted. Check the banner above for the reason, then try again."
    );
  }

  return (
    <>
      <header className="topbar">
        <h1>{project.title}</h1>
        <div className="topbar-actions">
          <span className="badge">{project.org}</span>
          {locked ? (
            <span className="badge badge-lock">{project.lockId}</span>
          ) : (
            <span className="badge badge-draft">Bidding closed</span>
          )}
        </div>
      </header>

      <div className="content">
        <div className="split">
          <div className="stack">
            <ContractPanel project={project} viewer="developer" />
          </div>

          <aside className="sticky-side">
            <div className="card card-pad">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
                Place your bid
              </h3>

              {!locked && (
                <div className="callout callout-warn" style={{ marginBottom: "1rem" }}>
                  <span>!</span>
                  <span>
                    The buyer has not signed the Requirement Lock. Bidding is
                    disabled until scope is frozen.
                  </span>
                </div>
              )}

              {locked && !identityApproved && (
                <div className="paywall" style={{ marginBottom: "1rem" }}>
                  <div>
                    <strong>Verify your identity first</strong>
                    <p>
                      Buyers only see bids from developers Okavo has checked
                      against a government ID.
                    </p>
                  </div>
                  <Link className="btn btn-sm" to="/app/verification">
                    Start verification
                  </Link>
                </div>
              )}

              {locked && identityApproved && !developerAccount.membershipPaid && (
                <div className="paywall" style={{ marginBottom: "1rem" }}>
                  <div>
                    <strong>Pay $10 once to bid</strong>
                    <p>
                      Your identity is verified. The one-time membership activates
                      bidding across the whole marketplace.
                    </p>
                  </div>
                  <Link className="btn btn-sm" to="/app/verification">
                    Activate bidding
                  </Link>
                </div>
              )}

              {submitted ? (
                <div className="callout callout-ok">
                  <span>✓</span>
                  <span>
                    Bid submitted for {money(Number(amount) || 0)}. You will be
                    notified if the buyer shortlists you.
                  </span>
                </div>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="amount">Fixed build price (USD)</label>
                    <input
                      id="amount"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder={String(project.budgetMin)}
                      disabled={!canBid}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="monthly">Monthly running cost (USD)</label>
                    <input
                      id="monthly"
                      value={monthly}
                      onChange={(event) => setMonthly(event.target.value)}
                      placeholder={String(project.monthlyOps)}
                      disabled={!canBid}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="weeks">Delivery in (weeks)</label>
                    <input
                      id="weeks"
                      value={weeks}
                      onChange={(event) => setWeeks(event.target.value)}
                      placeholder={String(project.timelineWeeks)}
                      disabled={!canBid}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="note">Message to the buyer</label>
                    <textarea
                      id="note"
                      rows={3}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="How you will deliver this exact scope."
                      disabled={!canBid}
                    />
                  </div>

                  <label className="check" style={{ marginBottom: "1rem" }}>
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(event) => setAccepted(event.target.checked)}
                      disabled={!canBid}
                    />
                    I accept the locked scope as the definition of done
                  </label>

                  {formError && (
                    <div
                      className="callout callout-warn"
                      style={{ marginBottom: "1rem" }}
                      role="alert"
                    >
                      <span>!</span>
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-block"
                    disabled={!readyToSubmit || busy}
                    onClick={submitBid}
                  >
                    {busy ? "Submitting…" : "Submit bid"}
                  </button>
                </>
              )}
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.6rem" }}>
                Competition
              </h3>
              <p style={{ color: "var(--muted)" }}>
                {project.bids.length} developers have bid on this identical scope.
                {project.bids.length > 0 &&
                  ` Lowest ${money(Math.min(...project.bids.map((b) => b.amount)))}.`}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
