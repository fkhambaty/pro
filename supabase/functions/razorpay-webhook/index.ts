import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, requireEnv, serviceClient } from "../_shared/backend.ts";

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function rpc(name: string, body: Record<string, unknown>) {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(
    `${requireEnv("SUPABASE_URL")}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) throw new Error(`${name} failed`);
  return response.json() as Promise<string>;
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const raw = await req.text();
  let signatureValid = false;
  try {
    const expected = await hmacHex(requireEnv("RAZORPAY_WEBHOOK_SECRET"), raw);
    signatureValid = safeEqual(
      expected,
      req.headers.get("x-razorpay-signature") ?? ""
    );
  } catch {
    console.error("razorpay-webhook configuration failure");
    return json(500, { error: "Webhook is not configured" });
  }
  if (!signatureValid) return json(400, { error: "Invalid signature" });

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const type = String(event.event ?? "unknown");
  const payload = event.payload as
    | {
        payment?: { entity?: Record<string, unknown> };
        order?: { entity?: Record<string, unknown> };
      }
    | undefined;
  const payment = payload?.payment?.entity;
  const order = payload?.order?.entity;
  const providerPaymentId = payment?.id ? String(payment.id) : null;
  const orderId = payment?.order_id
    ? String(payment.order_id)
    : order?.id
      ? String(order.id)
      : null;
  const eventId =
    typeof event.id === "string"
      ? event.id
      : `${type}:${providerPaymentId ?? orderId ?? await hmacHex("event", raw)}`;

  const db = serviceClient();
  try {
    const seen = (await db.select(
      `payment_provider_events?provider=eq.razorpay&provider_event_id=eq.${encodeURIComponent(eventId)}&select=id,status`
    )) as Array<{ id: string; status: string }>;
    if (seen.length > 0) {
      return json(200, { received: true, duplicate: true });
    }

    const ledger = (await db.insert("payment_provider_events", {
      provider: "razorpay",
      provider_event_id: eventId,
      event_type: type,
      provider_order_id: orderId,
      provider_payment_id: providerPaymentId,
      status: "received",
    })) as Array<{ id: string }>;
    const ledgerId = ledger[0]?.id;

    if (type !== "payment.captured") {
      if (ledgerId) {
        await db.update(`payment_provider_events?id=eq.${ledgerId}`, {
          status: "ignored",
          processed_at: new Date().toISOString(),
        });
      }
      return json(200, { received: true });
    }
    if (!orderId || !providerPaymentId || !payment) {
      if (ledgerId) {
        await db.update(`payment_provider_events?id=eq.${ledgerId}`, {
          status: "failed",
          processed_at: new Date().toISOString(),
        });
      }
      return json(200, { received: true, note: "Incomplete provider event" });
    }

    const notes = (payment.notes ?? {}) as Record<string, string>;
    const filter = notes.payment_id
      ? `id=eq.${encodeURIComponent(notes.payment_id)}`
      : `provider_order_id=eq.${encodeURIComponent(orderId)}`;
    const rows = (await db.select(
      `payments?${filter}&select=id,amount_cents,currency`
    )) as Array<{ id: string; amount_cents: number; currency: string }>;
    const local = rows[0];
    if (!local) {
      if (ledgerId) {
        await db.update(`payment_provider_events?id=eq.${ledgerId}`, {
          status: "ignored",
          processed_at: new Date().toISOString(),
        });
      }
      return json(200, { received: true, note: "Unknown payment" });
    }

    const result = await rpc("settle_provider_payment", {
      p_payment_id: local.id,
      p_provider: "razorpay",
      p_order_id: orderId,
      p_provider_payment_id: providerPaymentId,
      p_amount_cents: Number(payment.amount),
      p_currency: String(payment.currency ?? ""),
    });
    if (ledgerId) {
      await db.update(`payment_provider_events?id=eq.${ledgerId}`, {
        payment_id: local.id,
        status: result === "mismatch" ? "failed" : "processed",
        processed_at: new Date().toISOString(),
      });
    }
    return json(200, { received: true });
  } catch {
    console.error("razorpay-webhook processing failure");
    return json(500, { error: "Webhook processing failed" });
  }
});
