import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import MarketingLayout from "../components/MarketingLayout";
import {
  MEMBERSHIP_FEE_LABEL,
  POSTING_FEE_LABEL,
} from "../lib/pricing";

type TabId = "buyer" | "developer" | "why";

/**
 * Concrete story page (Rose Street Bakery).
 * How it works = abstract map. This page = one real walkthrough you can retell.
 */
export default function ExampleWalkthrough() {
  const [tab, setTab] = useState<TabId>("buyer");

  return (
    <MarketingLayout>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Example walkthrough</span>
          <h1>Follow one bakery from “we need ordering” to “it works.”</h1>
          <p>
            How it works is the map. This page is a story you can tell out loud —
            Tom at Rose Street Bakery, and Arjun the developer who ships the
            locked picture. No tech degree required to understand any step.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            Prefer the short map?{" "}
            <Link to="/how-it-works">See How it works</Link>.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="wrap">
          <div className="tabs" role="tablist" aria-label="Example walkthrough">
            <button
              type="button"
              className={`tab${tab === "buyer" ? " active" : ""}`}
              role="tab"
              aria-selected={tab === "buyer"}
              onClick={() => setTab("buyer")}
            >
              Tom’s side (buyer)
            </button>
            <button
              type="button"
              className={`tab${tab === "developer" ? " active" : ""}`}
              role="tab"
              aria-selected={tab === "developer"}
              onClick={() => setTab("developer")}
            >
              Arjun’s side (developer)
            </button>
            <button
              type="button"
              className={`tab${tab === "why" ? " active" : ""}`}
              role="tab"
              aria-selected={tab === "why"}
              onClick={() => setTab("why")}
            >
              Why this matters
            </button>
          </div>
        </div>
      </section>

      {tab === "buyer" && <BuyerStory />}
      {tab === "developer" && <DeveloperStory />}
      {tab === "why" && <WhyStory />}

      <section className="section-tight">
        <div className="wrap">
          <div className="closer">
            <div>
              <h2>Ready to walk your own version?</h2>
              <p>
                Describe one real need the way Tom did — in plain language —
                and watch Okavo turn it into screens and a checklist before
                anyone builds.
              </p>
            </div>
            <Link className="btn btn-accent btn-lg" to="/signin">
              Start your requirement
            </Link>
          </div>
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
    <article className="story-scene">
      <div className="story-day">{day}</div>
      <h3>{title}</h3>
      <div className="story-body">{children}</div>
    </article>
  );
}

function BuyerStory() {
  return (
    <section className="section">
      <div className="wrap story-wrap">
        <div className="story-intro">
          <h2>Tom runs Rose Street Bakery</h2>
          <p>
            Two shops. Phone orders colliding. Staff writing names on paper bags.
            Tom is not technical — he just wants customers to order online for
            pickup without calling the wrong location.
          </p>
        </div>

        <Scene day="Monday morning" title="Tom types what he can say out loud">
          <p>
            On Okavo he does not write a specification. He answers coffee-chat
            questions:
          </p>
          <blockquote className="story-quote">
            “Customers browse today’s pastries, pick a shop, pay online, and I
            see every order on one screen. No same-day delivery. No app store
            app — phones in the browser are enough.”
          </blockquote>
          <p>
            He ticks must-haves: works on phones, take payments, admin
            dashboard. He rules out marketplace-for-other-sellers.
          </p>
        </Scene>

        <Scene
          day="Still Monday"
          title="Okavo shows him the product — as a picture"
        >
          <p>
            Before anyone codes, Tom sees sample screens generated from his
            words: a storefront with “Today’s specials,” a checkout, an admin
            list of orders. He taps through like a cardboard model of a house.
          </p>
          <p>
            He spots a mistake: “We need separate stock per shop.” He edits the
            checklist. The preview updates. Still free to fix.
          </p>
          <div className="callout callout-ok">
            <span>✓</span>
            <span>
              This is the USP: a non-technical buyer sees what he will get,
              documented as screens + “accepted when…” lines — before bids.
            </span>
          </div>
        </Scene>

        <Scene
          day="Monday afternoon"
          title={`He pays ${POSTING_FEE_LABEL} and opens Q&A`}
        >
          <p>
            Tom publishes. The brief is live for clarifications — about
            forty-eight hours of “what did you mean by X?” — but bidding is still
            closed. A developer asks: “Does pickup include scheduled time slots?”
            Tom answers: “Yes, morning / afternoon windows.”
          </p>
          <p>
            When the questions feel settled, Tom freezes the Requirement Lock.
            Same picture for every bidder. No quiet widening later.
          </p>
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
            Tom funds the first milestone (today: pays Arjun outside Okavo and
            confirms on the contract; when escrow is live, that deposit sits in
            Okavo escrow). Only then can Arjun countersign the lock.
          </p>
          <p>
            Each delivery is checked against the checklist Tom already approved
            in the preview — not against a vague memory of the call.
          </p>
        </Scene>

        <Scene
          day="Launch week"
          title="Accept, or dispute a line — not a vibe"
        >
          <p>
            If something is wrong, Tom opens a dispute pointing at a locked line
            (“separate stock counts”). That line is the mediation rubric. New
            ideas (loyalty stamps) become a change order: propose → price → both
            sign to append the lock.
          </p>
        </Scene>
      </div>
    </section>
  );
}

