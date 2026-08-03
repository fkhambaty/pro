import { Link } from "react-router-dom";
import MarketingLayout from "../components/MarketingLayout";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "../brand";

const CONTROLS = [
  {
    area: "Payments",
    detail:
      "Platform fees are collected by Razorpay, an RBI-licensed payment aggregator. Card and UPI details never touch our servers — payment happens inside Razorpay's own checkout. A fee is only ever recorded as paid when Razorpay confirms it by signed webhook, so a modified browser cannot claim a payment that did not happen.",
  },
  {
    area: "Your requirements",
    detail:
      "A draft requirement is visible only to you until you sign it. Once signed, verified developers can see the scope so they can bid — they cannot see your other projects, your contracts, your payments or anyone else's.",
  },
  {
    area: "Separation between accounts",
    detail:
      "Isolation is enforced by the database itself through row-level security, not by application code. Even if a bug reached production, one buyer's query cannot return another buyer's contracts.",
  },
  {
    area: "Identity documents",
    detail:
      "Government IDs uploaded by developers go into private storage that is unreadable without an authorised, expiring link. They are reviewed by a person and are never shown to buyers — buyers see only the resulting verification status and tier.",
  },
  {
    area: "Personal details",
    detail:
      "Email addresses and billing details are readable only by their owner. The marketplace exposes a name, a country and a company name, because that is what the transaction needs — nothing beyond it.",
  },
  {
    area: "Where your data lives",
    detail:
      "Application data is hosted with Supabase on managed Postgres with encryption at rest and in transit, and the site is served over HTTPS only. If your organisation needs data to stay in a particular region, make it a line in your locked scope and developers bid against that requirement.",
  },
  {
    area: "Analytics",
    detail:
      "We count visits to okavo.org first-party, without third-party advertising trackers. No raw IP address is stored; unique visitors are a salted hash that rotates every day, so traffic can be counted without identifying a person.",
  },
];

export default function Security() {
  return (
    <MarketingLayout>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Security</span>
          <h1>Where your money, your documents and your data actually sit</h1>
          <p>
            Written for the person who has to sign off on spending real money
            with a company they have not used before. No certification badges
            we have not earned — just what is true today.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="promise-list">
            {CONTROLS.map((control) => (
              <article className="promise" key={control.area}>
                <div className="promise-num">—</div>
                <div>
                  <h2>{control.area}</h2>
                  <p>{control.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="card card-pad honesty">
            <h2>What we are not claiming</h2>
            <p>
              Okavo is not SOC 2 certified, not ISO 27001 certified, and has not
              completed a third-party penetration test. Those take time and
              money a company of our age has not spent yet, and we would rather
              say so than imply otherwise with a badge.
            </p>
            <p>
              If your procurement process requires any of those before you can
              buy, tell us at{" "}
              <a className="footer-mail" href={SUPPORT_MAILTO}>
                {SUPPORT_EMAIL}
              </a>{" "}
              — it is useful for us to know which one blocks you first.
            </p>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="closer">
            <div>
              <h2>Found something we should fix?</h2>
              <p>
                Report a security issue to {SUPPORT_EMAIL} and we will reply.
                We will not threaten anyone who reports a vulnerability in good
                faith.
              </p>
            </div>
            <Link className="btn btn-accent btn-lg" to="/guarantee">
              Read the guarantee
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
