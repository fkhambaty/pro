#!/usr/bin/env node
/**
 * End-to-end check against the live Supabase project.
 * Signs in as each seeded account and exercises the paths the app uses.
 *
 *   node scripts/smoke-test.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../apps/catalog/.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

const pass = [];
const fail = [];

function check(name, ok, detail = "") {
  (ok ? pass : fail).push(`${name}${detail ? ` — ${detail}` : ""}`);
}

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.access_token ?? null;
}

async function rest(path, token, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const ACCOUNTS = {
  buyer: "fk_qrf@yahoo.com",
  developer: "fktiindia@gmail.com",
  admin: "admin@okavo.app",
};

const tokens = {};

for (const [role, email] of Object.entries(ACCOUNTS)) {
  const token = await signIn(email, "123456789");
  tokens[role] = token;
  check(`${role} can sign in`, Boolean(token), token ? "" : "no access token");
}

// Profile visible to its owner. Admins can read every profile, so match on
// the signed-in email rather than assuming the first row is theirs.
for (const [role, email] of Object.entries(ACCOUNTS)) {
  if (!tokens[role]) continue;
  const { body } = await rest(
    `profiles?select=role,email&email=eq.${encodeURIComponent(email)}`,
    tokens[role]
  );
  const row = Array.isArray(body) ? body[0] : null;
  check(
    `${role} profile row exists`,
    row?.role === role,
    row ? `role=${row.role}` : "no row returned"
  );
}

// Developer verification state — required before bidding
if (tokens.developer) {
  const { body } = await rest(
    "developer_profiles?select=identity_status,tier,bidding_unlocked_at",
    tokens.developer
  );
  const row = Array.isArray(body) ? body[0] : null;
  check(
    "developer identity approved",
    row?.identity_status === "approved",
    `status=${row?.identity_status}`
  );
  check(
    "developer bidding still locked (paywall intact)",
    !row?.bidding_unlocked_at,
    row?.bidding_unlocked_at ? "already unlocked" : "not paid yet"
  );
}

// The posting-fee paywall must reject a requirement with no fee paid
if (tokens.buyer) {
  const { body: me } = await rest("profiles?select=id", tokens.buyer);
  const buyerId = Array.isArray(me) ? me[0]?.id : null;

  const attempt = await rest("projects", tokens.buyer, {
    method: "POST",
    body: JSON.stringify({
      buyer_id: buyerId,
      title: "Smoke test — should be rejected",
      category: "Web application",
      outcome_statement: "This insert must fail without a posting fee.",
      budget_min_cents: 100000,
      budget_max_cents: 200000,
      monthly_run_cents: 1000,
      timeline_weeks: 4,
    }),
  });
  const blocked =
    attempt.status >= 400 &&
    JSON.stringify(attempt.body).includes("posting fee");
  check(
    "posting fee enforced in database",
    blocked,
    blocked ? "insert rejected" : `unexpected status ${attempt.status}`
  );
}

// Admin can see the review queue and every profile
if (tokens.admin) {
  const queue = await rest("identity_verifications?select=id", tokens.admin);
  check("admin can read verification queue", queue.status === 200, `status ${queue.status}`);

  const all = await rest("profiles?select=id", tokens.admin);
  check(
    "admin sees all profiles",
    Array.isArray(all.body) && all.body.length >= 3,
    `${Array.isArray(all.body) ? all.body.length : 0} profiles`
  );
}

// A buyer must not be able to read another user's payments
if (tokens.buyer) {
  const { body } = await rest("payments?select=id,profile_id", tokens.buyer);
  const leaked = Array.isArray(body) && body.length > 0;
  check("payments are private to their owner", !leaked, leaked ? "LEAK" : "none visible");
}

// A developer can upload an identity document to their own folder, and cannot
// write into somebody else's.
if (tokens.developer) {
  const { body: me } = await rest("profiles?select=id", tokens.developer, {
    headers: { Accept: "application/json" },
  });
  const devId = Array.isArray(me) ? me[0]?.id : null;
  const path = `${devId}/smoke-${Date.now()}.txt`;

  const upload = await fetch(`${URL}/storage/v1/object/identity-documents/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${tokens.developer}`,
      "Content-Type": "text/plain",
    },
    body: "smoke test",
  });
  check("developer can upload an ID document", upload.ok, `status ${upload.status}`);

  const intruder = await fetch(
    `${URL}/storage/v1/object/identity-documents/00000000-0000-0000-0000-000000000000/hack.txt`,
    {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${tokens.developer}`,
        "Content-Type": "text/plain",
      },
      body: "should be blocked",
    }
  );
  check(
    "cannot upload into another user's folder",
    !intruder.ok,
    `status ${intruder.status}`
  );

  if (upload.ok) {
    await fetch(`${URL}/storage/v1/object/identity-documents/${path}`, {
      method: "DELETE",
      headers: { apikey: KEY, Authorization: `Bearer ${tokens.developer}` },
    });
  }
}

console.log("\nPASS");
pass.forEach((p) => console.log("  ✓", p));
if (fail.length) {
  console.log("\nFAIL");
  fail.forEach((f) => console.log("  ✗", f));
}
console.log(`\n${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
