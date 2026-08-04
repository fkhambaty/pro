/**
 * Grounded assist — suggestions only from the buyer’s own draft.
 * Never invents fees, escrow claims, or features outside must-haves.
 */

export type AssistInput = {
  outcome: string;
  categoryLabel: string;
  mustHaves: string[];
  excluded: string;
  primaryAction?: string;
};

export type AssistSuggestion = {
  id: string;
  kind: "acceptance" | "exclusion" | "screen";
  title: string;
  detail: string;
};

export type AssistResult = {
  available: boolean;
  mode: "heuristic" | "llm" | "unavailable";
  summary: string;
  suggestions: AssistSuggestion[];
};

/** Deterministic grounded suggestions (always available, no API key). */
export function heuristicAssist(input: AssistInput): AssistResult {
  const suggestions: AssistSuggestion[] = [];
  const outcome = input.outcome.trim();
  const excluded = input.excluded
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (outcome) {
    suggestions.push({
      id: "acc-outcome",
      kind: "acceptance",
      title: "Primary outcome check",
      detail: `Accepted when a reviewer can walk the product and confirm: “${outcome.slice(0, 180)}${outcome.length > 180 ? "…" : ""}”.`,
    });
  }

  input.mustHaves.slice(0, 5).forEach((item, index) => {
    suggestions.push({
      id: `acc-must-${index}`,
      kind: "acceptance",
      title: `Must-have: ${item}`,
      detail: `Accepted when “${item}” works on the happy path without workarounds outside this lock.`,
    });
  });

  if (input.primaryAction?.trim()) {
    suggestions.push({
      id: "screen-primary",
      kind: "screen",
      title: "Primary action screen",
      detail: `Preview should show a clear control for: ${input.primaryAction.trim()}.`,
    });
  }

  excluded.slice(0, 4).forEach((item, index) => {
    suggestions.push({
      id: `ex-${index}`,
      kind: "exclusion",
      title: `Keep out: ${item}`,
      detail: `Out of scope — developers must not build “${item}” unless a change order is signed.`,
    });
  });

  if (excluded.length === 0) {
    suggestions.push({
      id: "ex-prompt",
      kind: "exclusion",
      title: "Name one exclusion",
      detail:
        "Add at least one explicit out-of-scope item (e.g. native apps, same-day delivery) so bids stay comparable.",
    });
  }

  return {
    available: true,
    mode: "heuristic",
    summary:
      "Suggestions are grounded only in what you already typed — not inventing new product features.",
    suggestions,
  };
}

function parseAssistPayload(body: unknown): AssistResult | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (!Array.isArray(row.suggestions)) return null;
  return {
    available: row.available !== false,
    mode:
      row.mode === "llm" || row.mode === "heuristic" || row.mode === "unavailable"
        ? row.mode
        : "heuristic",
    summary:
      typeof row.summary === "string"
        ? row.summary
        : "Suggestions grounded in your draft.",
    suggestions: row.suggestions
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item, index): AssistSuggestion => ({
        id: typeof item.id === "string" ? item.id : `s-${index}`,
        kind:
          item.kind === "exclusion" || item.kind === "screen"
            ? item.kind
            : "acceptance",
        title: typeof item.title === "string" ? item.title : "Suggestion",
        detail: typeof item.detail === "string" ? item.detail : "",
      }))
      .filter((item) => item.detail),
  };
}

/**
 * Prefer the edge function (optional LLM polish). Always falls back to
 * local heuristic assist so the UI works without OPENAI_API_KEY.
 */
export async function requestAssist(
  input: AssistInput,
  opts?: { accessToken?: string | null; supabaseUrl?: string; anonKey?: string }
): Promise<AssistResult> {
  const local = heuristicAssist(input);
  const base = opts?.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
  const anon = opts?.anonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  const token = opts?.accessToken;

  if (!base || !anon || !token) return local;

  try {
    const response = await fetch(`${base}/functions/v1/requirement-assist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) return local;
    const parsed = parseAssistPayload(await response.json());
    return parsed?.suggestions.length ? parsed : local;
  } catch {
    return local;
  }
}
