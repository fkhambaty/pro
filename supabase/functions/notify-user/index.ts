import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json, requireEnv, serviceClient } from "../_shared/backend.ts";
import { brandedEmail, sendMail } from "../_shared/mail.ts";

/**
 * Emails one Okavo user about an in-app event.
 * Auth: x-okavo-notify must match NOTIFY_SECRET (same as notify-signup).
 */

type Payload = {
  profile_id?: string;
  email?: string;
  title?: string;
  body?: string;
  link_path?: string;
  cta?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expected = Deno.env.get("NOTIFY_SECRET");
  const provided = req.headers.get("x-okavo-notify");
  if (!expected || provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const title = (payload.title ?? "").trim();
  const body = (payload.body ?? "").trim();
  if (!title || !body) {
    return json(400, { error: "title and body are required" });
  }

  let to = (payload.email ?? "").trim().toLowerCase();
  if (!to && payload.profile_id) {
    const db = serviceClient();
    const rows = (await db.select(
      `profiles?id=eq.${payload.profile_id}&select=email`
    )) as Array<{ email?: string }>;
    to = (rows?.[0]?.email ?? "").trim().toLowerCase();
  }

  if (!to) return json(400, { error: "No recipient email" });

  const branded = brandedEmail({
    title,
    body,
    linkPath: payload.link_path,
    cta: payload.cta,
  });

  try {
    await sendMail({
      to,
      subject: title,
      text: branded.text,
      html: branded.html,
    });
    // Touch requireEnv so misconfigured projects fail loudly in logs elsewhere.
    requireEnv("SUPABASE_URL");
    return json(200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    console.error("notify-user failed", message);
    return json(500, { error: message });
  }
});
