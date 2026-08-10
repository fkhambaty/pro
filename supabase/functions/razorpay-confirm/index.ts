import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  json,
  requireEnv,
  serviceClient,
} from "../_shared/backend.ts";
import { consumeRateLimit, tooManyRequests } from "../_shared/rateLimit.ts";

/**
 * Settles a platform fee after Razorpay Checkout succeeds in the browser.
 *
 * The browser callback is not trusted alone: we verify
 * HMAC_SHA256(order_id|payment_id, KEY_SECRET) matches the signature Razorpay
 * returned, then confirm the payment is captured via the Razorpay API, then
 * mark our payments row paid. The webhook remains a backup for retries.
 */

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function resolveUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing bearer token");

  const response = await fetch(`${requireEnv("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: requireEnv("SUPABASE_ANON_KEY"),
    },
  });
  if (!response.ok) throw new Error("Not signed in");

  const user = (await response.json()) as { id?: string };
  if (!user.id) throw new Error("Not signed in");
  return user as { id: string };
}

async function razorpayGet(path: string) {
  const auth = btoa(
    `${requireEnv("RAZORPAY_KEY_ID")}:${requireEnv("RAZORPAY_KEY_SECRET")}`
  );
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error as { description?: string } | undefined;
    throw new Error(error?.description ?? `Razorpay GET ${path} failed`);
  }
  return body;
}

async function settlePayment(input: Record<string, unknown>) {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(
    `${requireEnv("SUPABASE_URL")}/rest/v1/rpc/settle_provider_payment`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) throw new Error("Atomic payment settlement failed");
  return response.json() as Promise<string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, req);

  let user: { id: string };
  try {
    user = await resolveUser(req);
  } catch (error) {
    return json(401, {
      error: error instanceof Error ? error.message : "Not signed in",
    }, req);
  }

  const withinLimit = await consumeRateLimit({
    scope: "razorpay-confirm",
    actor: user.id,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!withinLimit) {
    return tooManyRequests(
      req,
      3600,
      "Too many payment confirmations. Try again in an hour."
    );
  }

  let payload: {
    payment_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" }, req);
  }

  const okavoPaymentId = (payload.payment_id ?? "").trim();
  const orderId = (payload.razorpay_order_id ?? "").trim();
  const razorpayPaymentId = (payload.razorpay_payment_id ?? "").trim();
  const signature = (payload.razorpay_signature ?? "").trim();

  if (!okavoPaymentId || !orderId || !razorpayPaymentId || !signature) {
    return json(400, {
      error: "payment_id, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
    }, req);
  }

  try {
    const expected = await hmacHex(
      requireEnv("RAZORPAY_KEY_SECRET"),
      `${orderId}|${razorpayPaymentId}`
    );
    if (!timingSafeEqual(expected, signature)) {
      return json(400, { error: "Invalid payment signature" }, req);
    }

    const db = serviceClient();
    const rows = (await db.select(
      `payments?id=eq.${okavoPaymentId}&select=id,status,profile_id,provider,provider_order_id,purpose,amount_cents,currency`
    )) as Array<{
      id: string;
      status: string;
      profile_id: string;
      provider: string;
      provider_order_id: string | null;
      purpose: string;
      amount_cents: number;
      currency: string;
    }>;

    const record = rows?.[0];
    if (!record) return json(404, { error: "Payment not found" }, req);
    if (record.profile_id !== user.id) {
      return json(403, { error: "This payment does not belong to you" }, req);
    }
    if (record.provider !== "razorpay") {
      return json(400, { error: "Not a Razorpay payment" }, req);
    }
    if (record.provider_order_id !== orderId) {
      return json(400, { error: "Order does not match this payment" }, req);
    }
    if (record.status === "paid") {
      return json(200, { ok: true, alreadyPaid: true }, req);
    }

    const remote = await razorpayGet(`payments/${razorpayPaymentId}`);
    const remoteStatus = String(remote.status ?? "");
    const remoteOrder = String(remote.order_id ?? "");
    const remoteAmount = Number(remote.amount);
    const remoteCurrency = String(remote.currency ?? "").toUpperCase();
    if (remoteOrder && remoteOrder !== orderId) {
      return json(400, { error: "Razorpay order mismatch" }, req);
    }
    if (remoteStatus !== "captured") {
      return json(409, {
        error: `Payment is ${remoteStatus || "unknown"}, not captured`,
      }, req);
    }
    if (
      remoteAmount !== record.amount_cents ||
      remoteCurrency !== record.currency.toUpperCase()
    ) {
      return json(400, { error: "Payment amount or currency does not match" }, req);
    }

    // notes.payment_id was set when the order was created — prefer that match.
    const notes = (remote.notes ?? {}) as Record<string, string>;
    if (notes.payment_id && notes.payment_id !== okavoPaymentId) {
      return json(400, { error: "Payment notes do not match" }, req);
    }

    const result = await settlePayment({
      p_payment_id: record.id,
      p_provider: "razorpay",
      p_order_id: orderId,
      p_provider_payment_id: razorpayPaymentId,
      p_amount_cents: remoteAmount,
      p_currency: remoteCurrency,
    });

    return json(200, {
      ok: true,
      alreadyPaid: result === "already_paid",
      purpose: record.purpose,
    }, req);
  } catch (error) {
    console.error("razorpay-confirm failed");
    return json(500, { error: "Could not confirm payment" }, req);
  }
});
