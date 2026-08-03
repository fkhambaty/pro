import { useCallback, useEffect, useState } from "react";
import * as api from "../../lib/api";
import { errorMessage } from "../../lib/errors";

const RANGES = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

const BREAKDOWNS: {
  dimension: api.AnalyticsDimension;
  title: string;
  hint: string;
}[] = [
  { dimension: "channel", title: "Channels", hint: "How people arrived" },
  { dimension: "referrer_host", title: "Referring sites", hint: "The exact site they came from" },
  { dimension: "country", title: "Countries", hint: "Where visitors are" },
  { dimension: "city", title: "Cities", hint: "Down to the city" },
  { dimension: "path", title: "Pages", hint: "What they looked at" },
  { dimension: "device", title: "Devices", hint: "Phone, tablet or desktop" },
  { dimension: "browser", title: "Browsers", hint: "What they browse with" },
  { dimension: "os", title: "Operating systems", hint: "What they run" },
  { dimension: "utm_source", title: "Campaign sources", hint: "From your utm_source tags" },
  { dimension: "utm_campaign", title: "Campaigns", hint: "From your utm_campaign tags" },
  { dimension: "language", title: "Languages", hint: "Browser language" },
];

type Data = {
  overview: api.AnalyticsOverview;
  daily: { day: string; views: number; visitors: number }[];
  breakdowns: Record<string, api.BreakdownRow[]>;
};

function Bars({ rows }: { rows: api.BreakdownRow[] }) {
  const top = Math.max(1, ...rows.map((row) => row.views));
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${Math.max(3, (row.views / top) * 100)}%` }}
            />
            <span className="bar-label">{row.label}</span>
          </div>
          <span className="bar-value">
            {row.views.toLocaleString()}
            <em>{row.visitors.toLocaleString()}</em>
          </span>
        </div>
      ))}
    </div>
  );
}

function Trend({ rows }: { rows: { day: string; views: number; visitors: number }[] }) {
  if (rows.length === 0) return null;
  const top = Math.max(1, ...rows.map((row) => row.views));
  const day = (value: string) =>
    new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <>
      <div className="trend">
        {rows.map((row) => (
          <div
            className="trend-col"
            key={row.day}
            title={`${day(row.day)} · ${row.views} views · ${row.visitors} visitors`}
          >
            <div
              className="trend-bar"
              style={{ height: `${Math.max(2, (row.views / top) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="trend-axis">
        <span>{day(rows[0].day)}</span>
        <span>
          Peak {top.toLocaleString()} view{top === 1 ? "" : "s"}
        </span>
        <span>{day(rows[rows.length - 1].day)}</span>
      </div>
    </>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError(null);
    try {
      const [overview, daily, ...lists] = await Promise.all([
        api.fetchAnalyticsOverview(range),
        api.fetchAnalyticsDaily(range),
        ...BREAKDOWNS.map((item) =>
          api.fetchAnalyticsBreakdown(item.dimension, range)
        ),
      ]);

      const breakdowns: Record<string, api.BreakdownRow[]> = {};
      BREAKDOWNS.forEach((item, index) => {
        breakdowns[item.dimension] = lists[index] ?? [];
      });

      setData({ overview, daily, breakdowns });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const overview = data?.overview;
  const returning = overview
    ? Math.max(0, overview.uniqueVisitors - overview.newVisitors)
    : 0;

  return (
    <>
      <header className="topbar">
        <h1>Traffic</h1>
        <div className="topbar-actions">
          <label className="visually-hidden" htmlFor="range">
            Time range
          </label>
          <select
            id="range"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {RANGES.map((range) => (
              <option key={range.days} value={range.days}>
                Last {range.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="content">
        {error && (
          <div className="callout callout-warn" role="alert" style={{ marginBottom: "1rem" }}>
            <span>!</span>
            <span>{error}</span>
          </div>
        )}

        {loading && !data && <div className="card empty">Loading traffic…</div>}

        {overview && (
          <>
            <div className="stat-row">
              <div className="stat">
                <span>Unique visitors</span>
                <strong>{overview.uniqueVisitors.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Page views</span>
                <strong>{overview.pageViews.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Visits</span>
                <strong>{overview.sessions.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Countries</span>
                <strong>{overview.countries.toLocaleString()}</strong>
              </div>
            </div>

            <div className="stat-row">
              <div className="stat">
                <span>New visitors</span>
                <strong>{overview.newVisitors.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Returning</span>
                <strong>{returning.toLocaleString()}</strong>
              </div>
              <div className="stat">
                <span>Pages per visit</span>
                <strong>
                  {overview.sessions
                    ? (overview.pageViews / overview.sessions).toFixed(1)
                    : "—"}
                </strong>
              </div>
              <div className="stat">
                <span>Views while signed in</span>
                <strong>{overview.signedInViews.toLocaleString()}</strong>
              </div>
            </div>

            {overview.pageViews === 0 ? (
              <div className="card empty">
                <strong>No traffic recorded yet</strong>
                <p>
                  Visits are counted on the live site only — local development
                  is ignored on purpose. Open okavo.org in a browser and this
                  fills in within a few seconds.
                </p>
              </div>
            ) : (
              <>
                <div className="card card-pad" style={{ marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.85rem" }}>
                    Page views per day
                  </h3>
                  <Trend rows={data.daily} />
                </div>

                <div className="grid-2">
                  {BREAKDOWNS.map((item) => {
                    const rows = data.breakdowns[item.dimension] ?? [];
                    return (
                      <div className="card" key={item.dimension}>
                        <div className="card-head">
                          <div>
                            <h3 style={{ fontSize: "0.9375rem" }}>{item.title}</h3>
                            <span className="hint">{item.hint}</span>
                          </div>
                          <span className="bar-legend">
                            views <em>visitors</em>
                          </span>
                        </div>
                        <div style={{ padding: "1rem 1.25rem" }}>
                          {rows.length === 0 ? (
                            <p className="hint">Nothing recorded yet.</p>
                          ) : (
                            <Bars rows={rows} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
