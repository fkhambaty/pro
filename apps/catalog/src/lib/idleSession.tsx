import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";

/** Signed-in users are logged out after this much continuous inactivity. */
export const IDLE_LOGOUT_MS = 5 * 60 * 1000;

const WINDOW_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

/**
 * Watches for user activity while a Supabase session is live. If nothing
 * happens for IDLE_LOGOUT_MS, signs out and sends them to /signin with a notice.
 */
export function IdleSessionGuard() {
  const { userId, signOut } = useAuth();
  const navigate = useNavigate();
  const lastActivity = useRef(Date.now());
  const signingOut = useRef(false);

  useEffect(() => {
    if (!userId) {
      signingOut.current = false;
      return;
    }

    lastActivity.current = Date.now();

    const markActive = () => {
      if (document.visibilityState === "hidden") return;
      lastActivity.current = Date.now();
    };

    for (const event of WINDOW_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", markActive);

    const tick = window.setInterval(() => {
      if (signingOut.current) return;
      if (Date.now() - lastActivity.current < IDLE_LOGOUT_MS) return;
      signingOut.current = true;
      void (async () => {
        try {
          sessionStorage.setItem(
            "okavo.auth.notice",
            "Signed out after 5 minutes of inactivity."
          );
        } catch {
          // Private mode — still sign out.
        }
        await signOut("idle");
        navigate("/signin", { replace: true });
      })();
    }, 15_000);

    return () => {
      window.clearInterval(tick);
      for (const event of WINDOW_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener("visibilitychange", markActive);
    };
  }, [userId, signOut, navigate]);

  return null;
}
