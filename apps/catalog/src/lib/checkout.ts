import { supabase } from "./supabase";

export type CheckoutPurpose =
  | "requirement_posting"
  | "bidding_membership"
  | "milestone_funding";

/**
 * Sends the user to Stripe Checkout. The amount is decided by the edge
 * function, so nothing here can change what a fee costs.
 *
 * Resolves only when the redirect could not start; on success the browser
 * has already navigated away.
 */
export async function startCheckout(input: {
  purpose: CheckoutPurpose;
  returnPath: string;
  milestoneId?: string;
}): Promise<{ error: string }> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!supabase || !base) {
    return { error: "Payments are unavailable in demo mode." };
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Sign in again to continue to payment." };

  try {
    const response = await fetch(`${base}/functions/v1/stripe-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify(input),
    });

    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
      return {
        error:
          body.error ??
          "Checkout could not be opened. Please try again in a moment.",
      };
    }

    window.location.assign(body.url);
    return { error: "" };
  } catch {
    return { error: "Could not reach the payment service. Check your connection." };
  }
}

/** Reads the `?paid=` marker Stripe sends the user back with. */
export function readPaymentReturn(search: string): {
  purpose: CheckoutPurpose | null;
  cancelled: boolean;
} {
  const value = new URLSearchParams(search).get("paid");
  if (!value) return { purpose: null, cancelled: false };
  if (value === "cancelled") return { purpose: null, cancelled: true };
  return { purpose: value as CheckoutPurpose, cancelled: false };
}
