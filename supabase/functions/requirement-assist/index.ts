import { corsHeaders, json } from "../_shared/backend.ts";
import { checkGuardrails } from "../_shared/guardrails.ts";

/**
 * Optional grounded assist.
 * Body: { outcome, categoryLabel, mustHaves[], excluded, primaryAction? }
 * Always returns heuristic suggestions. If OPENAI_API_KEY is set, may add
 * one LLM polish pass that may ONLY rephrase the provided context.
 */

type Body = {
  outcome?: string;
  categoryLabel?: string;
  mustHaves?: string[];
  excluded?: string;
  primaryAction?: string;
};

function heuristic(body: Body) {
  const suggestions: Record<string, unknown>[] = [];
  const outcome = (body.outcome ?? "").trim();
  const must = Array.isArray(body.mustHaves) ? body.mustHaves : [];
  const excluded = (body.excluded ?? "")
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (outcome) {
    suggestions.push({
      id: "acc-outcome",
      kind: "acceptance",
      title: "Primary outcome check",
      detail: `Accepted when a reviewer can walk the product and confirm: “${outcome.slice(0, 180)}”.`,
    });
  }
  must.slice(0, 5).forEach((item, index) => {
    suggestions.push({
      id: `acc-must-${index}`,
      kind: "acceptance",
      title: `Must-have: ${item}`,
      detail: `Accepted when “${item}” works on the happy path without workarounds outside this lock.`,
    });
  });
  if ((body.primaryAction ?? "").trim()) {
    suggestions.push({
      id: "screen-primary",
      kind: "screen",
      title: "Primary action screen",
      detail: `Preview should show a clear control for: ${(body.primaryAction ?? "").trim()}.`,
    });
  }
  excluded.slice(0, 4).forEach((item, index) => {
    suggestions.push({
      id: `ex-${index}`,
      kind: "exclusion",
      title: `Keep out: ${item}`,
      detail: `Out of scope — do not build “${item}” without a signed change order.`,
    });
  });
  if (excluded.length === 0) {
    suggestions.push({
      id: "ex-prompt",
      kind: "exclusion",
      title: "Name one exclusion",
      detail:
        "Add at least one explicit out-of-scope item so bids stay comparable.",
    });
  }

  return {
    available: true,
    mode: "heuristic" as const,
    summary:
      "Suggestions are grounded only in what you already typed — not inventing new product features.",
    suggestions,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json(405, { error: "POST only" });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const outcome = (body.outcome ?? "").trim();
  const guard = checkGuardrails("outcome", outcome);
  if (!guard.ok) {
    return json(400, {
      error: guard.message,
      code: guard.code,
      blocked: true,
    });
  }

  const base = heuristic(body);
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    return json(200, base);
  }

  try {
    const system =
      "You help non-technical buyers tighten software requirements. " +
      "You may ONLY rephrase or structure facts present in the user JSON. " +
      "Never invent features, screens, fees, escrow, commissions, or timelines. " +
      "Return JSON: { summary: string, suggestions: [{ id, kind, title, detail }] } " +
      "kind must be acceptance|exclusion|screen. Max 8 suggestions.";

    const user = JSON.stringify({
      outcome: body.outcome,
      categoryLabel: body.categoryLabel,
      mustHaves: body.mustHaves ?? [],
      excluded: body.excluded ?? "",
      primaryAction: body.primaryAction ?? "",
      seed: base.suggestions,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_ASSIST_MODEL") ?? "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      return json(200, { ...base, mode: "heuristic", llmError: true });
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      summary?: string;
      suggestions?: Record<string, unknown>[];
    };

    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      return json(200, base);
    }

    return json(200, {
      available: true,
      mode: "llm",
      summary:
        parsed.summary ??
        "LLM polish of your own draft only — no new product inventing.",
      suggestions: parsed.suggestions.slice(0, 8),
    });
  } catch {
    return json(200, base);
  }
});
