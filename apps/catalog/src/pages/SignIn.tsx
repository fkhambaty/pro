import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import type { Role } from "../types";

export default function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useStore();
  const [role, setRole] = useState<Exclude<Role, "guest">>("buyer");
  const [name, setName] = useState("");

  function submit() {
    const fallback = role === "buyer" ? "Rose Street Bakery" : "Arjun Mehta";
    signIn(role, name.trim() || fallback);
    navigate("/app");
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Link to="/" className="logo" style={{ marginBottom: "1.5rem" }}>
          <span className="logo-mark">F</span> Forma
        </Link>
        <h1>Continue to Forma</h1>
        <p>Choose how you want to use the marketplace.</p>

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
                Verify identity, pay the one-time $10 membership, then bid on
                locked projects.
              </span>
            </span>
          </button>
        </div>

        <div className="field">
          <label htmlFor="name">
            {role === "buyer" ? "Business name" : "Your name"}
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={role === "buyer" ? "Rose Street Bakery" : "Arjun Mehta"}
          />
        </div>

        <button type="button" className="btn btn-block btn-lg" onClick={submit}>
          Continue
        </button>
      </div>
    </div>
  );
}
