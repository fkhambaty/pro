import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Logo from "../components/Logo";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "../brand";
import { useAuth } from "../lib/auth";
import { MEMBERSHIP_FEE_LABEL } from "../lib/pricing";
import type { BuyerScale, Role } from "../types";

type Mode = "signin" | "signup";

export default function SignIn() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Exclude<Role, "guest">>("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [scale] = useState<BuyerScale>("Local business");
  const [busy, setBusy] = useState(false);
  const [idleNotice, setIdleNotice] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("okavo.auth.notice");
      if (stored) {
        sessionStorage.removeItem("okavo.auth.notice");
        setIdleNotice(stored);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  if (auth.role !== "guest" && !auth.passwordRecovery) {
    return <Navigate to="/app" replace />;
  }

  const notice = auth.notice ?? idleNotice;

  async function submit() {
    setBusy(true);
    if (!acceptedTerms) {
      setBusy(false);
      return;
    }
    if (!auth.connected) {
      auth.demoSignIn(
        role,
        (role === "buyer" ? organization : fullName).trim() ||
          (role === "buyer" ? "Rose Street Bakery" : "Arjun Mehta")
      );
      setBusy(false);
      return;
    }

    if (mode === "signin") {
      await auth.signIn(email.trim(), password);
      try {
        const { acceptPlatformTerms } = await import("../lib/api");
        const { TERMS_VERSION } = await import("../lib/terms");
        await acceptPlatformTerms(TERMS_VERSION);
      } catch {
        // Profile may not exist yet on first paint; TermsGate in /app retries.
      }
    } else {
      await auth.signUp({
        email: email.trim(),
        password,
        role,
        fullName: fullName.trim() || email.trim(),
        organizationName: organization.trim() || fullName.trim(),
        scale,
      });
      try {
        const { acceptPlatformTerms } = await import("../lib/api");
        const { TERMS_VERSION } = await import("../lib/terms");
        await acceptPlatformTerms(TERMS_VERSION);
      } catch {
        // Same as above.
      }
    }
    setBusy(false);
  }

  async function requestReset() {
    if (!email.trim()) return;
    setBusy(true);
    await auth.resetPassword(email.trim());
    setBusy(false);
  }

  async function saveNewPassword() {
    setBusy(true);
    await auth.updatePassword(newPassword);
    setBusy(false);
  }

  if (auth.passwordRecovery) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <Link to="/" style={{ display: "inline-block", marginBottom: "1.5rem" }}>
            <Logo />
          </Link>
          <h1>Choose a new password</h1>
          <p>Enter a new password for {auth.email ?? "your account"}.</p>

          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </div>

          {auth.error && (
            <div className="callout callout-warn" style={{ marginBottom: "1rem" }}>
              <span>!</span>
              <span>{auth.error}</span>
            </div>
          )}

          {notice && (
            <div className="callout callout-ok" style={{ marginBottom: "1rem" }}>
              <span>✓</span>
              <span>{notice}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-block btn-lg"
            onClick={saveNewPassword}
            disabled={busy || newPassword.length < 6}
          >
            {busy ? "Working…" : "Save password"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Link to="/" style={{ display: "inline-block", marginBottom: "1.5rem" }}>
          <Logo />
        </Link>

        <h1>{mode === "signin" ? "Sign in to Okavo" : "Create your account"}</h1>
        <p>
          {auth.connected
            ? "Connected to your Supabase project."
            : "Demo mode — add Supabase keys to enable real accounts."}
        </p>

        {auth.connected && (
          <div className="tabs">
            <button
              type="button"
              className={mode === "signin" ? "tab active" : "tab"}
              onClick={() => {
                setMode("signin");
                auth.clearMessages();
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "tab active" : "tab"}
              onClick={() => {
                setMode("signup");
                auth.clearMessages();
              }}
            >
              Create account
            </button>
          </div>
        )}

        {(mode === "signup" || !auth.connected) && (
          <div className="role-choice">
            <button
              type="button"
              className={`role-option${role === "buyer" ? " selected" : ""}`}
              onClick={() => setRole("buyer")}
            >
              <span className="radio" />
              <span>
                <strong>I need software built</strong>
                <span>
                  Post a requirement, lock the contract, review bids and hire.
                </span>
              </span>
            </button>

            <button
              type="button"
              className={`role-option${role === "developer" ? " selected" : ""}`}
              onClick={() => setRole("developer")}
            >
              <span className="radio" />
              <span>
                <strong>I build software</strong>
                <span>
                  Verify identity, pay the one-time {MEMBERSHIP_FEE_LABEL} membership, then bid.
                </span>
              </span>
            </button>
          </div>
        )}

        {auth.connected && (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </>
        )}

        {(mode === "signup" || !auth.connected) && (
          <>
            <div className="field">
              <label htmlFor="fullName">Your name</label>
              <input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Arjun Mehta"
              />
            </div>
            {role === "buyer" && (
              <div className="field">
                <label htmlFor="org">Business name</label>
                <input
                  id="org"
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Rose Street Bakery"
                />
              </div>
            )}
          </>
        )}

        {auth.error && (
          <div className="callout callout-warn" style={{ marginBottom: "1rem" }}>
            <span>!</span>
            <span>{auth.error}</span>
          </div>
        )}

        {notice && (
          <div className="callout callout-ok" style={{ marginBottom: "1rem" }}>
            <span>✓</span>
            <span>{notice}</span>
          </div>
        )}

        <label
          style={{
            display: "flex",
            gap: "0.65rem",
            alignItems: "flex-start",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            color: "var(--body)",
          }}
        >
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            style={{ marginTop: "0.2rem" }}
          />
          <span>
            I agree to the{" "}
            <Link to="/terms" target="_blank" rel="noreferrer">
              Okavo Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" target="_blank" rel="noreferrer">
              Privacy
            </Link>
            . Okavo is a marketplace intermediary and does not hold build money
            or guarantee the other party’s performance.
          </span>
        </label>

        <button
          type="button"
          className="btn btn-block btn-lg"
          onClick={submit}
          disabled={
            busy ||
            !acceptedTerms ||
            (auth.connected && (!email.trim() || !password))
          }
        >
          {busy
            ? "Working…"
            : mode === "signup" && auth.connected
              ? "Create account"
              : "Continue"}
        </button>

        {auth.connected && mode === "signin" && (
          <button
            type="button"
            className="link-button"
            disabled={!email.trim() || busy}
            onClick={requestReset}
          >
            Forgot password? Email me a reset link
          </button>
        )}

        {auth.connected && (
          <button
            type="button"
            className="link-button"
            disabled={!email.trim() || busy}
            onClick={() => auth.resendVerification(email.trim())}
          >
            Didn&apos;t get the verification email? Send it again
          </button>
        )}

        <p className="auth-support">
          Need help?{" "}
          <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
