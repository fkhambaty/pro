# Payment milestones — Razorpay

Use **Razorpay Payment Links** (or Invoices) until Ledger is productized. One link per milestone. Note `Order ID` in the link description.

## Standard split

| Milestone | % | Trigger |
|-----------|---|---------|
| M1 Deposit | 40% | Canon signed |
| M2 Staging | 40% | Owner approves staging vs screen checklist |
| M3 Go-live | 20% | Production domain live |
| Care | Monthly Y | Auto-pay preferred from go-live month |

## Link naming

`FORMA-{ORDER}-{M1|M2|M3|CARE}-{SKU}`  
Example: `FORMA-PUN-001-M1-GROWTH`

## Operator checklist

1. Create Payment Link in Razorpay Dashboard
2. Paste link in WhatsApp + email
3. On paid webhook/email, mark pipeline stage
4. Never start build without M1
5. Never hand over final DNS/ownership docs without M3 (Care can start after M3)

## Care collection

- Prefer Razorpay Subscriptions for Y
- If manual: Payment Link on the 1st of each month
- 7 days overdue → soft pause on non-critical change requests (uptime Care continues 14 days)

## Refunds

- Deposit refundable if FORMA misses go-live by >7 days for FORMA-caused delay (see skus.md)
- After staging approval, M1+M2 are non-refundable except warranty-level total failure
- Care unused days: no prorated refund under 15 days; else operator discretion
