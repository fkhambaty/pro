import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequirementPreview from "../../components/RequirementPreview";
import { CATEGORY_OPTIONS, SCALE_OPTIONS } from "../../data";
import { money } from "../../format";
import {
  defaultActionFor,
  exclusionHintsFor,
  mustHavesForCategory,
  outcomePromptsFor,
  suggestedMustHaves,
  type Audience,
} from "../../lib/requirementBlueprint";
import { REQUIREMENT_POSTING_CENTS } from "../../lib/supabase";
import { useStore } from "../../store";
import type { BuyerScale, ScopeItem } from "../../types";

const STEP_COUNT = 5;
const POSTING_FEE = REQUIREMENT_POSTING_CENTS / 100;

const AUDIENCE_OPTIONS: { id: Audience; label: string; hint: string }[] = [
  {
    id: "customers",
    label: "Customers / public",
    hint: "People outside my organisation",
  },
  {
    id: "staff",
    label: "My team only",
    hint: "Internal tool, not a public site",
  },
  {
    id: "both",
    label: "Both",
    hint: "Customers and staff use different parts",
  },
];

export default function NewRequirement() {
  const navigate = useNavigate();
  const { createProject, payPostingFee } = useStore();
  const [saving, setSaving] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [card, setCard] = useState("");

  const [step, setStep] = useState(1);
  const [scale, setScale] = useState<BuyerScale>("Local business");
  const [category, setCategory] = useState("store");
  const [audience, setAudience] = useState<Audience>("customers");
  const [outcome, setOutcome] = useState("");
  const [primaryAction, setPrimaryAction] = useState(defaultActionFor("store"));
  const [mustHaves, setMustHaves] = useState<string[]>(suggestedMustHaves("store"));
  const [budgetMin, setBudgetMin] = useState("3000");
  const [budgetMax, setBudgetMax] = useState("6000");
  const [monthly, setMonthly] = useState("120");
  const [weeks, setWeeks] = useState("6");
  const [excluded, setExcluded] = useState("");
  const [scopeDraft, setScopeDraft] = useState<ScopeItem[]>([]);

  const categoryLabel =
    CATEGORY_OPTIONS.find((c) => c.id === category)?.label ?? "Custom build";
  const mustHaveOptions = useMemo(
    () => mustHavesForCategory(category),
    [category]
  );
  const prompts = useMemo(() => outcomePromptsFor(category), [category]);
  const exclusionHints = useMemo(() => exclusionHintsFor(category), [category]);

  const previewProps = {
    scale,
    categoryId: category,
    categoryLabel,
    outcome,
    audience,
    primaryAction,
    mustHaves,
    excluded,
  };

  function selectCategory(id: string) {
    setCategory(id);
    setMustHaves(suggestedMustHaves(id));
    setPrimaryAction(defaultActionFor(id));
    if (!outcome.trim()) setExcluded("");
  }

  function toggleMustHave(item: string) {
    setMustHaves((prev) =>
      prev.includes(item) ? prev.filter((m) => m !== item) : [...prev, item]
    );
  }

  function toggleExclusionHint(hint: string) {
    const parts = excluded
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.includes(hint)) {
      setExcluded(parts.filter((part) => part !== hint).join(", "));
      return;
    }
    setExcluded([...parts, hint].join(", "));
  }

  function generateScope() {
    const items: ScopeItem[] = mustHaves.map((item, index) => ({
      id: `sc${index}`,
      label: item,
      detail: "Captured from your answers — will be written into the lock.",
      included: true,
      acceptanceCriteria: `Accepted when ${item.toLowerCase()} works end to end as described.`,
    }));

    if (primaryAction.trim()) {
      items.unshift({
        id: "sc-action",
        label: `Primary action: ${primaryAction.trim()}`,
        detail: "The main button or step a user completes.",
        included: true,
        acceptanceCriteria: `A user can complete “${primaryAction.trim()}” without leaving the product.`,
      });
    }

    if (outcome.trim()) {
      items.unshift({
        id: "sc-outcome",
        label: "Outcome you described",
        detail: outcome.trim(),
        included: true,
        acceptanceCriteria:
          "A reviewer can walk through the product and confirm this outcome is true.",
      });
    }

    excluded
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((label, index) => {
        items.push({
          id: `sc-out-${index}`,
          label,
          detail: "Explicitly excluded from this contract.",
          included: false,
        });
      });

    setScopeDraft(items);
  }

  function toggleScopeItem(id: string) {
    setScopeDraft((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, included: !item.included } : item
      )
    );
  }

  function canContinue(): boolean {
    if (step === 2) return outcome.trim().length >= 20;
    if (step === 3) return mustHaves.length > 0;
    return true;
  }

  function next() {
    if (!canContinue()) return;
    if (step === 4) generateScope();
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }

  async function publish() {
    setSaving(true);
    try {
      await payPostingFee();
    } catch {
      setSaving(false);
      return;
    }
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

  const excludedSelected = new Set(
    excluded
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
  );

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
                Scale does not change your price. It steers the questions we ask
                next so the lock matches how you actually work.
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
                What should exist when this is finished?
              </h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Pick the closest shape, say who uses it, then write the outcome
                in plain language. That sentence becomes the heart of the
                contract.
              </p>

              <div className="option-grid" style={{ marginBottom: "1.25rem" }}>
                {CATEGORY_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`option-card${category === option.id ? " selected" : ""}`}
                    onClick={() => selectCategory(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>

              <h3 className="wizard-subhead">Who will use it day to day?</h3>
              <div className="option-grid" style={{ marginBottom: "1.25rem" }}>
                {AUDIENCE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`option-card${audience === option.id ? " selected" : ""}`}
                    onClick={() => setAudience(option.id)}
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
                  placeholder={prompts[0]}
                />
                <span className="hint">
                  Write at least a sentence. Tip: start with “Customers can…” or
                  “My team can…”
                </span>
              </div>

              <div className="prompt-rail">
                <span className="prompt-rail-label">Use a starting line</span>
                <div className="chips" style={{ gap: "0.5rem" }}>
                  {prompts.map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      className="toggle-chip"
                      onClick={() => setOutcome(prompt)}
                    >
                      {prompt.length > 72 ? `${prompt.slice(0, 69)}…` : prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field" style={{ marginTop: "1.25rem" }}>
                <label htmlFor="primary-action">
                  What is the main button or action people complete?
                </label>
                <input
                  id="primary-action"
                  value={primaryAction}
                  onChange={(event) => setPrimaryAction(event.target.value)}
                  placeholder={defaultActionFor(category)}
                />
                <span className="hint">
                  Examples: Place order, Book a slot, Sign in, Submit request,
                  Ask the assistant.
                </span>
              </div>

              {(outcome.trim() || mustHaves.length > 0) && (
                <RequirementPreview {...previewProps} compact />
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>What must it include?</h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Tick everything that must be true. Leave out what you do not
                want to pay for — excluded items stay out of the lock.
              </p>
              <div
                className="chips"
                style={{ gap: "0.5rem", marginBottom: "1.5rem" }}
              >
                {mustHaveOptions.map((item) => (
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

              <h3 className="wizard-subhead">Rule anything out now</h3>
              <div
                className="chips"
                style={{ gap: "0.5rem", marginBottom: "0.85rem" }}
              >
                {exclusionHints.map((hint) => (
                  <button
                    type="button"
                    key={hint}
                    className={`toggle-chip danger${excludedSelected.has(hint) ? " selected" : ""}`}
                    onClick={() => toggleExclusionHint(hint)}
                  >
                    {hint}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="excluded">Or type your own exclusions</label>
                <input
                  id="excluded"
                  value={excluded}
                  onChange={(event) => setExcluded(event.target.value)}
                  placeholder="Separate with commas — e.g. Native mobile app, live chat"
                />
                <span className="hint">
                  Naming exclusions early prevents the most common argument
                  later.
                </span>
              </div>

              <RequirementPreview {...previewProps} />
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>Budget and timeline</h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Two numbers matter: what you can pay to build it, and what you
                can pay every month to keep it running.
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

              <RequirementPreview {...previewProps} compact />
            </>
          )}

          {step === 5 && (
            <>
              <h2 style={{ marginBottom: "0.35rem" }}>
                This is what we understood
              </h2>
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Untick anything that should not be promised. You sign this on
                the next screen — after that, changes are priced.
              </p>

              <RequirementPreview {...previewProps} />

              <div style={{ margin: "1.25rem 0" }}>
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
                      style={{
                        marginTop: "0.2rem",
                        accentColor: item.included
                          ? "var(--accent)"
                          : "var(--danger)",
                      }}
                    />
                    <div>
                      <strong>
                        {item.included ? item.label : `Out · ${item.label}`}
                      </strong>
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

              <div className="fee-row">
                <div>
                  <strong>Posting fee</strong>
                  <p>
                    Charged once per requirement. It keeps the board free of
                    idle posts, so developers treat yours as real work.
                  </p>
                </div>
                <span className="fee-amount">{money(POSTING_FEE)}</span>
              </div>

              {payingFee && (
                <div className="submit-box" style={{ marginTop: "1rem" }}>
                  <div className="field" style={{ marginBottom: "0.85rem" }}>
                    <label htmlFor="card">Card number</label>
                    <input
                      id="card"
                      value={card}
                      onChange={(event) => setCard(event.target.value)}
                      placeholder="4242 4242 4242 4242"
                    />
                    <span className="hint">
                      Demo checkout. Wire this to Stripe before launch.
                    </span>
                  </div>
                </div>
              )}
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
              <button
                type="button"
                className="btn"
                onClick={next}
                disabled={!canContinue()}
              >
                Continue
              </button>
            ) : payingFee ? (
              <button
                type="button"
                className="btn btn-accent"
                onClick={publish}
                disabled={saving || card.trim().length < 4}
              >
                {saving ? "Creating…" : `Pay ${money(POSTING_FEE)} and create`}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => setPayingFee(true)}
              >
                Continue to payment
              </button>
            )}
          </div>
          {step === 2 && !canContinue() && (
            <p className="hint" style={{ marginTop: "0.75rem" }}>
              Add a clear outcome (about one sentence) before continuing.
            </p>
          )}
          {step === 3 && !canContinue() && (
            <p className="hint" style={{ marginTop: "0.75rem" }}>
              Tick at least one must-have so the sketch has something to show.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
