/**
 * Shared environment loading for Okavo scripts.
 *
 * Credentials may come from process.env, `.okavo-agent`, `.env`, or
 * `apps/catalog/.env.local`. Project refs and URLs are never hardcoded by
 * callers — use `resolveTarget()` instead.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Live production Supabase project. Destructive scripts must refuse this. */
export const PRODUCTION_PROJECT_REF = "fzgnzaflvbimbiseqnrz";

const ENV_FILES = [
  ".okavo-agent",
  ".okavo-agent.staging",
  ".env",
  ".env.local",
  "apps/catalog/.env.local",
];

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index === -1) return null;
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
      .filter(Boolean)
  );
}

/** File-backed env, lowest precedence first so later files win. */
export function loadFileEnv() {
  const merged = {};
  for (const name of ENV_FILES) {
    Object.assign(merged, parseEnvFile(join(ROOT, name)));
  }
  // Legacy seed credential file: KEY=value or bare token.
  const tokenPath = join(ROOT, ".supabase-token");
  if (existsSync(tokenPath)) {
    const raw = readFileSync(tokenPath, "utf8").trim();
    const token = raw.includes("=") ? raw.split("=").slice(1).join("=").trim() : raw;
    if (token && !merged.SUPABASE_ACCESS_TOKEN) {
      merged.SUPABASE_ACCESS_TOKEN = token;
    }
  }
  return merged;
}

const fileEnv = loadFileEnv();

export function conf(key) {
  return process.env[key] ?? fileEnv[key] ?? undefined;
}

export function firstConf(...keys) {
  for (const key of keys) {
    const value = conf(key);
    if (value) return value;
  }
  return undefined;
}

export function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

export function need(key, hint) {
  const value = conf(key);
  if (!value) {
    fail(`${key} is not set.\n  ${hint}\n  Put it in .okavo-agent (gitignored) or export it.`);
  }
  return value;
}

function refFromUrl(url) {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Resolve the Supabase target for a script.
 *
 * @param {{ defaultToProduction?: boolean }} [opts]
 *   When `defaultToProduction` is true (agent console), missing config falls
 *   back to the live production ref so existing read-only usage still works.
 *   Seeds and security tests leave this false and require an explicit target.
 */
export function resolveTarget(opts = {}) {
  const { defaultToProduction = false } = opts;

  const urlHint = firstConf("SUPABASE_URL", "VITE_SUPABASE_URL");
  const projectRef =
    firstConf("SUPABASE_PROJECT_REF", "OKAVO_PROJECT_REF") ??
    refFromUrl(urlHint) ??
    (defaultToProduction ? PRODUCTION_PROJECT_REF : undefined);

  if (!projectRef) {
    fail(
      "No Supabase project configured.\n" +
        "  Set SUPABASE_PROJECT_REF (or SUPABASE_URL / VITE_SUPABASE_URL).\n" +
        "  Use a staging project for seeds and security tests."
    );
  }

  const supabaseUrl =
    firstConf("SUPABASE_URL", "VITE_SUPABASE_URL") ??
    `https://${projectRef}.supabase.co`;

  const anonKey = firstConf("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
  const serviceRoleKey = conf("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = conf("SUPABASE_ACCESS_TOKEN");
  const siteUrl = conf("OKAVO_SITE") ?? "https://okavo.org";
  const envName = (conf("OKAVO_ENV") ?? "").toLowerCase();

  const isProduction =
    projectRef === PRODUCTION_PROJECT_REF ||
    envName === "production" ||
    supabaseUrl.includes(`${PRODUCTION_PROJECT_REF}.supabase.co`);

  return {
    projectRef,
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    accessToken,
    siteUrl,
    envName: envName || (isProduction ? "production" : "staging"),
    isProduction,
  };
}

/** Hard stop for any script that mutates data. */
export function assertSafeForDestructiveSeed(target = resolveTarget()) {
  if (!target.isProduction) return;

  if (conf("OKAVO_ALLOW_PRODUCTION_DESTRUCTIVE") === "1") {
    console.warn(
      "\n⚠ OKAVO_ALLOW_PRODUCTION_DESTRUCTIVE=1 — running a destructive seed against production.\n"
    );
    return;
  }

  fail(
    "Refusing destructive seed against production " +
      `(project ${PRODUCTION_PROJECT_REF}).\n` +
      "  Point SUPABASE_PROJECT_REF / SUPABASE_URL at staging, or set\n" +
      "  OKAVO_ALLOW_PRODUCTION_DESTRUCTIVE=1 only for a true emergency."
  );
}

/** RLS / security suites never touch production. */
export function assertStagingOnly(target = resolveTarget()) {
  if (!target.isProduction) return;

  fail(
    "Refusing security tests against production " +
      `(project ${PRODUCTION_PROJECT_REF}).\n` +
      "  Set SUPABASE_PROJECT_REF / SUPABASE_URL to the staging project.\n" +
      "  Production inspection stays on: node scripts/okavo.mjs …"
  );
}

export function requireAnonKey(target = resolveTarget()) {
  if (!target.anonKey) {
    fail(
      "SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) is not set.\n" +
        "  Project Settings → API → anon public key"
    );
  }
  return target.anonKey;
}

export function requireServiceRoleKey(target = resolveTarget()) {
  if (!target.serviceRoleKey) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
        "  Project Settings → API → service_role key"
    );
  }
  return target.serviceRoleKey;
}

export function requireAccessToken(target = resolveTarget()) {
  if (!target.accessToken) {
    fail(
      "SUPABASE_ACCESS_TOKEN is not set.\n" +
        "  Personal access token from supabase.com/dashboard/account/tokens"
    );
  }
  return target.accessToken;
}

export async function managementSql(target, query) {
  const token = requireAccessToken(target);
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${target.projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  const text = await response.text();
  if (!response.ok) fail(`SQL failed: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : [];
}

export function serviceHeaders(target) {
  const key = requireServiceRoleKey(target);
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/**
 * Mint a user session without a password (admin magic link).
 * Used by the agent console and RLS matrix.
 */
export async function sessionFor(target, email) {
  const anon = requireAnonKey(target);
  const link = await fetch(`${target.supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { ...serviceHeaders(target), "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  });

  const body = await link.json();
  if (!link.ok) {
    fail(`Could not generate a link for ${email}: ${JSON.stringify(body).slice(0, 300)}`);
  }

  const tokenHash = body?.properties?.hashed_token ?? body?.hashed_token;
  if (!tokenHash) fail(`No token returned for ${email}`);

  const verify = await fetch(`${target.supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });

  const session = await verify.json();
  if (!verify.ok || !session.access_token) {
    fail(`Could not sign in as ${email}: ${JSON.stringify(session).slice(0, 300)}`);
  }
  return session;
}

export async function passwordSignIn(target, email, password) {
  const anon = requireAnonKey(target);
  const res = await fetch(`${target.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.access_token ?? null;
}

export async function restAs(target, path, token, init = {}) {
  const anon = requireAnonKey(target);
  const res = await fetch(`${target.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json, text };
}
