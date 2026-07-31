import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../lib/auth";
import type { BuyerScale, Role } from "../types";

type Mode = "signin" | "signup";

export default function SignIn() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Exclude<Role, "guest">>("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [scale] = useState<BuyerScale>("Local business");
  const [busy, setBusy] = useState(false);

  if (auth.role !== "guest") return <Navigate to="/app" replace />;

  async function submit() {
    setBusy(true);
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
    } else {
      await auth.signUp({
        email: email.trim(),
        password,
        role,
        fullName: fullName.trim() || email.trim(),
        organizationName: organization.trim() || fullName.trim(),
        scale,
      });
    }
    setBusy(false);
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
                  Verify identity, pay the one-time $10 membership, then bid.
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

        {auth.notice && (
          <div className="callout callout-ok" style={{ marginBottom: "1rem" }}>
            <span>✓</span>
            <span>{auth.notice}</span>
          </div>
        )}

        <button
          type="button"
          className="btn btn-block btn-lg"
          onClick={submit}
          disabled={busy || (auth.connected && (!email.trim() || !password))}
        >
          {busy
            ? "Working…"
            : mode === "signup" && auth.connected
              ? "Create account"
              : "Continue"}
        </button>
      </div>
    </div>
  );
}
