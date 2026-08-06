/** Shared Stripe + Supabase helpers for the payment functions. */

export const PURPOSES = [
  "requirement_posting",
  "bidding_membership",
  "milestone_funding",
] as const;

export type Purpose = (typeof PURPOSES)[number];

export function isPurpose(value: unknown): value is Purpose {
  return typeof value === "string" && (PURPOSES as readonly string[]).includes(value);
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature, x-okavo-notify, x-razorpay-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

/** Validates a caller JWT with Supabase Auth. Never trusts header presence. */
export async function authenticatedUser(
  req: Request
): Promise<AuthenticatedUser | null> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;

  const response = await fetch(`${requireEnv("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: requireEnv("SUPABASE_ANON_KEY"),
    },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    id?: string;
    email?: string;
  };
  return payload.id ? { id: payload.id, email: payload.email } : null;
}

/**
 * Calls the Stripe REST API directly. Avoids pulling the Node SDK into Deno
 * for the two endpoints this app needs.
 */
export async function stripeRequest(
  path: string,
  form: Record<string, string>
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `Stripe request failed (${response.status})`);
  }
  return body;
}

/** Minimal service-role REST client, so the functions bypass RLS deliberately. */
export function serviceClient() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  async function call(
    method: string,
    path: string,
    body?: unknown,
    prefer?: string
  ) {
    const headers: Record<string, string> = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase ${method} ${path} failed: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  return {
    select: (path: string) => call("GET", path),
    insert: (table: string, row: unknown) =>
      call("POST", table, row, "return=representation"),
    update: (path: string, patch: unknown) =>
      call("PATCH", path, patch, "return=representation"),
    rpc: (name: string, args: unknown) =>
      call("POST", `rpc/${name}`, args),
  };
}

/** Verifies a Stripe webhook signature without the Node SDK. */
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [k, ...rest] = part.split("=");
      return [k.trim(), rest.join("=")];
    })
  );

  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  // Reject anything older than five minutes to blunt replay attempts.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(`${timestamp}.${payload}`)
  );
  const digest = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (digest.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i += 1) {
    mismatch |= digest.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
