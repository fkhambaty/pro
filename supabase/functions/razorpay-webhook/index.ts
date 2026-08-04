import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, requireEnv, serviceClient } from "../_shared/backend.ts";

/**
 * Razorpay's callback, and a backup place a fee is marked paid.
 *
 * Primary settlement is razorpay-confirm (Checkout signature verification).
 * This webhook covers cases where the browser closed before confirm ran.
 *
 * Without the signature check below, anyone could POST "payment succeeded"
 * and mint themselves free postings, so an unverifiable request is refused
 * before anything is read from it.
 */

async function verifySignature(payload: string, header: string | null, secret: string) {
  if (!header) return false;

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
  const digest = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (digest.length !== header.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i += 1) {
    mismatch |= digest.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const payload = await req.text();

  let verified = false;
  try {
    verified = await verifySignature(
      payload,
      req.headers.get("x-razorpay-signature"),
      requireEnv("RAZORPAY_WEBHOOK_SECRET")
    );
  } catch (error) {
    console.error("razorpay-webhook not configured", error);
    return json(500, { error: "Webhook is not configured" });
  }

  if (!verified) return json(400, { error: "Invalid signature" });

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const type = event?.event as string | undefined;
  // payment.authorized can precede capture on some methods; still settle so
  // the buyer is not stuck waiting while capture completes asynchronously.
  if (
    type !== "payment.captured" &&
    type !== "payment.authorized" &&
    type !== "order.paid"
  ) {
    return json(200, { received: true, note: `Ignored ${type}` });
  }

  const payloadObj = event?.payload as
    | {
        payment?: { entity?: Record<string, unknown> };
        order?: { entity?: Record<string, unknown> };
      }
    | undefined;
  const payment = payloadObj?.payment?.entity;
  const order = payloadObj?.order?.entity;

  const paymentNotes = (payment?.notes ?? {}) as Record<string, string>;
  const orderNotes = (order?.notes ?? {}) as Record<string, string>;

  const paymentId: string | undefined =
    paymentNotes.payment_id ?? orderNotes.payment_id;
  const orderId: string | undefined =
    (payment?.order_id as string | undefined) ?? (order?.id as string | undefined);
  const razorpayPaymentId = payment?.id ? String(payment.id) : undefined;

  if (!paymentId && !orderId) {
    return json(200, { received: true, note: "No payment reference" });
  }

  const db = serviceClient();
  const filter = paymentId
    ? `id=eq.${paymentId}`
    : `provider_reference=eq.${orderId}`;

  try {
    const rows = (await db.select(`payments?${filter}&select=id,status`)) as Array<{
      id: string;
      status: string;
    }>;

    const record = rows?.[0];
    if (!record) return json(200, { received: true, note: "Unknown payment" });

    if (record.status === "paid") {
      return json(200, { received: true, note: "Already settled" });
    }

    await db.update(`payments?id=eq.${record.id}&status=neq.paid`, {
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_reference: razorpayPaymentId ?? orderId,
    });

    return json(200, { received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    console.error("razorpay-webhook failed", message);
    return json(500, { error: message });
  }
});
