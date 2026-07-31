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
