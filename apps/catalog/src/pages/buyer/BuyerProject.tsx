import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ContractPanel from "../../components/ContractPanel";
import { initials, money } from "../../format";
import * as api from "../../lib/api";
import { formatRating } from "../../lib/reviewCriteria";
import { useStore } from "../../store";
import type { DeveloperListing } from "../../types";

export default function BuyerProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, lockProject, setBidStatus, awardBid, connected } = useStore();
  const project = projects.find((p) => p.id === id);

  // A price means nothing without a track record next to it.
  const [ratings, setRatings] = useState<Record<string, DeveloperListing>>({});

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.fetchDeveloperDirectory();
        if (cancelled) return;
        setRatings(Object.fromEntries(list.map((dev) => [dev.id, dev])));
      } catch {
        // The bids are still usable without the ratings overlay.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected]);

  if (!project) {
    return (
      <>
        <header className="topbar">
          <h1>Requirement</h1>
        </header>
        <div className="content">
          <div className="card empty">
            <strong>This requirement no longer exists</strong>
            <Link to="/app">Back to overview</Link>
          </div>
        </div>
      </>
    );
  }

  const locked = project.stage !== "drafting";
  const awarded = project.bids.find((bid) => bid.status === "awarded");

  return (
    <>
      <header className="topbar">
        <h1>{project.title}</h1>
        <div className="topbar-actions">
          {locked ? (
            <>
              <span className="badge badge-lock">{project.lockId}</span>
              <Link
                className="btn btn-secondary btn-sm"
                to={`/app/contract/${project.id}`}
              >
                Open contract
              </Link>
            </>
          ) : (
            <span className="badge badge-draft">Draft contract</span>
          )}
        </div>
      </header>

      <div className="content">
        <div className="split">
          <div className="stack">
            <ContractPanel
              project={project}
              viewer="buyer"
              onLock={() => lockProject(project.id)}
            />

            <div className="card">
              <div className="card-head">
                <h2>Bids on this locked contract</h2>
                <span className="badge">{project.bids.length} received</span>
              </div>
              <div style={{ padding: "1.25rem" }} className="stack-sm">
                {!locked && (
                  <div className="callout callout-warn">
                    <span>!</span>
                    <span>
                      Bidding opens the moment you sign. Developers never see an
                      unlocked requirement.
                    </span>
                  </div>
                )}

                {locked && project.bids.length === 0 && (
                  <div className="empty">
                    <strong>No bids yet</strong>
                    Verified developers are being notified.
                  </div>
                )}

                {locked &&
                  project.bids.map((bid) => {
                    const record = ratings[bid.developerId];
                    return (
                    <div className="bid" key={bid.id}>
                      <div className="bid-top">
                        <div className="bid-who">
                          <span className="avatar">
                            {initials(bid.developerName)}
                          </span>
                          <span>
                            <strong>{bid.developerName}</strong>
                            <span>
                              {bid.country} · {bid.tier} · bid {bid.submittedAt}
                            </span>
                          </span>
                        </div>
                        <div className="money">
                          <strong>{money(bid.amount)}</strong>
                          <span>
                            {money(bid.monthlyOps)} / month · {bid.weeks} weeks
                          </span>
                        </div>
                      </div>

                      {record && (
                        <div className="bid-record">
                          <span>
                            <strong>{formatRating(record.rating)}</strong>
                            {record.reviewCount === 0
                              ? " no reviews yet"
                              : ` from ${record.reviewCount} review${record.reviewCount === 1 ? "" : "s"}`}
                          </span>
                          {record.lockedScopeRate !== null && (
                            <span>
                              Delivered the locked scope{" "}
                              <strong>{record.lockedScopeRate}%</strong> of the time
                            </span>
                          )}
                          <span>{record.contractsDelivered} contracts delivered</span>
                          <Link to={`/app/developers/${bid.developerId}`}>
                            See reviews
                          </Link>
                        </div>
                      )}

                      <p className="bid-note">{bid.note}</p>
                      <div className="bid-actions">
                        {bid.status === "awarded" ? (
                          <>
                            <span className="badge badge-lock">
                              Hired — contract countersigned
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => navigate(`/app/contract/${project.id}`)}
                            >
                              Manage delivery
                            </button>
                          </>
                        ) : bid.status === "declined" ? (
                          <span className="badge badge-danger">Declined</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={Boolean(awarded)}
                              onClick={() => awardBid(project.id, bid.id)}
                            >
                              Hire at {money(bid.amount)}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                setBidStatus(project.id, bid.id, "shortlisted")
                              }
                            >
                              Shortlist
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                setBidStatus(project.id, bid.id, "declined")
                              }
                            >
                              Decline
                            </button>
                            {bid.status === "shortlisted" && (
                              <span className="badge badge-accent">
                                Shortlisted
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <aside className="sticky-side">
            <div className="card card-pad">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
                Requirement
              </h3>
              <p style={{ color: "var(--body)", marginBottom: "1rem" }}>
                {project.outcome}
              </p>
              <div className="chips">
                {project.skills.map((skill) => (
                  <span className="chip" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.6rem" }}>
                What happens next
              </h3>
              <div className="timeline">
                <div className="timeline-item">
                  <strong>1</strong>
                  <p>Sign the requirement lock</p>
                </div>
                <div className="timeline-item">
                  <strong>2</strong>
                  <p>Verified developers bid on identical scope</p>
                </div>
                <div className="timeline-item">
                  <strong>3</strong>
                  <p>Hire, then pay milestone by milestone</p>
                </div>
                <div className="timeline-item">
                  <strong>4</strong>
                  <p>Accept against scope, release payment</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
