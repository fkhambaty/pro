import { corsHeaders, json, serviceClient } from "../_shared/backend.ts";

/**
 * Heuristic (+ optional LLM) analysis of a build-exam submission.
 * Scores are advisory for admins; 48h auto-approve still applies if ignored.
 */

type Body = { exam_id?: string };

async function fetchOk(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; finalUrl: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "OkavoExamBot/1.0" },
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, finalUrl: res.url };
  } catch {
    return { ok: false, status: 0, finalUrl: url };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in required" });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!body.exam_id) return json(400, { error: "exam_id required" });

  const db = serviceClient();
  const rows = (await db.select(
    `build_exams?id=eq.${body.exam_id}&select=id,developer_id,github_url,live_url,status,brief_id`
  )) as Record<string, unknown>[];
  const exam = rows[0];
  if (!exam) return json(404, { error: "Exam not found" });
  if (exam.status !== "submitted" && exam.status !== "admin_questions") {
    return json(400, { error: "Exam is not in a reviewable state" });
  }

  const briefs = (await db.select(
    `exam_briefs?id=eq.${exam.brief_id}&select=title,acceptance`
  )) as { title?: string; acceptance?: string }[];
  const brief = briefs[0] ?? null;

  const github = String(exam.github_url ?? "");
  const live = String(exam.live_url ?? "");

  const checks: { id: string; pass: boolean; detail: string }[] = [];

  const ghOk =
    /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(github) ||
    /^https?:\/\/gitlab\.com\//i.test(github);
  checks.push({
    id: "github_url",
    pass: ghOk,
    detail: ghOk ? "GitHub/GitLab URL shape looks valid" : "Need a public GitHub or GitLab repo URL",
  });

  const liveFetch = await fetchOk(live);
  checks.push({
    id: "live_reachable",
    pass: liveFetch.ok,
    detail: liveFetch.ok
      ? `Live URL responded ${liveFetch.status}`
      : "Live URL did not respond OK within timeout",
  });

  const ghFetch = ghOk ? await fetchOk(github) : { ok: false, status: 0, finalUrl: github };
  checks.push({
    id: "repo_reachable",
    pass: ghFetch.ok,
    detail: ghFetch.ok
      ? `Repo page responded ${ghFetch.status}`
      : "Repo URL not reachable (private repos fail this check)",
  });

  const hostOk = (() => {
    try {
      const host = new URL(live).hostname;
      return (
        host.includes("vercel.app") ||
        host.includes("netlify.app") ||
        host.includes("pages.dev") ||
        host.includes("onrender.com") ||
        host.includes("railway.app") ||
        !host.includes("localhost")
      );
    } catch {
      return false;
    }
  })();
  checks.push({
    id: "hosted_not_localhost",
    pass: hostOk,
    detail: hostOk
      ? "Live host looks publicly deployable"
      : "Live URL should be a public deploy (Vercel/Netlify/etc.), not localhost",
  });

  const passed = checks.filter((c) => c.pass).length;
  let overall = Math.round((passed / checks.length) * 100);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (apiKey && brief) {
    try {
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
            {
              role: "system",
              content:
                "You assist Okavo admins reviewing a timed developer exam. " +
                "Given brief acceptance criteria and URLs only, return JSON " +
                "{ score: 0-100, notes: string }. Do not invent that you opened the app beyond HTTP reachability hints.",
            },
            {
              role: "user",
              content: JSON.stringify({
                brief: brief.title,
                acceptance: brief.acceptance,
                github,
                live,
                heuristicChecks: checks,
              }),
            },
          ],
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as {
          score?: number;
          notes?: string;
        };
        if (typeof parsed.score === "number") {
          overall = Math.round((overall + Math.max(0, Math.min(100, parsed.score))) / 2);
          checks.push({
            id: "llm_notes",
            pass: parsed.score >= 60,
            detail: parsed.notes ?? "LLM advisory score applied",
          });
        }
      }
    } catch {
      // Heuristics alone are enough.
    }
  }

  // Persist via PostgREST RPC
  await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/save_exam_auto_score`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_exam_id: body.exam_id,
      p_overall: overall,
      p_detail: { checks, brief: brief?.title ?? null },
    }),
  });

  return json(200, { overall, checks });
});
