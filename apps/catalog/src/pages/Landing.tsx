import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <>
      <header className="market-nav">
        <div className="wrap market-nav-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">F</span> Forma
          </Link>
          <nav className="market-links">
            <a href="#buyers">For buyers</a>
            <a href="#developers">For developers</a>
            <a href="#lock">Requirement Lock</a>
          </nav>
          <div className="nav-right">
            <Link className="btn btn-secondary btn-sm" to="/signin">
              Sign in
            </Link>
            <Link className="btn btn-sm" to="/signin">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Global marketplace · 74 countries</span>
            <h1>Say what you need. Lock it. Get it built.</h1>
            <p>
              Forma connects buyers with verified AI-native developers. Before
              anyone writes code, your requirement becomes a signed contract —
              so what you imagined is what gets delivered.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-lg" to="/signin">
                Post a requirement
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/signin">
                Find work as a developer
              </Link>
            </div>
            <div className="hero-scale">
              <span>Corner shops</span>
              <span>Clinics and schools</span>
              <span>Funded startups</span>
              <span>Global enterprises</span>
            </div>
          </div>

          <div className="lock-preview">
            <div className="lock-preview-head">
              <span>Requirement Lock</span>
              <span className="contract-id">LOCK-4F2A91</span>
            </div>
            <div className="lock-preview-body">
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
            <div className="lock-preview-foot">
              <span>Build $9,000–$14,000</span>
              <span>Run $240 / month</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="lock">
        <div className="wrap">
          <div className="section-head">
            <h2>The part every other marketplace skips</h2>
            <p>
              Most projects fail because the buyer pictured one thing and
              received another. Forma turns the requirement into a locked,
              signed contract before bidding opens — and every change after
              that is priced in the open.
            </p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h4>Describe the outcome</h4>
              <p>
                Plain language. No technical brief, no stack decisions, no
                jargon.
              </p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h4>Review what it means</h4>
              <p>
                Forma turns your answers into a specific list of what is in and
                what is out.
              </p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h4>Lock the contract</h4>
              <p>
                Scope, build budget, and monthly running cost are frozen and
                signed.
              </p>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <h4>Developers bid</h4>
              <p>
                Verified engineers compete on the same locked truth. No moving
                targets.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap pov-grid">
          <div className="pov" id="buyers">
            <h3>For buyers</h3>
            <p>From a single-location shop to a global enterprise.</p>
            <ul>
              <li>
                <span className="dot" />
                Answer simple questions instead of writing a specification
              </li>
              <li>
                <span className="dot" />
                Set your build budget and what you can pay monthly to run it
              </li>
              <li>
                <span className="dot" />
                Compare bids that are all priced against identical scope
              </li>
              <li>
                <span className="dot" />
                Changes after the lock arrive as a quote, never a surprise
              </li>
            </ul>
            <Link className="btn" to="/signin">
              Post a requirement
            </Link>
          </div>

          <div className="pov" id="developers">
            <h3>For AI developers</h3>
            <p>
              Browsing is free. A one-time $10 membership unlocks bidding.
            </p>
            <ul>
              <li>
                <span className="dot" />
                Browse open projects with locked scope and stated budgets
              </li>
              <li>
                <span className="dot" />
                Verified with government ID and a recorded build interview
              </li>
              <li>
                <span className="dot" />
                Judged on security, efficiency and long-term maintainability
              </li>
              <li>
                <span className="dot" />
                Escrow-funded milestones, released on acceptance
              </li>
              <li>
                <span className="dot" />
                No scope creep — extra work is a paid change order
              </li>
            </ul>
            <Link className="btn btn-secondary" to="/signin">
              Apply as a developer
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div
          className="wrap"
          style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}
        >
          <span>Forma — requirement-locked software marketplace</span>
          <span>Buyers · Developers · Contracts</span>
        </div>
      </footer>
    </>
  );
}
