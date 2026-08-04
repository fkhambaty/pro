# Deploying Okavo

**Live:** https://pro-catalog-nu.vercel.app
**Vercel project:** `pro-catalog` (root directory `apps/catalog`)
**Supabase project:** `fzgnzaflvbimbiseqnrz`


The app is a static single-page build (Vite) talking directly to Supabase.
There is no server to run, so any static host works. Config for Vercel lives in
[vercel.json](../vercel.json); `apps/catalog/public/_redirects` covers Netlify
and Cloudflare Pages.

## 1. Create the database

The CLI on this machine is not authenticated, so this step needs your
credentials. Two options.

### Option A — SQL editor (no CLI, fastest)

1. Open the project → **SQL Editor** → **New query**
2. Paste all of [supabase/migrations/0001_schema.sql](../supabase/migrations/0001_schema.sql), run it
3. Create the auth users referenced by the seed (Authentication → Users), then
   paste [supabase/seed.sql](../supabase/seed.sql) and run it

Seeding is optional. The schema alone is enough to sign up and use the app.

### Option B — CLI

```bash
supabase login
supabase link --project-ref fzgnzaflvbimbiseqnrz
supabase db push
```

`db push` asks for the database password set when the project was created.

## 2. Auth settings

Authentication → Sign In / Providers:

- Turn **Confirm email** off while testing so new accounts can sign in
  immediately. Turn it back on before launch.

Authentication → URL Configuration, once deployed:

- **Site URL**: `https://okavo.org`
- **Redirect URLs**: `https://okavo.org/**`, `https://www.okavo.org/**`,
  `https://pro-catalog-nu.vercel.app/**`, plus local `http://127.0.0.1:5180/**`

Without this, sign-in links bounce to localhost.

### Custom SMTP (send auth mail from `support@okavo.org`)

Free-tier Supabase cannot change the From address or email templates until
custom SMTP is configured. In Auth → SMTP Settings use GoDaddy mailbox SMTP:

| Field | Value |
|-------|--------|
| Sender email | `support@okavo.org` |
| Sender name | `Okavo` |
| Host | `smtpout.secureserver.net` |
| Port | `465` (SSL) or `587` (TLS) |
| Username | `support@okavo.org` |
| Password | the mailbox password for `support@okavo.org` |

After SMTP is live, raise the email rate limit and brand the confirmation /
OTP templates to mention `support@okavo.org`.

## Payments (Stripe)

Money is never written by the browser. `stripe-checkout` opens a Checkout
session and `stripe-webhook` is the only thing that marks a payment paid, so
the `payments` table has a read-only policy for signed-in users.

Set these Supabase function secrets:

| Secret | Where it comes from |
|--------|---------------------|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_live_…` / `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → signing secret (`whsec_…`) |
| `SITE_URL` | `https://okavo.org` |

```bash
supabase secrets set --project-ref fzgnzaflvbimbiseqnrz \
  STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
```

In Stripe, add one webhook endpoint pointing at
`https://fzgnzaflvbimbiseqnrz.supabase.co/functions/v1/stripe-webhook`
subscribed to `checkout.session.completed` and
`checkout.session.async_payment_succeeded`.

Prices for platform fees live in `apps/catalog/src/lib/pricing.ts` (display) and
the Razorpay edge functions (charge): ₹99 posting fee, ₹899 bidding membership.
Milestone build amounts are agreed on the locked contract; Okavo-held escrow is
not live yet — buyers pay developers directly against that schedule.

## 3. Storage buckets

Create three **private** buckets: `identity-documents`,
`interview-recordings`, `deliverables`.

## 4. Deploy

### Vercel (recommended)

1. Push the repo to GitHub
2. Vercel → Add New → Project → import the repo
3. Leave the root directory as the repository root — `vercel.json` already sets
   the build command and output directory
4. Add environment variables (Production **and** Preview):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://fzgnzaflvbimbiseqnrz.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon / public key |

5. Deploy, then add the resulting URL to Supabase Auth URL Configuration

`.env.local` is gitignored, so the variables must be set in the dashboard.

### Cloudflare Pages

Build command `npm run build`, output directory `apps/catalog/dist`, same two
environment variables. `_redirects` handles client-side routing.

## Why the anon key is safe in the browser

`VITE_` variables are compiled into the bundle and visible to anyone. The anon
key is designed for that — every table has row level security, so the key alone
grants nothing. The **service role key must never** appear in this app; it
belongs only in server-side code.

## Custom domain (`okavo.org`)

Domains are already attached on Vercel (`okavo.org` + `www.okavo.org` → apex).
On GoDaddy DNS Records set:

| Type | Name | Value | TTL |
|------|------|--------|-----|
| A | `@` | `216.198.79.1` | 1 Hour |
| A | `@` | `64.29.17.1` | 1 Hour |
| CNAME | `www` | `cname.vercel-dns.com` | 1 Hour |

Remove any old `@` A/AAAA or parking records that conflict. After DNS
propagates, `https://okavo.org` serves the site.
