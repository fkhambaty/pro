import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import MarketingLayout from "../components/MarketingLayout";
import {
  MEMBERSHIP_FEE_LABEL,
  POSTING_FEE_LABEL,
} from "../lib/pricing";

type TabId = "buyer" | "developer" | "pitch";
type ScreenId = "home" | "book" | "admin";

/**
 * Presentation-faithful walkthrough (mirrors Desktop Okavo-Presentation.html).
 * How it works = abstract map. This page = Tom & Arjun with sample output.
 */
export default function ExampleWalkthrough() {
  const [tab, setTab] = useState<TabId>("buyer");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const order: TabId[] = ["buyer", "developer", "pitch"];
      const index = order.indexOf(tab);
      if (index < 0) return;
      event.preventDefault();
      const next =
        event.key === "ArrowRight"
          ? order[(index + 1) % order.length]
          : order[(index - 1 + order.length) % order.length];
      setTab(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  return (
    <MarketingLayout>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Example walkthrough</span>
          <h1>Tom’s bakery. Arjun’s build. Same layout as the pitch deck.</h1>
          <p>
            The USP is the requirement: plain-language answers become a signed
            picture. Told here as Rose Street Bakery — not lifeless step
            numbers. Prefer the short map?{" "}
            <Link to="/how-it-works">See How it works</Link>.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap example-deck">
          <div className="ex-tabs" role="tablist" aria-label="Example walkthrough">
            <button
              type="button"
              className={`ex-tab${tab === "buyer" ? " on" : ""}`}
              role="tab"
              aria-selected={tab === "buyer"}
              onClick={() => setTab("buyer")}
            >
              1 · Tom’s story (buyer)
            </button>
            <button
              type="button"
              className={`ex-tab${tab === "developer" ? " on" : ""}`}
              role="tab"
              aria-selected={tab === "developer"}
              onClick={() => setTab("developer")}
            >
              2 · Arjun’s story (dev)
            </button>
            <button
              type="button"
              className={`ex-tab${tab === "pitch" ? " on" : ""}`}
              role="tab"
              aria-selected={tab === "pitch"}
              onClick={() => setTab("pitch")}
            >
              3 · Product pitch
            </button>
          </div>

          {tab === "buyer" && <BuyerPanel />}
          {tab === "developer" && <DeveloperPanel />}
          {tab === "pitch" && <PitchPanel />}

          <p className="ex-footer-note">
            Q&amp;A → freeze → hire fee → countersign · fees: {POSTING_FEE_LABEL}{" "}
            post, {MEMBERSHIP_FEE_LABEL} bid, flat 10% hire success fee · Use tabs
            or ← → while presenting.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}

function Scene({
  day,
  title,
  children,
}: {
  day: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="ex-scene">
      <div className="ex-day">{day}</div>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "fee" | "usp" | "ok";
}) {
  return <span className={`ex-chip ex-chip-${tone}`}>{children}</span>;
}

function BakeryPhone() {
  const [screen, setScreen] = useState<ScreenId>("home");

  return (
    <div className="ex-preview-stage">
      <div className="ex-preview-label">Sample output · what the client sees</div>
      <h3>Your answers → clickable preview</h3>
      <p className="ex-hint">
        Like a cardboard model of a house before the builders start. Flip
        screens. Point at what is wrong. Fix it in the answers — not after
        launch.
      </p>
      <div className="ex-phone">
        <div className="ex-phone-bar">
          <span>Okavo preview</span>
          <span>Draft</span>
        </div>
        <div className="ex-phone-body">
          <div className="ex-screen-tabs" role="tablist" aria-label="Sample screens">
            {(
              [
                ["home", "Storefront"],
                ["book", "Checkout"],
                ["admin", "Admin"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`ex-screen-tab${screen === id ? " on" : ""}`}
                aria-selected={screen === id}
                onClick={() => setScreen(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {screen === "home" && (
            <div className="ex-screen-pane">
              <p className="ex-screen-title">Rose Street · Today’s specials</p>
              <p className="ex-screen-sub">
                From Tom’s words: “Browse pastries, pick a shop, pay online.”
              </p>
              <div className="ex-fake-card">Almond croissant · Rose St</div>
              <div className="ex-fake-card">Sourdough loaf · Harbor St</div>
              <div className="ex-fake-cta">Order for pickup</div>
            </div>
          )}
          {screen === "book" && (
            <div className="ex-screen-pane">
              <p className="ex-screen-title">Pick shop &amp; window</p>
              <p className="ex-screen-sub">
                Accepted when a customer reserves morning or afternoon pickup
                without double-counting stock.
              </p>
              <div className="ex-fake-card">Rose St · Morning</div>
              <div className="ex-fake-card">Harbor St · Afternoon</div>
              <div className="ex-fake-card">Same-day delivery · Out of scope</div>
              <div className="ex-fake-cta">Confirm &amp; pay</div>
            </div>
          )}
          {screen === "admin" && (
            <div className="ex-screen-pane">
              <p className="ex-screen-title">Today’s orders</p>
              <p className="ex-screen-sub">
                Tom ticked Admin dashboard — one screen for both shops.
              </p>
              <div className="ex-fake-card">18 orders · 2 shops</div>
              <div className="ex-fake-card">Stock: separate per shop</div>
              <div className="ex-fake-cta">Open kitchen list</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BuyerPanel() {
  return (
    <div className="ex-panel">
      <div className="ex-hero">
        <div className="ex-eyebrow">Biggest USP · told as a story</div>
        <h2>Meet Tom. He runs Rose Street Bakery. He is not technical.</h2>
        <p className="ex-lede">
          Two shops. Phone orders colliding. He wants customers to order online
          for pickup — without calling the wrong location. Watch how Okavo turns
          that coffee-chat into screens, a freeze, and a hire.
        </p>
      </div>

      <div className="ex-usp">
        <div className="ex-usp-copy">
          <div className="ex-badge">Core product investment</div>
          <h3>Document the need. Preview the product. Then lock it.</h3>
          <p>
            This is where Okavo puts the most product energy: helping a
            non-technical client turn a fuzzy idea into a clear picture of what
            they will get — detailed enough that a developer (or AI builder) can
            execute without guessing.
          </p>
          <ul className="ex-usp-list">
            <li>
              <span className="ex-mark">1</span>
              <div>
                <strong>Talk like a human</strong>
                <span>
                  Outcome, who uses it, must-haves, exclusions — no tech stack,
                  no RFP theater.
                </span>
              </div>
            </li>
            <li>
              <span className="ex-mark">2</span>
              <div>
                <strong>See sample output live</strong>
                <span>
                  Screen sketches and flows generated from your answers so you
                  can say “yes, that screen” or “no, change this.”
                </span>
              </div>
            </li>
            <li>
              <span className="ex-mark">3</span>
              <div>
                <strong>Finalize until the picture is sharp</strong>
                <span>
                  Tighten acceptance criteria, confirm out-of-scope, walk the
                  preview again — then sign the freeze.
                </span>
              </div>
            </li>
            <li>
              <span className="ex-mark">4</span>
              <div>
                <strong>Hand builders a pre-cooked brief</strong>
                <span>
                  The lock is the build bible: checklist + screens + “accepted
                  when…” lines. Cake walk to estimate and implement.
                </span>
              </div>
            </li>
          </ul>
          <div className="ex-invest">
            <strong>Where the code goes</strong>
            <p>
              Maximum engineering focus: guided requirement capture, richer lock
              templates, interactive sample screens, and exportable build-ready
              detail — not another vague job board form.
            </p>
          </div>
        </div>

        <BakeryPhone />
      </div>

      <div className="ex-grid-2">
        <div className="ex-surface">
          <div className="ex-story-intro">
            <h3>Tom’s Monday → launch week</h3>
            <p>
              Same product as “How it works” — told with a bakery, not step
              numbers.
            </p>
          </div>

          <Scene day="Monday morning" title="He types what he can say out loud">
            <p>No specification. Coffee-chat answers:</p>
            <blockquote className="ex-quote">
              “Customers browse today’s pastries, pick a shop, pay online, and I
              see every order on one screen. No same-day delivery. Phones in the
              browser are enough.”
            </blockquote>
            <p>
              Must-haves: phones, payments, admin. Ruled out: marketplace for
              other sellers.
            </p>
          </Scene>

          <Scene
            day="Still Monday"
            title="Okavo shows him the product — as a picture"
          >
            <p>
              Sample screens appear before anyone codes: storefront, checkout,
              admin list. He spots “we need separate stock per shop,” edits the
              checklist, preview updates. Still free to fix.
            </p>
            <div className="ex-example">
              <strong>USP:</strong> a non-technical buyer sees screens +
              “accepted when…” lines before bids.
            </div>
          </Scene>

          <Scene
            day="Monday afternoon"
            title={`He pays ${POSTING_FEE_LABEL} and opens Q&A`}
          >
            <p>
              Brief goes live for clarifications (~48 hours). Bids stay closed.
              A developer asks about pickup time windows. Tom answers: morning /
              afternoon. Then he freezes the Requirement Lock — same picture for
              every bidder.
            </p>
            <div className="ex-meta">
              <Chip tone="fee">{POSTING_FEE_LABEL} posting</Chip>
              <Chip tone="usp">Pre-lock Q&amp;A</Chip>
              <Chip tone="ok">Then freeze</Chip>
            </div>
          </Scene>

          <Scene
            day="Later that week"
            title="Bids arrive on the same frozen pack"
          >
            <p>
              Three verified developers quote the identical lock. Tom compares
              price and weeks without wondering who imagined a different bakery.
              He hires Arjun.
            </p>
          </Scene>

          <Scene
            day="After hire"
            title="Funding gate, then countersign, then build"
          >
            <p>
              Tom pays Okavo’s 10% hire success fee, awards Arjun, then accepts
              work and pays Arjun milestone by milestone outside Okavo (confirming
              each payment here). Okavo does not hold build funds. Delivery is
              judged against the
              checklist Tom already approved in the preview.
            </p>
            <div className="ex-meta">
              <Chip tone="fee">Funding gate</Chip>
              <Chip>Escrow-ready</Chip>
            </div>
          </Scene>

          <Scene
            day="Launch week"
            title="Accept — or dispute a line, not a vibe"
          >
            <p>
              If stock counts are wrong, Tom disputes the locked line. New ideas
              (“loyalty stamps”) become a change order: propose → price → both
              sign to append the lock.
            </p>
          </Scene>
        </div>

        <div className="ex-aside">
          <div className="ex-callout">
            <strong>Why non-tech clients win</strong>
            <p>
              You never have to invent a “spec.” You react to pictures and plain
              checklist lines — the same way you approve a logo draft.
            </p>
          </div>
          <div className="ex-surface">
            <h3>What gets locked</h3>
            <p className="ex-sub">The builder’s cake-walk pack</p>
            <ul className="ex-checklist">
              <li>
                <i>✓</i>
                <span>Outcome statement in the client’s words</span>
              </li>
              <li>
                <i>✓</i>
                <span>Screen map / sample UI flows</span>
              </li>
              <li>
                <i>✓</i>
                <span>In-scope lines with acceptance criteria</span>
              </li>
              <li>
                <i>✓</i>
                <span>Explicit out-of-scope</span>
              </li>
              <li>
                <i>✓</i>
                <span>Budget, timeline, warranty rules</span>
              </li>
            </ul>
          </div>
          <div className="ex-callout ex-callout-dark">
            <strong>Fees (buyer)</strong>
            <p>
              {POSTING_FEE_LABEL} posting fee to publish. Build payments follow
              the milestone schedule. Okavo’s hire success fee is a flat{" "}
              <strong>10%</strong> on the awarded build — collected via Razorpay
              when the buyer awards a bid; posting is live today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeveloperPanel() {
  return (
    <div className="ex-panel">
      <div className="ex-hero">
        <div className="ex-eyebrow">For developers &amp; AI builders</div>
        <h2>
          Meet Arjun. He inherits Tom’s bakery picture — he does not invent it.
        </h2>
        <p className="ex-lede">
          No WhatsApp dump. Screens, checklist lines, and acceptance tests
          arrive pre-cooked. Estimating is a cake walk; shipping the locked
          picture is the job.
        </p>
      </div>

      <div className="ex-grid-2">
        <div className="ex-surface">
          <div className="ex-story-intro">
            <h3>Arjun’s path on Rose Street</h3>
            <p>
              Browse free → ask one sharp question → bid after freeze → fund
              gate → export → ship.
            </p>
          </div>

          <Scene day="Before bidding" title="Browse free — no fee to look">
            <p>
              Arjun opens the board, reads Rose Street’s clarifying pack, flips
              the sample screens, and checks every checklist line. Membership (
              {MEMBERSHIP_FEE_LABEL}) and identity only matter when he places a
              bid.
            </p>
            <div className="ex-meta">
              <Chip tone="ok">Browse free</Chip>
              <Chip tone="fee">{MEMBERSHIP_FEE_LABEL} at first bid</Chip>
            </div>
          </Scene>

          <Scene day="During Q&A" title="He asks one sharp question">
            <p>
              On “pickup,” he asks about time windows. Tom answers on the brief.
              Arjun marks the pack build-ready for himself, then waits for the
              freeze.
            </p>
            <div className="ex-example">
              <strong>Like a blueprint review:</strong> check dimensions before
              you order steel — here, screens and acceptance lines before you
              quote.
            </div>
          </Scene>

          <Scene day="After freeze" title="He bids on the signed picture">
            <p>
              Identity approved, membership paid once, he submits fixed price
              and weeks against the lock — not against a moving chat.
            </p>
          </Scene>

          <Scene
            day="After hire"
            title="Funding gate, countersign, export, ship"
          >
            <p>
              When Tom confirms the first milestone is funded, Arjun countersigns
              the same freeze. He exports the build bible as JSON for his tools,
              then delivers milestone by milestone against the checklist.
            </p>
            <p>
              Anything Tom dreamt up later (“loyalty stamps”) is a priced change
              order — not free scope creep.
            </p>
            <div className="ex-meta">
              <Chip tone="fee">Funding before countersign</Chip>
              <Chip tone="usp">JSON export</Chip>
            </div>
          </Scene>
        </div>

        <div className="ex-aside">
          <div className="ex-callout">
            <strong>Why AI / fast builders love this</strong>
            <p>
              The input is structured: screens, must-haves, acceptance tests.
              Less prompt archaeology. More shipping the picture the client
              already nodded at.
            </p>
          </div>
          <div className="ex-surface">
            <h3>Fee model</h3>
            <p className="ex-sub">Transparent for builders and buyers</p>
            <table className="ex-compare">
              <thead>
                <tr>
                  <th>Fee</th>
                  <th>What it is</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bidding membership</td>
                  <td>{MEMBERSHIP_FEE_LABEL} once to unlock bidding</td>
                </tr>
                <tr>
                  <td>Okavo commission</td>
                  <td>
                    Flat <strong>10%</strong> hire success fee at award
                    (Razorpay)
                  </td>
                </tr>
                <tr>
                  <td>Buyer posting</td>
                  <td>{POSTING_FEE_LABEL} per published requirement</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="ex-callout ex-callout-dark">
            <strong>Your advantage</strong>
            <p>
              You compete on delivery of a document — not on who guessed the
              buyer’s mind best in a DM thread.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PitchPanel() {
  return (
    <div className="ex-panel">
      <div className="ex-hero ex-hero-pitch">
        <div className="ex-eyebrow">For a room of 5,000 · the product story</div>
        <h2>
          Finally: a marketplace that starts with a picture of the product.
        </h2>
        <p className="ex-lede">
          Okavo’s wedge is not “another freelance board.” It is requirement
          finalization for non-technical clients — answers become screens and a
          checklist so sharp that builders (and AI) can execute without
          guessing.
        </p>
        <div className="ex-cta-row">
          <Link className="btn btn-accent" to="/signin">
            Create your free account
          </Link>
          <Link className="btn btn-secondary" to="/how-it-works">
            See how it works
          </Link>
        </div>
      </div>

      <h3 className="ex-section-title">Get excited about the right thing</h3>
      <div className="ex-pitch-points">
        <div className="ex-pitch-card">
          <div className="ex-n">01</div>
          <h4>Clients see what they get</h4>
          <p>
            Sample screens and plain checklists — approve the product shape
            before money and code. No need to be tech savvy.
          </p>
        </div>
        <div className="ex-pitch-card">
          <div className="ex-n">02</div>
          <h4>Builders get a cake-walk brief</h4>
          <p>
            Pre-cooked requirements: flows, acceptance lines, exclusions. Bid
            and build against a signed picture, not fog.
          </p>
        </div>
        <div className="ex-pitch-card">
          <div className="ex-n">03</div>
          <h4>Finalization is a first-class step</h4>
          <p>
            Both sides walk the requirement before lock and before countersign.
            Misunderstandings die while they are still free.
          </p>
        </div>
        <div className="ex-pitch-card">
          <div className="ex-n">04</div>
          <h4>Clear commercial model</h4>
          <p>
            {POSTING_FEE_LABEL} to post. {MEMBERSHIP_FEE_LABEL} once to bid.
            Flat <strong>10%</strong> hire success fee when a bid is awarded.
            Accept-then-pay milestones; Okavo does not hold build funds.
          </p>
        </div>
        <div className="ex-pitch-card">
          <div className="ex-n">05</div>
          <h4>Exportable build bible</h4>
          <p>
            Locked packs export as structured JSON for IDEs and AI coding tools
            — plus on-platform preview screens.
          </p>
        </div>
        <div className="ex-pitch-card">
          <div className="ex-n">06</div>
          <h4>Browse free, bid when ready</h4>
          <p>
            Developers review sample screens and the checklist with no fee.
            Membership + KYC only at the first bid.
          </p>
        </div>
      </div>

      <div className="ex-big-quote">
        <p>
          “If you can explain the software over coffee, Okavo can show you the
          screens — and freeze them before anyone builds.”
        </p>
        <cite>— The USP in one sentence</cite>
      </div>

      <div className="ex-grid-2" style={{ marginTop: "1.5rem" }}>
        <div className="ex-surface">
          <h3>The 20-second demo story</h3>
          <p className="ex-sub">Tell it on stage — Tom &amp; Arjun</p>
          <div className="ex-example" style={{ marginTop: 0 }}>
            <strong>1.</strong> Tom types: “Browse pastries, pick a shop, pay,
            one admin screen.”
            <br />
            <strong>2.</strong> Okavo shows Storefront · Checkout · Admin
            sketches.
            <br />
            <strong>3.</strong> Tom adds “separate stock per shop,” answers one
            Q&amp;A, freezes.
            <br />
            <strong>4.</strong> Arjun browses free, bids after KYC +{" "}
            {MEMBERSHIP_FEE_LABEL}, gets hired.
            <br />
            <strong>5.</strong> Tom funds first milestone → Arjun countersigns →
            ships the checklist.
          </div>
          <div className="ex-invest" style={{ marginTop: "1rem" }}>
            <strong>Product bet</strong>
            <p>
              We invest the most code in capture → preview → finalize → lock.
              Everything else on Okavo exists to protect that signed picture
              through hire and delivery.
            </p>
          </div>
        </div>
        <div className="ex-aside">
          <div className="ex-surface">
            <h3>Raise your hand if…</h3>
            <ul className="ex-hand-list">
              <li>You have paid for software that was “not what I meant”</li>
              <li>You buy tech but will never write a 40-page RFP</li>
              <li>You build (or use AI to build) and hate vague briefs</li>
              <li>You want quotes that mean the same thing</li>
            </ul>
          </div>
          <div className="ex-callout ex-callout-dark">
            <strong>The ask</strong>
            <p>
              Describe one real need. Watch the sample output. Finalize until it
              looks like your product — then lock it.
            </p>
          </div>
        </div>
      </div>

      <div className="ex-surface ex-closer-block">
        <div className="ex-eyebrow" style={{ color: "var(--accent-deep)" }}>
          Start now
        </div>
        <h3>Stop hiring hope. Hire a picture you already approved.</h3>
        <p>
          Buyers: see the product before the build. Developers: inherit a brief
          so detailed that shipping is the hard part — inventing the product is
          not.
        </p>
        <div className="ex-cta-row" style={{ justifyContent: "center" }}>
          <Link className="btn btn-accent btn-lg" to="/signin">
            Sign up free
          </Link>
          <Link className="btn btn-secondary btn-lg" to="/">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
