import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  json,
  requireEnv,
  serviceClient,
  verifyStripeSignature,
} from "../_shared/stripe.ts";

/**
 * Stripe's callback. This is the only place a payment is ever marked paid,
 * so the browser cannot grant itself a fee, a membership, or funded escrow.
 */

type CheckoutSession = {
  id: string;
  payment_status?: string;
  amount_total?: number;
  payment_intent?: string;
  metadata?: { payment_id?: string; purpose?: string; profile_id?: string };
};

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const payload = await req.text();

  let verified = false;
  try {
    verified = await verifyStripeSignature(
      payload,
      req.headers.get("stripe-signature"),
      requireEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch (error) {
    console.error("webhook config error", error);
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
      `payments?id=eq.${paymentId}&select=id,status,purpose,milestone_id`
    )) as Array<{
      id: string;
      status: string;
      purpose: string;
      milestone_id: string | null;
    }>;

    const payment = rows?.[0];
    if (!payment) {
      return json(200, { received: true, note: "Unknown payment" });
    }

    // Replays are common and must be harmless.
    if (payment.status === "paid") {
      return json(200, { received: true, note: "Already settled" });
    }

    await db.update(`payments?id=eq.${paymentId}&status=neq.paid`, {
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_reference: session.payment_intent
        ? String(session.payment_intent)
        : session.id,
    });

    // Escrow only moves the milestone after the money has actually landed.
    if (payment.purpose === "milestone_funding" && payment.milestone_id) {
      await db.update(`milestones?id=eq.${payment.milestone_id}`, {
        status: "funded",
        funded_at: new Date().toISOString(),
      });
    }

    return json(200, { received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    console.error("stripe-webhook failed", message);
    // A 500 makes Stripe retry, which is what we want on a transient failure.
    return json(500, { error: message });
  }
});
