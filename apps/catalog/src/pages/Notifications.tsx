import { Link } from "react-router-dom";
import { useStore } from "../store";

export default function Notifications() {
  const { notifications, markAllNotificationsRead } = useStore();
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <>
      <header className="topbar">
        <h1>Notifications</h1>
        <div className="topbar-actions">
          <span className="badge">{unread} unread</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={markAllNotificationsRead}
            disabled={unread === 0}
          >
            Mark all read
          </button>
        </div>
      </header>
      <div className="content content-narrow">
        <div className="card">
          {notifications.length === 0 ? (
            <div className="empty">
              <strong>Nothing yet</strong>
              Activity on your contracts will appear here.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                className={`notice${item.read ? "" : " unread"}`}
                key={item.id}
              >
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  {item.link && (
                    <Link
                      to={item.link}
                      style={{ color: "var(--accent)", fontSize: "0.8125rem" }}
                    >
                      Open
                    </Link>
                  )}
                </div>
                <time>{item.createdAt}</time>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
