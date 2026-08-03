import { supabase } from "./supabase";

export type CheckoutPurpose = "requirement_posting" | "bidding_membership";

type RazorpayOptions = Record<string, unknown>;
type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<boolean> | null = null;

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Waits for the webhook to mark the payment paid.
 *
 * Razorpay's browser callback fires the moment the card is authorised, which
 * is before the webhook has told our database anything. Treating that
 * callback as proof of payment would let a modified browser claim a purchase,
 * so success is read back from our own row instead.
 */
async function waitForSettlement(paymentId: string): Promise<boolean> {
  if (!supabase) return false;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data } = await supabase
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .maybeSingle();

    if (data?.status === "paid") return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

export type CheckoutResult =
  | { status: "paid" }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "error"; message: string };

/**
 * Collects one of the platform fees through Razorpay Checkout.
 *
 * Resolves only once the payment has actually settled, been dismissed, or
 * failed — so the caller never has to guess.
 */
export async function collectFee(
  purpose: CheckoutPurpose,
  buyer?: { name?: string; email?: string | null }
): Promise<CheckoutResult> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!supabase || !base) {
    return { status: "error", message: "Payments are unavailable in demo mode." };
  }

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    return { status: "error", message: "Sign in again to continue to payment." };
  }

  let order: {
    orderId: string;
    amount: number;
    currency: string;
    label: string;
    paymentId: string;
    keyId: string;
  };

  try {
    const response = await fetch(`${base}/functions/v1/razorpay-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ purpose }),
    });

    const body = await response.json();
    if (!response.ok) {
      return {
        status: "error",
        message: body?.error ?? "Payment could not be started.",
      };
    }
    order = body;
  } catch {
    return {
      status: "error",
      message: "Could not reach the payment service. Check your connection.",
    };
  }

  const ready = await loadCheckout();
  if (!ready || !window.Razorpay) {
    return {
      status: "error",
      message:
        "The payment window could not load. Disable any ad blocker for this site and try again.",
    };
  }

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Okavo",
      description: order.label,
      prefill: {
        name: buyer?.name ?? "",
        email: buyer?.email ?? "",
      },
      theme: { color: "#e8973a" },
      handler: () => {
        void waitForSettlement(order.paymentId).then((paid) =>
          finish(paid ? { status: "paid" } : { status: "pending" })
        );
      },
      modal: {
        ondismiss: () => finish({ status: "cancelled" }),
      },
    });

    checkout.open();
  });
}
