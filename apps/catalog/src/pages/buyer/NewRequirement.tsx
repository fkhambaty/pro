import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORY_OPTIONS, MUST_HAVES, SCALE_OPTIONS } from "../../data";
import { money } from "../../format";
import { useStore } from "../../store";
import type { BuyerScale, ScopeItem } from "../../types";

const STEP_COUNT = 5;

export default function NewRequirement() {
  const navigate = useNavigate();
  const { createProject } = useStore();
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState(1);
  const [scale, setScale] = useState<BuyerScale>("Local business");
  const [category, setCategory] = useState("store");
  const [outcome, setOutcome] = useState("");
  const [mustHaves, setMustHaves] = useState<string[]>(["Works on phones"]);
  const [budgetMin, setBudgetMin] = useState("3000");
  const [budgetMax, setBudgetMax] = useState("6000");
  const [monthly, setMonthly] = useState("120");
  const [weeks, setWeeks] = useState("6");
  const [excluded, setExcluded] = useState("Native mobile app");
  const [scopeDraft, setScopeDraft] = useState<ScopeItem[]>([]);

  const categoryLabel =
    CATEGORY_OPTIONS.find((c) => c.id === category)?.label ?? "Custom build";

  function toggleMustHave(item: string) {
    setMustHaves((prev) =>
      prev.includes(item) ? prev.filter((m) => m !== item) : [...prev, item]
    );
  }

  function generateScope() {
    const items: ScopeItem[] = mustHaves.map((item, index) => ({
      id: `sc${index}`,
      label: item,
      detail: "Captured from your answers.",
      included: true,
      acceptanceCriteria: `Accepted when ${item.toLowerCase()} works end to end.`,
    }));
    if (excluded.trim()) {
      items.push({
        id: "sc-out",
        label: excluded.trim(),
        detail: "Explicitly excluded from this contract.",
        included: false,
      });
    }
    setScopeDraft(items);
  }

  function toggleScopeItem(id: string) {
    setScopeDraft((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, included: !item.included } : item
      )
    );
  }

  function next() {
    if (step === 4) generateScope();
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }

  async function publish() {
    setSaving(true);
    const id = await createProject({
      title: outcome.slice(0, 60) || `${categoryLabel} project`,
      category: categoryLabel,
      outcome:
        outcome ||
        "Describe what should exist when this is finished, in your own words.",
      budgetMin: Number(budgetMin) || 0,
      budgetMax: Number(budgetMax) || 0,
      monthlyOps: Number(monthly) || 0,
      timelineWeeks: Number(weeks) || 6,
      scale,
      scope: scopeDraft,
    });
    setSaving(false);
    if (id) navigate(`/app/project/${id}`);
  }

  return (
    <>
      <header className="topbar">
        <h1>New requirement</h1>
        <div className="topbar-actions">
          <span className="badge">
            Step {step} of {STEP_COUNT}
          </span>
        </div>
      </header>

      <div className="content content-narrow">
        <div className="wizard-steps">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <i key={i} className={i < step ? "done" : ""} />
          ))}
        </div>

        <div className="card card-pad">
          {step === 1 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>Who is this for?</h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                This changes nothing about your price. It helps us ask the right
                questions.
              </p>
              <div className="option-grid">
                {SCALE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`option-card${scale === option.id ? " selected" : ""}`}
                    onClick={() => setScale(option.id as BuyerScale)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>
                What do you want it to do?
              </h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Pick the closest one, then say it in your own words. No technical
                terms needed.
              </p>
              <div className="option-grid" style={{ marginBottom: "1.5rem" }}>
                {CATEGORY_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`option-card${category === option.id ? " selected" : ""}`}
                    onClick={() => setCategory(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="outcome">
                  When this is finished, what should be true?
                </label>
                <textarea
                  id="outcome"
                  rows={4}
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  placeholder="Customers order cakes online, pick a pickup time, and pay. I see today's orders on one screen."
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>What must it include?</h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Tick everything that matters. Whatever you leave out stays out of
                the contract.
              </p>
              <div className="chips" style={{ gap: "0.5rem", marginBottom: "1.5rem" }}>
                {MUST_HAVES.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`toggle-chip${mustHaves.includes(item) ? " selected" : ""}`}
                    onClick={() => toggleMustHave(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="excluded">
                  Anything you want to rule out now?
                </label>
                <input
                  id="excluded"
                  value={excluded}
                  onChange={(event) => setExcluded(event.target.value)}
                  placeholder="Native mobile app"
                />
                <span className="hint">
                  Naming exclusions early prevents the most common argument later.
                </span>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>Budget and timeline</h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Two numbers matter: what you can pay to build it, and what you can
                pay every month to keep it running.
              </p>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="min">Build budget from (USD)</label>
                  <input
                    id="min"
                    value={budgetMin}
                    onChange={(event) => setBudgetMin(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="max">Build budget up to (USD)</label>
                  <input
                    id="max"
                    value={budgetMax}
                    onChange={(event) => setBudgetMax(event.target.value)}
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="monthly">Monthly running cost (USD)</label>
                  <input
                    id="monthly"
                    value={monthly}
                    onChange={(event) => setMonthly(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="weeks">Wanted within (weeks)</label>
                  <input
                    id="weeks"
                    value={weeks}
                    onChange={(event) => setWeeks(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>
                This is what we understood
              </h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Untick anything that should not be promised. You sign this on the
                next screen — after that, changes are priced.
              </p>

              <div style={{ marginBottom: "1.25rem" }}>
                {scopeDraft.map((item) => (
                  <label
                    className="scope-item"
                    key={item.id}
                    style={{ cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={() => toggleScopeItem(item.id)}
                      style={{ marginTop: "0.2rem", accentColor: "var(--accent)" }}
                    />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="card card-pad" style={{ background: "var(--bg)" }}>
                <div className="terms">
                  <div className="term">
                    <span>Build</span>
                    <strong>
                      {money(Number(budgetMin) || 0)} –{" "}
                      {money(Number(budgetMax) || 0)}
                    </strong>
                  </div>
                  <div className="term">
                    <span>Monthly</span>
                    <strong>{money(Number(monthly) || 0)}</strong>
                  </div>
                  <div className="term">
                    <span>Timeline</span>
                    <strong>{weeks} weeks</strong>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="wizard-foot">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </button>
            {step < STEP_COUNT ? (
              <button type="button" className="btn" onClick={next}>
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={publish}
                disabled={saving}
              >
                {saving ? "Saving…" : "Create draft contract"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
