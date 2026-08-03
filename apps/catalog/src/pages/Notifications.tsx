import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, markAllNotificationsRead, markNotificationRead } =
    useStore();

  // Opening this page is reading it, so the badge clears on arrival. The ids
  // that were unread on arrival stay highlighted for this visit, otherwise
  // the page would look identical whether or not anything was new.
  const [wasUnread] = useState(
    () => new Set(notifications.filter((item) => !item.read).map((i) => i.id))
  );
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    if (notifications.some((item) => !item.read)) {
      cleared.current = true;
      markAllNotificationsRead();
    }
  }, [notifications, markAllNotificationsRead]);

  function open(item: (typeof notifications)[number]) {
    markNotificationRead(item.id);
    if (item.link) navigate(item.link);
  }

  return (
    <>
      <header className="topbar">
        <h1>Notifications</h1>
        <div className="topbar-actions">
          <span className="badge">
            {wasUnread.size > 0 ? `${wasUnread.size} new` : "All caught up"}
          </span>
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
              <button
                type="button"
                className={`notice${wasUnread.has(item.id) ? " unread" : ""}${
                  item.link ? " notice-link" : ""
                }`}
                key={item.id}
                onClick={() => open(item)}
                disabled={!item.link}
              >
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  {item.link && <span className="notice-open">Open</span>}
                </div>
                <time>{item.createdAt}</time>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
