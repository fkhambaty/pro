import { Link } from "react-router-dom";
import MarketingLayout from "../components/MarketingLayout";
import { GUARANTEES } from "../content/trust";
import { POSTING_FEE_LABEL } from "../lib/pricing";

export default function Guarantee() {
  return (
    <MarketingLayout>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">The Okavo guarantee</span>
          <h1>Six promises, and how each one is enforced</h1>
          <p>
            Anyone can promise good work. These are the specific things Okavo
            will not let go wrong, and the mechanism that stops them — not a
            policy you would have to argue about later.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="promise-list">
            {GUARANTEES.map((promise, index) => (
              <article className="promise" key={promise.title}>
                <div className="promise-num">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h2>{promise.title}</h2>
                  <p>{promise.body}</p>
                  <p className="promise-enforced">
                    <strong>How it is enforced</strong> {promise.enforcedBy}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="card card-pad honesty">
            <h2>What we do not promise</h2>
            <p>
              Okavo does not guarantee that software is easy, that every project
              finishes early, or that you will never disagree with your
              developer. Those things happen on every build, everywhere.
            </p>
            <p>
              What we guarantee is that a disagreement is settled against a
              document you both signed before any money moved — instead of two
              people remembering a conversation differently.
            </p>
            <p>
              We also do not yet hold your build payments in escrow. That is
              being switched on next. Today Okavo collects only its own{" "}
              {POSTING_FEE_LABEL} posting fee; you pay your developer directly,
              milestone by milestone, against the schedule in the signed
              contract.
            </p>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="closer">
            <div>
              <h2>See it applied to your own project.</h2>
              <p>
                Describing what you need is free. The {POSTING_FEE_LABEL} fee is
                charged only when you publish.
              </p>
            </div>
            <Link className="btn btn-accent btn-lg" to="/signin">
              Describe what you need
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
