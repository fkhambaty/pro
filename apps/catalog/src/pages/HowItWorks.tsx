import { Link } from "react-router-dom";
import MarketingLayout from "../components/MarketingLayout";
import { MEMBERSHIP_FEE_LABEL, POSTING_FEE_LABEL } from "../lib/pricing";

const BUYER_STEPS = [
  {
    title: "Describe the outcome in your own words",
    detail:
      "You answer plain questions: who uses it, what should be true when it is finished, what it must include, what you want ruled out. No specification, no technology choices, no jargon. If you can explain it to a colleague, you can post it.",
    takes: "About ten minutes",
  },
  {
    title: "Check the reading of your answers",
    detail:
      "Okavo turns what you wrote into a scope — a list of what is in, what is out, and how each item will be judged complete — plus a sketch of the screens your answers imply. This is where misunderstandings surface, while they are still free to fix.",
    takes: "A few minutes, and you can edit anything",
  },
  {
    title: "Sign the lock",
    detail:
      "Signing freezes the scope, the build budget and the monthly running cost. Okavo keeps an unchangeable copy. From this moment nobody can quietly widen or narrow what was agreed, including us.",
    takes: `${POSTING_FEE_LABEL}, charged once per requirement`,
  },
  {
    title: "Compare bids priced against identical scope",
    detail:
      "Verified developers bid on exactly the same definition of done, so the numbers are comparable. Each bid shows that developer's rating, how often they delivered the locked scope, and how many contracts they have closed.",
    takes: "Most requirements attract bids within a week",
  },
  {
    title: "Hire, then both sides sign the same lock",
    detail:
      "You pick a bid. The developer must countersign the frozen scope before delivery starts — so both parties are bound to the same list before anyone builds.",
    takes: "Countersign unlocks milestones",
  },
  {
    title: "Pay one milestone at a time",
    detail:
      "You release money milestone by milestone, and only after you have checked the work against the signed scope. Okavo-held escrow is being switched on next (Stripe Connect); for now you pay your developer directly against that same schedule and confirm it here.",
    takes: "You are never more than one milestone exposed",
  },
  {
    title: "Accept, and own it",
    detail:
      "On final release the work is yours outright, source included, with a warranty period on anything covered by the signed scope. You close the contract by rating the developer on four things every buyer can actually judge.",
    takes: "Your review becomes part of their public record",
  },
];

const DEV_STEPS = [
  {
    title: "Verify who you are",
    detail:
      "Government ID, reviewed by a person. Until it is approved you cannot bid — the database refuses it. This is what makes a buyer on another continent comfortable hiring you.",
  },
  {
    title: "Sit the recorded build interview",
    detail:
      "Next gate: you build a complete product end to end in a recorded session. AI tooling is allowed; we score the result, not your typing. Today identity approval plus membership is what unlocks bidding; the interview is being switched on as an additional gate.",
  },
  {
    title: "Pay once, bid freely",
    detail:
      `A one-time ${MEMBERSHIP_FEE_LABEL} membership unlocks bidding. Okavo also takes a flat 10% commission on the awarded build. There is no subscription.`,
  },
  {
    title: "Bid on settled work",
    detail:
      "Every requirement you see is already signed. The scope will not move under you, the budget is stated, and the buyer has already paid to post it. You are quoting on a real job, not a maybe.",
  },
  {
    title: "Countersign, then deliver",
    detail:
      "When you are hired you countersign the same frozen lock. Then you are paid milestone by milestone as the buyer accepts the work. Okavo-held escrow is next (Stripe Connect); until then the buyer pays you directly against that schedule. Anything outside the signed scope is a paid change order, never unpaid scope creep.",
  },
];

export default function HowItWorks() {
  return (
    <MarketingLayout>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">How it works</span>
          <h1>Agree exactly what you will get, before anyone writes code</h1>
          <p>
            Most software disputes are not about effort. They are about two
            people who pictured different things and only found out at the end.
            Okavo removes the gap by making the expectation a document.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            Prefer a story with faces?{" "}
            <Link to="/example">Follow the Rose Street Bakery walkthrough</Link>.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>If you need something built</h2>
            <p>Seven steps, in order. You can stop at any point before you sign.</p>
          </div>

          <ol className="journey">
            {BUYER_STEPS.map((step, index) => (
              <li className="journey-step" key={step.title}>
                <div className="journey-num">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                  <span className="journey-meta">{step.takes}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-tight" id="developers">
        <div className="wrap">
          <div className="section-head">
            <h2>If you build software</h2>
            <p>
              Browsing costs nothing. Everything below happens before your first
              bid.
            </p>
          </div>

          <ol className="journey">
            {DEV_STEPS.map((step, index) => (
              <li className="journey-step" key={step.title}>
                <div className="journey-num">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="closer">
            <div>
              <h2>See it as a bakery story — or read the guarantee.</h2>
              <p>
                The example walkthrough retells these steps with Tom and Arjun.
                The guarantee lists six promises and what enforces each one.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <Link className="btn btn-accent btn-lg" to="/example">
                Example walkthrough
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/guarantee">
                The guarantee
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
