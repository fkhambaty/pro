import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { money } from "../../format";
import * as api from "../../lib/api";
import { isSupabaseConfigured } from "../../lib/supabase";
import { errorMessage } from "../../lib/errors";

const DEMO: api.PlatformInsights = {
  buyers: 3,
  developers: 5,
  verifiedDevelopers: 4,
  projects: 4,
  lockedProjects: 3,
  bids: 7,
  feesCollectedCents: 4300,
  escrowCents: 500000,
  pendingReviews: 1,
};

export default function AdminHome() {
  const [insights, setInsights] = useState<api.PlatformInsights | null>(
    isSupabaseConfigured ? null : DEMO
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    api
      .fetchInsights()
      .then(setInsights)
      .catch((cause) =>
        setError(errorMessage(cause))
      );
  }, []);

  return (
    <>
      <header className="topbar">
        <h1>Platform insights</h1>
        <div className="topbar-actions">
          <Link className="btn btn-secondary btn-sm" to="/app/verifications">
            Review queue
          </Link>
        </div>
      </header>

      <div className="content">
        {error && (
          <div className="callout callout-warn" style={{ marginBottom: "1rem" }}>
            <span>!</span>
            <span>{error}</span>
          </div>
        )}

        {!insights ? (
          <div className="card empty">Loading platform data…</div>
        ) : (
          <>
            <div className="stat-row">
              <div className="stat">
                <span>Buyers</span>
                <strong>{insights.buyers}</strong>
              </div>
              <div className="stat">
                <span>Developers</span>
                <strong>{insights.developers}</strong>
              </div>
              <div className="stat">
                <span>Verified developers</span>
                <strong>{insights.verifiedDevelopers}</strong>
              </div>
              <div className="stat">
                <span>Awaiting ID review</span>
                <strong>{insights.pendingReviews}</strong>
              </div>
            </div>

            <div className="stat-row">
              <div className="stat">
                <span>Requirements posted</span>
                <strong>{insights.projects}</strong>
              </div>
              <div className="stat">
                <span>Contracts locked</span>
                <strong>{insights.lockedProjects}</strong>
              </div>
              <div className="stat">
                <span>Bids placed</span>
                <strong>{insights.bids}</strong>
              </div>
              <div className="stat">
                <span>Held in escrow</span>
                <strong>{money(insights.escrowCents / 100)}</strong>
              </div>
            </div>

            <div className="grid-2">
              <div className="card card-pad">
                <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
                  Platform revenue
                </h3>
                <div className="money" style={{ textAlign: "left" }}>
                  <strong style={{ fontSize: "2rem" }}>
                    {money(insights.feesCollectedCents / 100)}
                  </strong>
                  <span>
                    Posting fees and bidding memberships collected to date
                  </span>
                </div>
              </div>

              <div className="card card-pad">
                <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
                  Marketplace health
                </h3>
                <div className="stack-sm">
                  <div className="stat-line">
                    <span>Bids per locked contract</span>
                    <strong>
                      {insights.lockedProjects
                        ? (insights.bids / insights.lockedProjects).toFixed(1)
                        : "—"}
                    </strong>
                  </div>
                  <div className="stat-line">
                    <span>Lock rate</span>
                    <strong>
                      {insights.projects
                        ? `${Math.round((insights.lockedProjects / insights.projects) * 100)}%`
                        : "—"}
                    </strong>
                  </div>
                  <div className="stat-line">
                    <span>Verified share of developers</span>
                    <strong>
                      {insights.developers
                        ? `${Math.round((insights.verifiedDevelopers / insights.developers) * 100)}%`
                        : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
