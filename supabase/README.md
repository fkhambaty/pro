# Supabase setup

The marketplace runs on demo data by default. Add Supabase credentials and it
reads and writes real rows instead.

## 1. Create the project

Create a project at [supabase.com](https://supabase.com), then copy the URL and
anon key into `apps/catalog/.env.local`:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Never commit `.env.local`. `VITE_` variables are shipped to the browser, so the
anon key is the only key that belongs there — the service role key must stay on
a server.

## 2. Apply the schema

With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Or paste `migrations/0001_schema.sql` into the SQL editor.

## 3. Authentication settings

The app uses Supabase Auth with email and password. Sign-up writes the role into
user metadata, and the profile rows are created on the first authenticated load
(so it still works when email confirmation is enabled).

While testing, turn off **Authentication → Sign In / Providers → Confirm email**
so a new account can sign in immediately. Turn it back on before launch.

## 4. Seed

`seed.sql` inserts skills, three buyers, five developers, three locked projects
with scope, and their bids.

Profiles reference `auth.users`, so create those auth users first with the same
UUIDs (Authentication → Users, or `supabase auth admin create-user`). Then:

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

## What the schema enforces

| Rule | Where |
|------|-------|
| A buyer cannot post a requirement without paying the $1 (₹99) fee | `enforce_posting_fee()` trigger |
| One posting fee posts exactly one requirement | same trigger, sets `consumed_at` |
| A developer cannot bid without approved identity | `enforce_bid_eligibility()` trigger |
| A developer cannot bid without paying the $11 (₹899) membership | same trigger, checks `bidding_unlocked_at` |
| Bids are only accepted while the requirement is locked | same trigger |
| Every bid must accept the locked scope | same trigger |
| Paying the membership unlocks bidding | `apply_membership_payment()` trigger |
| Locking a requirement freezes an immutable scope snapshot | `snapshot_contract_scope()` trigger |
| Draft requirements stay private to their buyer | `projects_read` policy |
| A developer sees only their own bid, the buyer sees all | `bids_visibility` policy |

The paywall lives in the database, not only in the interface, so it holds even
if someone calls the API directly.

## Storage buckets

Create three private buckets:

| Bucket | Contents |
|--------|----------|
| `identity-documents` | Government ID scans and selfies |
| `interview-recordings` | Screen recordings from build interviews |
| `deliverables` | Files attached to milestone submissions |
