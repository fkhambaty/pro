import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPPORT_TO = "support@okavo.org";

type SignupPayload = {
  type?: string;
  email?: string;
  role?: string;
  full_name?: string;
  organization_name?: string;
  user_id?: string;
  /** Auth hook shape */
  user?: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-okavo-notify",
  };
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function normalize(payload: SignupPayload) {
  const meta = payload.user?.user_metadata ?? {};
  const email = (payload.email || payload.user?.email || "").trim();
  const role = String(payload.role || meta.role || "unknown").toLowerCase();
  const fullName = String(
    payload.full_name || meta.full_name || meta.fullName || ""
  ).trim();
  const organization = String(
    payload.organization_name ||
      meta.organization_name ||
      meta.organizationName ||
      ""
  ).trim();
  const userId = payload.user_id || payload.user?.id || "";
  return { email, role, fullName, organization, userId };
}

function roleLabel(role: string): string {
  if (role === "buyer") return "New buyer signup";
  if (role === "developer") return "New developer signup";
  if (role === "admin") return "New admin signup";
  return "New Okavo signup";
}

async function sendSupportMail(details: {
  email: string;
  role: string;
  fullName: string;
  organization: string;
  userId: string;
}) {
  const host = Deno.env.get("SMTP_HOST") ?? "smtpout.secureserver.net";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const user = Deno.env.get("SMTP_USER") ?? "support@okavo.org";
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM") ?? "Okavo <support@okavo.org>";

  if (!pass) throw new Error("SMTP_PASS is not configured");

  const subject = roleLabel(details.role);
  const when = new Date().toISOString();
  const text = [
    subject,
    "",
    `Role: ${details.role}`,
    `Name: ${details.fullName || "(not provided)"}`,
    `Business: ${details.organization || "(not provided)"}`,
    `Email: ${details.email}`,
    `User id: ${details.userId || "(pending)"}`,
    `Signed up at: ${when}`,
    "",
    "— Okavo registration alert",
  ].join("\r\n");

  const html = [
    `<h2>${subject}</h2>`,
    `<table cellpadding="6" style="font-family:sans-serif;font-size:14px">`,
    `<tr><td><strong>Role</strong></td><td>${details.role}</td></tr>`,
    `<tr><td><strong>Name</strong></td><td>${details.fullName || "(not provided)"}</td></tr>`,
    `<tr><td><strong>Business</strong></td><td>${details.organization || "(not provided)"}</td></tr>`,
    `<tr><td><strong>Email</strong></td><td>${details.email}</td></tr>`,
    `<tr><td><strong>User id</strong></td><td>${details.userId || "(pending)"}</td></tr>`,
    `<tr><td><strong>Signed up at</strong></td><td>${when}</td></tr>`,
    `</table>`,
    `<p style="color:#666;font-size:12px">Okavo registration alert</p>`,
  ].join("");

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: true,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from,
      to: SUPPORT_TO,
      subject,
      content: text,
      html,
    });
  } finally {
    await client.close();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const expected = Deno.env.get("NOTIFY_SECRET");
  const provided = req.headers.get("x-okavo-notify");
  if (!expected || provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }

  let payload: SignupPayload;
  try {
    payload = (await req.json()) as SignupPayload;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const details = normalize(payload);
  if (!details.email) {
    return json(400, { error: "email is required" });
  }

  try {
    await sendSupportMail(details);
    return json(200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    console.error("notify-signup failed", message);
    return json(500, { error: message });
  }
});
