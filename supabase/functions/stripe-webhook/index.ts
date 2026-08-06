import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  json,
  requireEnv,
  serviceClient,
  verifyStripeSignature,
} from "../_shared/backend.ts";

/**
 * Stripe's callback. This is the only place a payment is ever marked paid,
 * so the browser cannot grant itself a fee, a membership, or funded escrow.
 */

type CheckoutSession = {
  id: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  payment_intent?: string;
  metadata?: { payment_id?: string; purpose?: string; profile_id?: string };
};

async function settlePayment(body: Record<string, unknown>) {
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
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) throw new Error("Atomic settlement failed");
  return response.json() as Promise<string>;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (Deno.env.get("PAYMENTS_PROVIDER") !== "stripe") {
    return json(503, { error: "Stripe payments are disabled" });
  }

  const payload = await req.text();

  let verified = false;
  try {
    verified = await verifyStripeSignature(
      payload,
      req.headers.get("stripe-signature"),
      requireEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch {
    console.error("stripe-webhook configuration failure");
    return json(500, { error: "Webhook is not configured" });
  }

  if (!verified) {
    return json(400, { error: "Invalid signature" });
  }

  let event: { type?: string; data?: { object?: CheckoutSession } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // Anything other than a completed checkout is acknowledged and ignored.
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return json(200, { received: true });
  }

  const session = event.data?.object;
  const paymentId = session?.metadata?.payment_id;
  if (!session || !paymentId) {
    return json(200, { received: true, note: "No payment reference" });
  }
  if (session.payment_status && session.payment_status !== "paid") {
    return json(200, { received: true, note: "Not paid yet" });
  }

  const db = serviceClient();

  try {
    const rows = (await db.select(
      `payments?id=eq.${paymentId}&select=id,status,purpose,amount_cents,currency,provider_order_id`
    )) as Array<{
      id: string;
      status: string;
      purpose: string;
      amount_cents: number;
      currency: string;
      provider_order_id: string | null;
    }>;

    const payment = rows?.[0];
    if (!payment) {
      return json(200, { received: true, note: "Unknown payment" });
    }

    // Replays are common and must be harmless.
    if (payment.status === "paid") {
      return json(200, { received: true, note: "Already settled" });
    }
    if (
      session.id !== payment.provider_order_id ||
      session.amount_total !== payment.amount_cents ||
      String(session.currency ?? "").toUpperCase() !== payment.currency.toUpperCase()
    ) {
      return json(400, { error: "Payment amount, currency, or session mismatch" });
    }

    await settlePayment({
      p_payment_id: payment.id,
      p_provider: "stripe",
      p_order_id: session.id,
      p_provider_payment_id: session.payment_intent
        ? String(session.payment_intent)
        : session.id,
      p_amount_cents: session.amount_total,
      p_currency: session.currency,
    });

    return json(200, { received: true });
  } catch {
    console.error("stripe-webhook failed");
    // A 500 makes Stripe retry, which is what we want on a transient failure.
    return json(500, { error: "Webhook processing failed" });
  }
});
