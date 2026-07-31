import { Link } from "react-router-dom";
import Logo from "../components/Logo";

const BUILDS = [
  "A website",
  "A mobile app",
  "An online store",
  "A booking system",
  "An internal tool",
  "A customer portal",
  "An AI feature",
  "Whatever you can describe",
];

const BUYERS = [
  "A school principal",
  "A bakery with two counters",
  "A clinic in Nairobi",
  "A logistics firm in São Paulo",
  "A government department",
  "A Series B startup",
  "A Fortune 500 board",
];

export default function Landing() {
  return (
    <>
      <header className="market-nav">
        <div className="wrap market-nav-inner">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="market-links">
            <a href="#build">What you can build</a>
            <a href="#how">How it works</a>
            <a href="#buyers">For buyers</a>
            <a href="#developers">For developers</a>
          </nav>
          <div className="nav-right">
            <Link className="btn btn-secondary btn-sm" to="/signin">
              Sign in
            </Link>
            <Link className="btn btn-accent btn-sm" to="/signin">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">Websites · Apps · Software</span>
              <h1>Where the world comes to have software built.</h1>
              <p className="hero-lead">
                Describe what you need in your own words. Okavo turns it into a
                signed agreement, then verified developers build exactly that.
                A school principal and a global CEO use the same four steps and
                get the same certainty.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-accent btn-lg" to="/signin">
                  Describe what you need
                </Link>
                <Link className="btn btn-secondary btn-lg" to="/signin">
                  Build on Okavo
                </Link>
              </div>
            </div>

            <div className="lock-card">
              <div className="lock-card-head">
                <span>Requirement Lock</span>
                <span className="lock-ref">OKV-4F2A91</span>
              </div>
              <div className="lock-card-body">
                <div className="lock-line">
                  <span className="tick">✓</span> Customer sign-in and account
                </div>
                <div className="lock-line">
                  <span className="tick">✓</span> Invoice history and downloads
                </div>
                <div className="lock-line">
                  <span className="tick">✓</span> Payment method management
                </div>
                <div className="lock-line">
                  <span className="tick">✓</span> Usage reports export
                </div>
                <div className="lock-line">
                  <span className="tick cross">✕</span> Native mobile app —
                  excluded
                </div>
              </div>
              <div className="lock-card-foot">
                <span>Build $9,000–$14,000</span>
                <span>Run $240 / month</span>
              </div>
            </div>
          </div>

          <div className="scale-strip">
            <div className="scale-item">
              <strong>74</strong>
              <span>Countries with verified developers</span>
            </div>
            <div className="scale-item">
              <strong>1 form</strong>
              <span>No technical brief required</span>
            </div>
            <div className="scale-item">
              <strong>0</strong>
              <span>Surprise change requests after signing</span>
            </div>
            <div className="scale-item">
              <strong>$1 / $10</strong>
              <span>To post a requirement / to unlock bidding</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="build">
        <div className="wrap">
          <div className="section-head">
            <h2>If you can describe it, it can be built here</h2>
            <p>
              One place for everything you might need made — no agency hunt, no
              shortlist of quotes, no wondering who to trust.
            </p>
          </div>
          <div className="buyers-strip">
            {BUILDS.map((item) => (
              <span className="buyer-chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight" id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>Nothing gets built until you sign what it means</h2>
            <p>
              Software goes wrong when the person paying pictured one thing and
              received another. Okavo removes the gap: your expectation becomes
              a written agreement, signed by both sides, before work begins.
            </p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h4>Describe the outcome</h4>
              <p>
                Plain language. No specification, no stack decisions, no jargon.
              </p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h4>Review what it means</h4>
              <p>
                We turn your answers into a precise list of what is in and what
                is out.
              </p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h4>Sign the lock</h4>
              <p>
                Scope, build budget and monthly running cost are frozen and
                signed.
              </p>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <h4>Developers compete</h4>
              <p>
                Verified engineers bid on identical scope. No moving targets.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="section-head">
            <h2>The same four steps, whoever you are</h2>
            <p>
              Okavo does not have a small-business version and an enterprise
              version. Everyone gets the lock, the escrow and the guarantee.
            </p>
          </div>
          <div className="buyers-strip">
            {BUYERS.map((buyer) => (
              <span className="buyer-chip" key={buyer}>
                {buyer}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap pov-grid">
          <div className="pov" id="buyers">
            <span className="pov-tag">For buyers</span>
            <h3>You never hire a developer</h3>
            <p>You commission an outcome and receive working software.</p>
            <ul>
              <li>
                <span className="dot" />
                Answer simple questions instead of writing a specification
              </li>
              <li>
                <span className="dot" />
                Set what you can pay to build it and to run it each month
              </li>
              <li>
                <span className="dot" />
                Compare bids priced against identical, locked scope
              </li>
              <li>
                <span className="dot" />
                Fund milestones into escrow, release only on acceptance
              </li>
              <li>
                <span className="dot" />
                Changes after signing arrive as a quote, never a surprise
              </li>
              <li>
                <span className="dot" />
                $1 per requirement keeps the board serious on both sides
              </li>
            </ul>
            <Link className="btn btn-accent" to="/signin">
              Describe what you need
            </Link>
          </div>

          <div className="pov" id="developers">
            <span className="pov-tag">For developers</span>
            <h3>Prove it once, then build</h3>
            <p>
              Browsing is free. A one-time $10 membership unlocks bidding.
            </p>
            <ul>
              <li>
                <span className="dot" />
                Verified with government ID and a recorded build interview
              </li>
              <li>
                <span className="dot" />
                Judged on security, efficiency and maintainability, not puzzles
              </li>
              <li>
                <span className="dot" />
                Every project arrives with scope and budget already settled
              </li>
              <li>
                <span className="dot" />
                Escrow funded before you start, released on acceptance
              </li>
              <li>
                <span className="dot" />
                Extra work is a paid change order, never scope creep
              </li>
            </ul>
            <Link className="btn btn-secondary" to="/signin">
              Apply as a developer
            </Link>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="closer">
            <div>
              <h2>Say what you need. Lock it. Get it built.</h2>
              <p>
                Start with a description in your own words. Nothing reaches a
                developer until you have signed what it means.
              </p>
            </div>
            <Link className="btn btn-accent btn-lg" to="/signin">
              Get started
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-inner">
          <Logo size={20} />
          <span>Websites, apps and software — built on a signed agreement.</span>
        </div>
      </footer>
    </>
  );
}
