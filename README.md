# Forma

A global marketplace connecting buyers with verified AI developers, where every
requirement is locked into a signed contract before anyone writes code.

**Buyers** range from a single-location bakery to a global insurer. They describe
an outcome in plain language, approve what it means, and freeze scope, build
budget and monthly running cost. **Developers** verify their identity, pass a
recorded build interview, pay a one-time **$10 membership** to unlock bidding,
then compete on identical locked scope.

## Run it

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. The app runs on seeded demo data until Supabase
credentials are present.

| Command | Does |
|---------|------|
| `npm run dev` | Start the marketplace |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |

## Two points of view

Sign in at `/signin` and pick a role. The workspace changes completely.

### Buyer

| Route | Purpose |
|-------|---------|
| `/app` | Overview: requirements, bids, monthly commitments |
| `/app/new` | Five-step guided intake in plain language |
| `/app/project/:id` | Requirement, lock signature, incoming bids, hire |
| `/app/contract/:id` | The contract: scope, milestones, escrow, change orders |
| `/app/contracts` | Every contract and its stage |
| `/app/payments` | Escrow held, released and upcoming |
| `/app/messages` | Conversations with developers |

### Developer

| Route | Purpose |
|-------|---------|
| `/app` | Project board with filters |
| `/app/project/:id` | Locked contract plus the bid form |
| `/app/bids` | Bid pipeline and outcomes |
| `/app/contract/:id` | Submit milestones, raise change orders |
| `/app/earnings` | Payouts, escrow, retainers |
| `/app/verification` | Identity, build interview, **$10 membership** |

## The lifecycle

```
describe → review scope → sign lock → bids open → hire → fund escrow
   → submit milestone → accept against scope → release payment
   → change orders / disputes → review → close
```

Every stage is clickable in the demo.

## The $10 bidding membership

Browsing is free. Bidding is not. The paywall is enforced in two places:

1. **Interface** — the bid form is disabled and points to `/app/verification`.
2. **Database** — the `enforce_bid_eligibility()` trigger rejects any bid from a
   developer without `bidding_unlocked_at` set, so a direct API call fails too.

Paying inserts a `payments` row with purpose `bidding_membership`, and a trigger
unlocks bidding. Swap the demo checkout for Stripe before launch.

## Supabase

Schema, policies, triggers and seed data live in [supabase/](supabase/). See
[supabase/README.md](supabase/README.md) for setup.

Sign-in uses Supabase Auth (email and password). The role you pick at sign-up is
stored in user metadata, and the `profiles` plus `buyer_profiles` or
`developer_profiles` rows are created on first authenticated load. When the
environment variables are missing, the app falls back to demo data and a role
picker, so a fresh clone still runs.

Tables cover profiles, buyer and developer profiles, skills, identity
verifications, interview assessments, payments, projects, scope items,
contracts, immutable contract versions, bids, milestones, deliverables, change
orders, message threads, messages, notifications, disputes, reviews and an audit
log. Row level security is on for every table.

```bash
cp apps/catalog/.env.example apps/catalog/.env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## Repository layout

| Path | Contents |
|------|----------|
| `apps/catalog/` | The marketplace application |
| `supabase/` | Migrations, seed data, setup guide |
| `docs/` | Architecture notes |
| `ops/`, `apps/demo-growth/` | Earlier vertical-studio prototype, no longer part of the build |

## Before going live

- Replace the demo sign-in with Supabase Auth
- Wire the $10 checkout and milestone escrow to Stripe Connect
- Move identity documents and interview recordings into private storage buckets
- Add an admin surface for verification review and dispute resolution
