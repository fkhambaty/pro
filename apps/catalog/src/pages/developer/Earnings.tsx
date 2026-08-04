import { useMemo } from "react";
import { Link } from "react-router-dom";
import AreaTrend from "../../components/charts/AreaTrend";
import ChartCard from "../../components/charts/ChartCard";
import Donut from "../../components/charts/Donut";
import HBar from "../../components/charts/HBar";
import Meter from "../../components/charts/Meter";
import { money } from "../../format";
import { MEMBERSHIP_FEE_LABEL } from "../../lib/pricing";
import {
  developerBidOutcomes,
  developerContractValues,
  developerMilestoneMoney,
  developerWinTrend,
} from "../../lib/roleAnalytics";
import { useStore } from "../../store";

export default function Earnings() {
  const { projects, developerAccount, userId, loading, hydrated } = useStore();

  const myBids = useMemo(
    () =>
      projects.flatMap((project) =>
        project.bids.filter(
          (bid) => bid.developerId === userId || bid.developerId === "me"
        )
      ),
    [projects, userId]
  );

  const myContracts = useMemo(
    () =>
      projects.filter((project) =>
        project.bids.some(
          (bid) =>
            bid.status === "awarded" &&
            (bid.developerId === userId || bid.developerId === "me")
        )
      ),
    [projects, userId]
  );

  const milestones = useMemo(
    () => myContracts.flatMap((project) => project.milestones),
    [myContracts]
  );

  const released = milestones
    .filter((milestone) => milestone.status === "released")
    .reduce((sum, milestone) => sum + milestone.amount, 0);

  const pending = milestones
    .filter((milestone) =>
      ["funded", "submitted"].includes(milestone.status)
    )
    .reduce((sum, milestone) => sum + milestone.amount, 0);

  const recurring = myContracts.reduce(
    (sum, project) => sum + project.monthlyOps,
    0
  );

  const payoutRows = myContracts.flatMap((project) =>
    project.milestones.map((milestone) => ({ project, milestone }))
  );

  const bidOutcomes = useMemo(() => developerBidOutcomes(myBids), [myBids]);
  const moneyMix = useMemo(
    () => developerMilestoneMoney(milestones),
    [milestones]
  );
  const contractValues = useMemo(
    () => developerContractValues(myContracts),
    [myContracts]
  );
  const winTrend = useMemo(() => developerWinTrend(myBids), [myBids]);

  const awarded = myBids.filter((bid) => bid.status === "awarded").length;
  const winRate =
    myBids.length === 0 ? 0 : Math.round((awarded / myBids.length) * 100);

  return (
    <>
      <header className="topbar">
        <h1>Earnings</h1>
      </header>
      <div className="content">
        <div className="stat-row">
          <div className="stat">
            <span>Accepted</span>
            <strong>{money(released)}</strong>
          </div>
          <div className="stat">
            <span>In progress</span>
            <strong>{money(pending)}</strong>
          </div>
          <div className="stat">
            <span>Monthly retainers</span>
            <strong>{money(recurring)}</strong>
          </div>
          <div className="stat">
            <span>Platform fees paid</span>
            <strong>
              {developerAccount.membershipPaid ? MEMBERSHIP_FEE_LABEL : "—"}
            </strong>
          </div>
        </div>

        <section className="analytics-banner" aria-label="Your performance">
          <div className="chart-grid-3">
            <ChartCard
              title="Win rate"
              hint="Awarded ÷ your bids only"
              empty={myBids.length === 0}
              emptyTitle="No bids yet"
              emptyBody="Place a bid on a locked requirement to start a track record."
            >
              <Meter
                value={winRate}
                label="won"
                tone="lock"
                caption={`${awarded} of ${myBids.length} bids awarded`}
              />
            </ChartCard>
            <ChartCard
              title="Bid outcomes"
              hint="Status of every bid you placed"
              empty={bidOutcomes.length === 0}
            >
              <Donut
                slices={bidOutcomes}
                centerLabel="bids"
                centerValue={String(myBids.length)}
              />
            </ChartCard>
            <ChartCard
              title="Milestone money"
              hint="Accepted vs in progress vs awaiting confirmation"
              empty={moneyMix.length === 0}
              emptyTitle="No contracts yet"
              emptyBody="Amounts appear after a buyer awards you and confirms payment."
            >
              <Donut
                slices={moneyMix}
                centerLabel="USD"
                centerValue={money(released + pending)}
              />
            </ChartCard>
          </div>

          <div className="chart-grid">
            <ChartCard
              title="Bidding activity"
              hint="Bids you placed by day · green marks awards"
              empty={winTrend.length === 0}
            >
              <AreaTrend
                points={winTrend}
                primaryLabel="bid"
                secondaryLabel="won"
              />
            </ChartCard>
            <ChartCard
              title="Contract values"
              hint="Agreed build price on contracts you won"
              empty={contractValues.length === 0}
            >
              <HBar
                rows={contractValues}
                formatValue={(value) => money(value)}
              />
            </ChartCard>
          </div>
        </section>

        <div className="card">
          <div className="card-head">
            <h2>Payout history</h2>
          </div>
          {!hydrated && loading ? (
            <div className="empty">
              <strong>Loading payouts…</strong>
            </div>
          ) : payoutRows.length === 0 ? (
            <div className="empty">
              <strong>No payouts yet</strong>
              <p>
                Milestones appear here once a buyer awards you a contract and
                settles the first milestone.
              </p>
              <Link to="/app">Find projects</Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Milestone</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payoutRows.map(({ project, milestone }) => (
                  <tr key={milestone.id}>
                    <td>{project.lockId ?? project.title}</td>
                    <td>{milestone.title}</td>
                    <td>{money(milestone.amount)}</td>
                    <td>
                      <span
                        className={
                          milestone.status === "released"
                            ? "badge badge-lock"
                            : "badge badge-accent"
                        }
                      >
                        {milestone.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card card-pad" style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
            How payouts work
          </h3>
          <p style={{ color: "var(--muted)" }}>
            You are paid milestone by milestone against the schedule in the
            signed contract, as the buyer accepts each one. Okavo-held escrow is
            being switched on next; until then payment is settled directly with
            the buyer against that same schedule, and the locked scope is what
            decides whether a milestone is complete.
          </p>
        </div>
      </div>
    </>
  );
}