function DeveloperStory() {
  return (
    <section className="section">
      <div className="wrap story-wrap">
        <div className="story-intro">
          <h2>Arjun builds from a pre-cooked brief</h2>
          <p>
            He does not invent Tom’s bakery from a WhatsApp dump. He inherits
            screens, checklist lines, and acceptance tests — detailed enough that
            estimating is a cake walk.
          </p>
        </div>

        <Scene day="Before bidding" title="Browse free — no fee to look">
          <p>
            Arjun opens the board, reads Rose Street’s clarifying pack, flips
            the sample screens, and runs a buildability check line by line.
            Membership ({MEMBERSHIP_FEE_LABEL}) and identity only matter when he
            places a bid — not to review the picture.
          </p>
        </Scene>

        <Scene day="During Q&A" title="He asks one sharp question">
          <p>
            On the “pickup” line he asks about time windows. Tom answers on the
            brief. Arjun marks the pack build-ready for himself, then waits for
            the freeze.
          </p>
        </Scene>

        <Scene day="After freeze" title="He bids on the signed picture">
          <p>
            Identity approved, membership paid once, he submits a fixed price
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
        </Scene>
      </div>
    </section>
  );
}

function WhyStory() {
  return (
    <section className="section">
      <div className="wrap story-wrap">
        <div className="story-intro">
          <h2>Why tell it as a bakery story?</h2>
          <p>
            Because most software fights are not about code quality first —
            they are “I thought you meant X.” Okavo makes X a picture both sides
            can point at.
          </p>
        </div>

        <div className="split" style={{ gap: "1.25rem" }}>
          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>What How it works is for</h3>
            <p style={{ color: "var(--body)" }}>
              The short map: describe → preview → freeze → bid → fund → deliver.
              Use it when someone wants the skeleton.
            </p>
            <Link to="/how-it-works">Open How it works →</Link>
          </div>
          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>What this page is for</h3>
            <p style={{ color: "var(--body)" }}>
              Retell Tom and Arjun in a room of five thousand. Same product —
              with faces, a bakery, and moments instead of lifeless step
              numbers.
            </p>
          </div>
        </div>

        <div className="callout callout-info" style={{ marginTop: "1.25rem" }}>
          <span>i</span>
          <span>
            Fees in this story: {POSTING_FEE_LABEL} to publish Tom’s brief,{" "}
            {MEMBERSHIP_FEE_LABEL} once for Arjun to bid, flat 10% Okavo
            commission on the awarded build. Escrow that holds build money is
            next; the funding gate is already in the workflow.
          </span>
        </div>

        <div className="closer" style={{ marginTop: "2rem" }}>
          <div>
            <h2>Your turn to be Tom — or Arjun.</h2>
            <p>Lock one real need this week.</p>
          </div>
          <Link className="btn btn-accent btn-lg" to="/signin">
            Sign up free
          </Link>
        </div>
      </div>
    </section>
  );
}
