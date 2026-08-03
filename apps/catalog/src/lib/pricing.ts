/**
 * Every price Okavo charges, in one place.
 *
 * Platform fees are collected in INR through Razorpay. Build budgets and
 * contract values stay in the currency the buyer and developer agree between
 * themselves — Okavo does not process those yet, so it does not convert them.
 *
 * The amounts here are display only. The edge function decides what to
 * actually charge, so a modified browser cannot buy a posting for less.
 */

export const FEE_CURRENCY = "INR";

/** Charged once per requirement published. */
export const POSTING_FEE_MINOR = 9900; // ₹99

/** One-time fee that unlocks bidding for a developer. */
export const MEMBERSHIP_FEE_MINOR = 89900; // ₹899

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Formats a paise amount as ₹99. */
export function fee(minorUnits: number): string {
  return inr.format(minorUnits / 100);
}

export const POSTING_FEE_LABEL = fee(POSTING_FEE_MINOR);
export const MEMBERSHIP_FEE_LABEL = fee(MEMBERSHIP_FEE_MINOR);
