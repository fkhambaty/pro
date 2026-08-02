import { Link } from "react-router-dom";
import MarketingLayout from "../components/MarketingLayout";

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
    takes: "$1, charged once per requirement",
  },
  {
    title: "Compare bids priced against identical scope",
    detail:
      "Verified developers bid on exactly the same definition of done, so the numbers are comparable. Each bid shows that developer's rating, how often they delivered the locked scope, and how many contracts they have closed.",
    takes: "Most requirements attract bids within a week",
  },
  {
    title: "Fund one milestone at a time",
    detail:
      "You release money milestone by milestone, and only after you have checked the work against the scope. Escrow is held by our payment provider, not by the developer and not by Okavo.",
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
      "Government ID, reviewed by a person. Until it is approved you cannot bid — the database refuses it. This is what makes a buyer on another continent comfortable sending money.",
  },
  {
    title: "Sit the recorded build interview",
    detail:
      "You build a complete product end to end in a recorded session. AI tooling is allowed; we score the result, not your typing. Security, efficiency under pressure, maintainability and recovery from mistakes.",
  },
  {
    title: "Pay once, bid freely",
    detail:
      "A one-time $10 membership unlocks bidding across the whole marketplace. There is no commission on what you earn and no subscription.",
  },
  {
    title: "Bid on settled work",
    detail:
      "Every requirement you see is already signed. The scope will not move under you, the budget is stated, and the buyer has already paid to post it. You are quoting on a real job, not a maybe.",
  },
  {
    title: "Get paid on acceptance",
    detail:
      "The buyer funds each milestone into escrow before you start it, so you can see the money exists. It releases to you when they accept the work. Anything outside the signed scope is a paid change order, never unpaid scope creep.",
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
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>If you need something built</h2>
            <p>Six steps, in order. You can stop at any point before you sign.</p>
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
              <h2>Read the guarantee next.</h2>
              <p>
                Six promises, and the mechanism that enforces each one.
              </p>
            </div>
            <Link className="btn btn-accent btn-lg" to="/guarantee">
              The guarantee
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
