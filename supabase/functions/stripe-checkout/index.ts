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
    name: "Okavo milestone escrow",
    description: "Held in escrow until you accept the work.",
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
  const db = serviceClient();

  try {
    let amountCents = CATALOG[purpose].amountCents;
    let milestoneId: string | null = null;
    let contractId: string | null = null;

    if (purpose === "milestone_funding") {
      if (typeof payload.milestoneId !== "string") {
        return json(400, { error: "milestoneId is required" });
      }
      milestoneId = payload.milestoneId;

      // The escrow amount comes from the locked contract, not the client.
      const rows = (await db.select(
        `milestones?id=eq.${milestoneId}&select=id,amount_cents,status,contract_id,contracts(buyer_id)`
      )) as Array<{
        amount_cents: number;
        status: string;
        contract_id: string;
        contracts: { buyer_id: string } | { buyer_id: string }[] | null;
      }>;

      const milestone = rows?.[0];
      if (!milestone) return json(404, { error: "Milestone not found" });

      const contract = Array.isArray(milestone.contracts)
        ? milestone.contracts[0]
        : milestone.contracts;
      if (!contract || contract.buyer_id !== user.id) {
        return json(403, { error: "Only the buyer can fund this milestone" });
      }
      if (milestone.status !== "pending") {
        return json(409, { error: "This milestone is already funded" });
      }

      amountCents = milestone.amount_cents;
      contractId = milestone.contract_id;
    }

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
      milestone_id: milestoneId,
      contract_id: contractId,
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
      provider_reference: String(session.id),
    });

    return json(200, { url: session.url, paymentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    console.error("stripe-checkout failed", message);
    return json(500, { error: message });
  }
});
