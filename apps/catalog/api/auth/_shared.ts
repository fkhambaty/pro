const REFRESH_COOKIE = "okavo-refresh";
const PKCE_COOKIE = "okavo-pkce";
const COOKIE_PATH = "/";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const PKCE_MAX_AGE = 60 * 15;

export type PublicSession = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: Record<string, unknown>;
};

type SupabaseSession = PublicSession & {
  refresh_token: string;
};

function env(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY"): string {
  const value =
    process.env[name] ??
    process.env[`VITE_${name}` as "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"];
  if (!value) throw new Error(`Missing ${name}`);
  return value.replace(/\/$/, "");
}

export function supabaseUrl(): string {
  return env("SUPABASE_URL");
}

export function anonKey(): string {
  return env("SUPABASE_ANON_KEY");
}

export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", anonKey());
  headers.set("Content-Type", "application/json");
  return headers;
}

export function parseCookies(request: Request): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) result.set(name, decodeURIComponent(value));
  }
  return result;
}

function isLocalRequest(request: Request): boolean {
  const host = request.headers.get("host") ?? "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function cookie(
  request: Request,
  name: string,
  value: string,
  maxAge: number
): string {
  const secure = isLocalRequest(request) ? "" : "; Secure";
  return `${name}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}`;
}

export function refreshCookie(request: Request, token: string): string {
  return cookie(request, REFRESH_COOKIE, token, REFRESH_MAX_AGE);
}

export function clearRefreshCookie(request: Request): string {
  return cookie(request, REFRESH_COOKIE, "", 0);
}

export function pkceCookie(request: Request, verifier: string): string {
  return cookie(request, PKCE_COOKIE, verifier, PKCE_MAX_AGE);
}

export function clearPkceCookie(request: Request): string {
  return cookie(request, PKCE_COOKIE, "", 0);
}

export function refreshToken(request: Request): string | null {
  return parseCookies(request).get(REFRESH_COOKIE) ?? null;
}

export function pkceVerifier(request: Request): string | null {
  return parseCookies(request).get(PKCE_COOKIE) ?? null;
}

export function publicSession(session: SupabaseSession): PublicSession {
  return {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at:
      session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    user: session.user,
  };
}

export function json(
  body: unknown,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readSupabaseResponse(
  response: Response
): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function upstreamError(
  response: Response,
  body: Record<string, unknown>
): Response {
  const message =
    (typeof body.error_description === "string" && body.error_description) ||
    (typeof body.msg === "string" && body.msg) ||
    (typeof body.message === "string" && body.message) ||
    "Authentication request failed.";
  return json({ error: message }, { status: response.status });
}

export function assertCookieMutation(request: Request): Response | null {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  const origin = request.headers.get("origin");
  const csrf = request.headers.get("x-okavo-csrf");
  if (!origin || csrf !== "1") {
    return json({ error: "Invalid request origin." }, { status: 403 });
  }

  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProtocol =
    request.headers.get("x-forwarded-proto") ??
    (isLocalRequest(request) ? "http" : "https");
  const expectedOrigin = forwardedHost
    ? `${forwardedProtocol}://${forwardedHost}`
    : null;
  const allowed = (process.env.AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (origin !== expectedOrigin && !allowed.includes(origin)) {
    return json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

export async function refreshSession(
  request: Request
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const token = refreshToken(request);
  if (!token) {
    const response = new Response(null, { status: 401 });
    return { response, body: {} };
  }
  const response = await fetch(
    `${supabaseUrl()}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: token }),
    }
  );
  return { response, body: await readSupabaseResponse(response) };
}

export function randomVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function redirectOrigin(request: Request): string {
  const configured = process.env.PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    (isLocalRequest(request) ? "http" : "https");
  if (!host) throw new Error("Missing request host");
  return `${protocol}://${host}`;
}
