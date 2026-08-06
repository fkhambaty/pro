import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  isPurpose,
  json,
  requireEnv,
  serviceClient,
  stripeRequest,
  type Purpose,
} from "../_shared/backend.ts";

/**
 * Opens a Stripe Checkout session for one of the platform fees.
 *
 * Prices are decided here, never by the caller: the browser may ask to pay a
 * posting fee, but it may not say what a posting fee costs.
 */

const CATALOG: Record<
  Purpose,
  { amountCents: number; name: string; description: string }
> = {
  requirement_posting: {
    amountCents: 100,
    name: "Okavo requirement posting fee",
    description: "Charged once per requirement you publish.",
  },
  bidding_membership: {
    amountCents: 1000,
    name: "Okavo bidding membership",
    description: "One-time fee that unlocks bidding across the marketplace.",
  },
  milestone_funding: {
    amountCents: 0, // Replaced by the milestone amount below.
    name: "Unsupported build payment",
    description: "Build payments are made directly between contract parties.",
  },
};

async function resolveUser(req: Request): Promise<{ id: string; email?: string }> {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
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
  return { id: user.id, email: user.email };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (Deno.env.get("PAYMENTS_PROVIDER") !== "stripe") {
    return json(503, { error: "Stripe payments are disabled" });
  }

  let user: { id: string; email?: string };
  try {
    user = await resolveUser(req);
  } catch (error) {
    return json(401, {
      error: error instanceof Error ? error.message : "Not signed in",
    });
  }

  let payload: { purpose?: unknown; milestoneId?: unknown; returnPath?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (!isPurpose(payload.purpose)) {
    return json(400, { error: "Unknown payment purpose" });
  }
  const purpose = payload.purpose;
  if (purpose === "milestone_funding") {
    return json(400, {
      error: "Okavo does not hold build payments. Pay the developer directly after acceptance.",
    });
  }
  const db = serviceClient();

  try {
    const amountCents = CATALOG[purpose].amountCents;

    if (purpose === "bidding_membership") {
      const paid = (await db.select(
        `payments?profile_id=eq.${user.id}&purpose=eq.bidding_membership&status=eq.paid&select=id`
      )) as unknown[];
      if (paid?.length) {
        return json(409, { error: "Bidding is already unlocked on this account" });
      }
    }

    if (amountCents <= 0) {
      return json(400, { error: "Nothing to charge" });
    }

    const created = (await db.insert("payments", {
      profile_id: user.id,
      purpose,
      status: "pending",
      amount_cents: amountCents,
      provider: "stripe",
      milestone_id: null,
      contract_id: null,
    })) as Array<{ id: string }>;

    const paymentId = created?.[0]?.id;
    if (!paymentId) throw new Error("Could not open a payment record");

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://okavo.org";
    const returnPath =
      typeof payload.returnPath === "string" && payload.returnPath.startsWith("/")
        ? payload.returnPath
        : "/app";

    const separator = returnPath.includes("?") ? "&" : "?";
    const session = await stripeRequest("checkout/sessions", {
      mode: "payment",
      "payment_method_types[0]": "card",
      client_reference_id: paymentId,
      "metadata[payment_id]": paymentId,
      "metadata[purpose]": purpose,
      "metadata[profile_id]": user.id,
      ...(user.email ? { customer_email: user.email } : {}),
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][price_data][product_data][name]": CATALOG[purpose].name,
      "line_items[0][price_data][product_data][description]":
        CATALOG[purpose].description,
      success_url: `${siteUrl}${returnPath}${separator}paid=${purpose}`,
      cancel_url: `${siteUrl}${returnPath}${separator}paid=cancelled`,
    });

    await db.update(`payments?id=eq.${paymentId}`, {
      provider_order_id: String(session.id),
      provider_reference: String(session.id),
    });

    return json(200, { url: session.url, paymentId });
  } catch (error) {
    console.error("stripe-checkout failed");
    return json(500, { error: "Could not open checkout" });
  }
});
