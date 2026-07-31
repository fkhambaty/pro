import { useEffect, useMemo, useState } from "react";
import {
  buildRequirementBlueprint,
  type PreviewInput,
  type PreviewScreen,
} from "../lib/requirementBlueprint";

type Props = PreviewInput & {
  /** Compact mode for earlier wizard steps. */
  compact?: boolean;
};

function ScreenBody({ screen }: { screen: PreviewScreen }) {
  switch (screen.kind) {
    case "auth":
      return (
        <div className="wf-body wf-center">
          <div className="wf-card-sm wf-card-labeled">
            <strong className="wf-label">{screen.title}</strong>
            {screen.fields.map((field) => (
              <span key={field} className="wf-field">
                {field}
              </span>
            ))}
            <span className="wf-btn wf-btn-full">{screen.cta}</span>
          </div>
        </div>
      );
    case "checkout":
      return (
        <div className="wf-body">
          <strong className="wf-label">{screen.title}</strong>
          <div className="wf-row-split">
            <div className="wf-col">
              {screen.items.map((item) => (
                <span key={item} className="wf-line-item wf-line-labeled">
                  {item}
                </span>
              ))}
            </div>
            <div className="wf-card-sm wf-card-labeled">
              {screen.fields.map((field) => (
                <span key={field} className="wf-field">
                  {field}
                </span>
              ))}
              <span className="wf-btn wf-btn-full wf-btn-accent">{screen.cta}</span>
            </div>
          </div>
        </div>
      );
    case "dashboard":
      return (
        <div className="wf-body">
          <strong className="wf-label">{screen.title}</strong>
          <div className="wf-grid3">
            {screen.items.slice(0, 3).map((item) => (
              <span key={item} className="wf-stat wf-stat-labeled">
                {item}
              </span>
            ))}
          </div>
          <div className="wf-table">
            <span className="wf-tr wf-th wf-tr-labeled">Queue</span>
            {screen.items.map((item) => (
              <span key={`row-${item}`} className="wf-tr wf-tr-labeled">
                {item}
              </span>
            ))}
          </div>
        </div>
      );
    case "reports":
      return (
        <div className="wf-body">
          <div className="wf-row-between">
            <strong className="wf-label">{screen.title}</strong>
            {screen.cta && <span className="wf-btn wf-btn-accent">{screen.cta}</span>}
          </div>
          <div className="wf-chip-row">
            {screen.items.map((item) => (
              <span key={item} className="wf-mini-chip">
                {item}
              </span>
            ))}
          </div>
          <div className="wf-chart" aria-hidden="true">
            {[40, 62, 34, 78, 55, 90, 48].map((h, i) => (
              <span key={i} className="wf-col-bar" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      );
    case "alerts":
      return (
        <div className="wf-body wf-center">
          <div className="wf-phone wf-phone-labeled">
            <span className="wf-notch" />
            {screen.items.map((item, index) => (
              <div
                key={item}
                className={index === 1 ? "wf-msg wf-msg-accent" : "wf-msg"}
              >
                <strong>{item}</strong>
                <span>Matches your alert preference</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "locations":
      return (
        <div className="wf-body">
          <strong className="wf-label">{screen.title}</strong>
          <div className="wf-list">
            {screen.items.map((item) => (
              <span key={item} className="wf-list-row">
                {item}
              </span>
            ))}
          </div>
          {screen.cta && <span className="wf-btn">{screen.cta}</span>}
        </div>
      );
    case "home":
    case "catalog":
    case "booking":
    case "assistant":
      return (
        <div className="wf-body">
          <div className="wf-hero wf-hero-labeled">
            {screen.badges.length > 0 && (
              <div className="wf-chip-row">
                {screen.badges.map((badge) => (
                  <span key={badge} className="wf-mini-chip">
                    {badge}
                  </span>
                ))}
              </div>
            )}
            <strong className="wf-hero-title">{screen.title}</strong>
            {screen.subtitle && (
              <p className="wf-hero-sub">{screen.subtitle}</p>
            )}
            {screen.cta && <span className="wf-btn">{screen.cta}</span>}
          </div>
          {(screen.items.length > 0 || screen.fields.length > 0) && (
            <div className="wf-grid3">
              {screen.items.slice(0, 3).map((item) => (
                <span key={item} className="wf-tile wf-tile-labeled">
                  {item}
                </span>
              ))}
              {screen.fields.slice(0, 3 - Math.min(3, screen.items.length)).map((field) => (
                <span key={field} className="wf-tile wf-tile-labeled">
                  {field}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    default: {
      const _exhaustive: never = screen.kind;
      return _exhaustive;
    }
  }
}

export default function RequirementPreview(props: Props) {
  const blueprint = useMemo(
    () =>
      buildRequirementBlueprint({
        scale: props.scale,
        categoryId: props.categoryId,
        categoryLabel: props.categoryLabel,
        outcome: props.outcome,
        audience: props.audience,
        primaryAction: props.primaryAction,
        mustHaves: props.mustHaves,
        excluded: props.excluded,
      }),
    [
      props.scale,
      props.categoryId,
      props.categoryLabel,
      props.outcome,
      props.audience,
      props.primaryAction,
      props.mustHaves,
      props.excluded,
    ]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [blueprint.screens.map((s) => s.id).join("|")]);

  useEffect(() => {
    if (blueprint.screens.length < 2 || !blueprint.ready) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % blueprint.screens.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [blueprint.screens.length, blueprint.ready]);

  const active =
    blueprint.screens[Math.min(index, Math.max(0, blueprint.screens.length - 1))];

  if (!props.outcome.trim() && props.mustHaves.length === 0) {
    return (
      <div className="preview preview-empty">
        <strong>Your sketch appears here</strong>
        <p>
          Answer the prompts above. We turn them into screens you can check —
          no AI guessing, only what you said.
        </p>
      </div>
    );
  }

  return (
    <div className="preview">
      <div className="preview-head">
        <div>
          <strong className="preview-kicker">What we will lock from your answers</strong>
          <span className="preview-headline">{blueprint.headline}</span>
        </div>
        {blueprint.screens.length > 1 && (
          <div className="preview-tabs" role="tablist" aria-label="Preview screens">
            {blueprint.screens.map((screen, i) => (
              <button
                type="button"
                role="tab"
                aria-selected={i === index}
                key={screen.id}
                className={i === index ? "preview-tab active" : "preview-tab"}
                onClick={() => setIndex(i)}
              >
                {screen.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="preview-heard">
        <span className="preview-heard-label">In your words</span>
        <p>“{blueprint.heardAs}”</p>
        <span className="preview-heard-meta">
          For {blueprint.audienceLabel.toLowerCase()}
          {props.primaryAction.trim()
            ? ` · Main button: “${props.primaryAction.trim()}”`
            : ""}
        </span>
      </div>

      {!blueprint.ready && (
        <div className="preview-missing">
          <strong>Still needed</strong>
          <ul>
            {blueprint.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {active && (
        <>
          <div className="preview-why">
            <strong>{active.label}</strong>
            <span>{active.why}</span>
          </div>

          <div
            className={
              blueprint.showPhone ? "preview-stage with-phone" : "preview-stage"
            }
          >
            {blueprint.showDesktop && (
              <div className="wf-window">
                <div className="wf-chrome">
                  <span className="wf-dot" />
                  <span className="wf-dot" />
                  <span className="wf-dot" />
                  <span className="wf-url wf-url-text">okavo.app/{active.id}</span>
                </div>
                <div key={active.id} className="wf-screen">
                  <ScreenBody screen={active} />
                </div>
              </div>
            )}

            {blueprint.showPhone && (
              <div className="wf-window wf-window-phone">
                <div className="wf-chrome wf-chrome-phone">
                  <span className="wf-url wf-url-text">Phone</span>
                </div>
                <div key={`m-${active.id}`} className="wf-screen wf-screen-phone">
                  <ScreenBody screen={active} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!props.compact && (
        <div className="preview-scope">
          <div className="preview-scope-col in">
            <strong>In scope</strong>
            {blueprint.included.length === 0 ? (
              <span className="preview-scope-empty">Nothing ticked yet</span>
            ) : (
              <ul>
                {blueprint.included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="preview-scope-col out">
            <strong>Ruled out</strong>
            {blueprint.excluded.length === 0 ? (
              <span className="preview-scope-empty">Nothing excluded yet</span>
            ) : (
              <ul>
                {blueprint.excluded.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <p className="preview-note">
        This is a reading of your answers, not a finished design. Developers bid
        and build against what you lock — not against a guess.
      </p>
    </div>
  );
}
