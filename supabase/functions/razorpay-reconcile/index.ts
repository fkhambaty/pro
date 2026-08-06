import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, requireEnv, serviceClient } from "../_shared/backend.ts";

async function razorpayPayments(orderId: string) {
  const credentials = btoa(
    `${requireEnv("RAZORPAY_KEY_ID")}:${requireEnv("RAZORPAY_KEY_SECRET")}`
  );
  const response = await fetch(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );
  if (!response.ok) throw new Error("Provider lookup failed");
  const body = (await response.json()) as {
    items?: Array<Record<string, unknown>>;
  };
  return body.items ?? [];
}

async function settle(body: Record<string, unknown>) {
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
  if (!response.ok) throw new Error("Settlement RPC failed");
  return response.json() as Promise<string>;
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (
    !Deno.env.get("RAZORPAY_RECONCILE_SECRET") ||
    req.headers.get("x-okavo-notify") !== Deno.env.get("RAZORPAY_RECONCILE_SECRET")
  ) {
    return json(401, { error: "Unauthorized" });
  }

  let requestedApply = false;
  try {
    const body = (await req.json()) as { apply?: unknown };
    requestedApply = body.apply === true;
  } catch {
    // An empty cron request is a report-only run.
  }
  const apply =
    requestedApply && Deno.env.get("ALLOW_PAYMENT_RECONCILIATION") === "true";
  const db = serviceClient();

  try {
    const pending = (await db.select(
      "payments?provider=eq.razorpay&status=eq.pending&provider_order_id=not.is.null&created_at=lt." +
        encodeURIComponent(new Date(Date.now() - 30 * 60_000).toISOString()) +
        "&select=id,provider_order_id,amount_cents,currency&order=created_at.asc&limit=100"
    )) as Array<{
      id: string;
      provider_order_id: string;
      amount_cents: number;
      currency: string;
    }>;

    const report: Array<Record<string, unknown>> = [];
    for (const local of pending) {
      const candidates = await razorpayPayments(local.provider_order_id);
      const captured = candidates.find(
        (item) => String(item.status) === "captured"
      );
      const matches = Boolean(
        captured &&
          Number(captured.amount) === local.amount_cents &&
          String(captured.currency).toUpperCase() === local.currency.toUpperCase()
      );
      let action = matches ? "would_settle" : "needs_review";
      if (matches && apply && captured) {
        const result = await settle({
          p_payment_id: local.id,
          p_provider: "razorpay",
          p_order_id: local.provider_order_id,
          p_provider_payment_id: String(captured.id),
          p_amount_cents: Number(captured.amount),
          p_currency: String(captured.currency),
        });
        action = result;
      }
      if (!matches) {
        await db.insert("ops_events", {
          severity: "warning",
          category: "payments",
          code: "stale_pending_payment",
          summary: "A pending Razorpay order needs review",
          entity_type: "payment",
          entity_id: local.id,
          detail: { captured_payment_found: Boolean(captured) },
        });
      }
      report.push({ paymentId: local.id, action });
    }

    return json(200, { mode: apply ? "apply" : "report_only", report });
  } catch {
    console.error("razorpay-reconcile failed");
    return json(500, { error: "Reconciliation failed" });
  }
});
