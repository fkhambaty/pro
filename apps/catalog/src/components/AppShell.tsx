import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { initials } from "../format";
import { useStore } from "../store";

const BUYER_NAV = [
  { to: "/app", label: "Overview", end: true },
  { to: "/app/new", label: "New requirement", end: false },
  { to: "/app/contracts", label: "Contracts", end: false },
  { to: "/app/payments", label: "Payments", end: false },
  { to: "/app/messages", label: "Messages", end: false },
  { to: "/app/notifications", label: "Notifications", end: false },
];

const DEV_NAV = [
  { to: "/app", label: "Find projects", end: true },
  { to: "/app/bids", label: "My bids", end: false },
  { to: "/app/contracts", label: "Contracts", end: false },
  { to: "/app/earnings", label: "Earnings", end: false },
  { to: "/app/messages", label: "Messages", end: false },
  { to: "/app/verification", label: "Verification", end: false },
  { to: "/app/notifications", label: "Notifications", end: false },
];

export default function AppShell() {
  const { role, name, signOut, projects, notifications, developerAccount } =
    useStore();
  const navigate = useNavigate();
  const isBuyer = role === "buyer";
  const nav = isBuyer ? BUYER_NAV : DEV_NAV;

  const openCount = projects.filter((p) => p.stage === "locked").length;
  const unread = notifications.filter((n) => !n.read).length;

  function handleSignOut() {
    signOut();
    navigate("/");
  }

  function badgeFor(label: string) {
    if (label === "Notifications" && unread > 0) return unread;
    if (label === "Find projects") return openCount;
    return null;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark">F</span> Forma
        </div>
        <div className="side-role">
          {isBuyer ? "Buyer workspace" : "Developer workspace"}
        </div>

        <nav className="side-nav">
          {nav.map((item) => {
            const count = badgeFor(item.label);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }: { isActive: boolean }) =>
                  isActive ? "side-link active" : "side-link"
                }
              >
                <span>{item.label}</span>
                {count !== null && <span className="side-count">{count}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="side-foot">
          {!isBuyer && !developerAccount.membershipPaid && (
            <div
              style={{
                background: "rgba(47, 84, 235, 0.22)",
                borderRadius: 8,
                padding: "0.7rem 0.75rem",
                marginBottom: "0.5rem",
              }}
            >
              <strong style={{ color: "#fff", fontSize: "0.8125rem", display: "block" }}>
                Bidding locked
              </strong>
              <span style={{ fontSize: "0.75rem", color: "#c3ccf5" }}>
                Pay $10 once to bid
              </span>
            </div>
          )}
          <div className="side-user">
            <span className="avatar">{initials(name || "Forma User")}</span>
            <span>
              <strong>{name}</strong>
              <span>
                {isBuyer
                  ? "Buyer"
                  : developerAccount.membershipPaid
                    ? `${developerAccount.tier} · bidding active`
                    : `${developerAccount.tier} · bidding locked`}
              </span>
            </span>
          </div>
          <button type="button" className="side-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
