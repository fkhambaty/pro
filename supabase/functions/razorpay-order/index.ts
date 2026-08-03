import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  json,
  requireEnv,
  serviceClient,
} from "../_shared/backend.ts";

/**
 * Opens a Razorpay order for one of the platform fees.
 *
 * The amount is decided here and never accepted from the caller: the browser
 * may ask to pay a posting fee, but it may not say what a posting fee costs.
 * The order is recorded as a pending payment; only the webhook marks it paid.
 */

type Purpose = "requirement_posting" | "bidding_membership";

const CATALOG: Record<Purpose, { amount: number; label: string }> = {
  // Amounts are in paise.
  requirement_posting: { amount: 9900, label: "Okavo requirement posting fee" },
  bidding_membership: { amount: 89900, label: "Okavo bidding membership" },
};

const CURRENCY = "INR";

function isPurpose(value: unknown): value is Purpose {
  return value === "requirement_posting" || value === "bidding_membership";
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

  const user = (await response.json()) as { id?: string; email?: string };
  if (!user.id) throw new Error("Not signed in");
  return user as { id: string; email?: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let user: { id: string; email?: string };
  try {
    user = await resolveUser(req);
  } catch (error) {
    return json(401, {
      error: error instanceof Error ? error.message : "Not signed in",
    });
  }

  let payload: { purpose?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (!isPurpose(payload.purpose)) {
    return json(400, { error: "Unknown payment purpose" });
  }
  const purpose = payload.purpose;
  const { amount, label } = CATALOG[purpose];
  const db = serviceClient();

  try {
    if (purpose === "bidding_membership") {
      const paid = (await db.select(
        `payments?profile_id=eq.${user.id}&purpose=eq.bidding_membership&status=eq.paid&select=id`
      )) as unknown[];
      if (paid?.length) {
        return json(409, { error: "Bidding is already unlocked on this account" });
      }
    }

    const created = (await db.insert("payments", {
      profile_id: user.id,
      purpose,
      status: "pending",
      amount_cents: amount,
      currency: CURRENCY,
      provider: "razorpay",
    })) as Array<{ id: string }>;

    const paymentId = created?.[0]?.id;
    if (!paymentId) throw new Error("Could not open a payment record");

    const auth = btoa(
      `${requireEnv("RAZORPAY_KEY_ID")}:${requireEnv("RAZORPAY_KEY_SECRET")}`
    );

    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: CURRENCY,
        // Razorpay caps receipts at 40 characters.
        receipt: paymentId.replace(/-/g, "").slice(0, 40),
        notes: { payment_id: paymentId, purpose, profile_id: user.id },
      }),
    });

    const order = (await orderResponse.json()) as Record<string, any>;
    if (!orderResponse.ok || !order.id) {
      const message = order?.error?.description ?? "Razorpay rejected the order";
      throw new Error(message);
    }

    await db.update(`payments?id=eq.${paymentId}`, {
      provider_reference: String(order.id),
    });

    return json(200, {
      orderId: order.id,
      amount,
      currency: CURRENCY,
      label,
      paymentId,
      keyId: requireEnv("RAZORPAY_KEY_ID"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    console.error("razorpay-order failed", message);
    return json(500, { error: message });
  }
});
