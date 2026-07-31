-- Okavo seed data.
-- Profiles reference auth.users, so create the auth users first (locally the
-- Supabase CLI seeds them, or use the dashboard) and reuse the same UUIDs.

insert into skills (id, slug, label) values
  ('11111111-1111-4111-8111-000000000001', 'react', 'React'),
  ('11111111-1111-4111-8111-000000000002', 'node', 'Node'),
  ('11111111-1111-4111-8111-000000000003', 'postgres', 'Postgres'),
  ('11111111-1111-4111-8111-000000000004', 'stripe', 'Stripe'),
  ('11111111-1111-4111-8111-000000000005', 'python', 'Python'),
  ('11111111-1111-4111-8111-000000000006', 'rag', 'Retrieval augmented generation'),
  ('11111111-1111-4111-8111-000000000007', 'nextjs', 'Next.js'),
  ('11111111-1111-4111-8111-000000000008', 'security', 'Application security')
on conflict (slug) do nothing;

-- Buyers -------------------------------------------------------------------

insert into profiles (id, role, full_name, email, country_code) values
  ('22222222-2222-4222-8222-000000000001', 'buyer', 'Priya Rao', 'priya@rosestreet.example', 'GB'),
  ('22222222-2222-4222-8222-000000000002', 'buyer', 'Daniel Okafor', 'daniel@northline.example', 'US'),
  ('22222222-2222-4222-8222-000000000003', 'buyer', 'Helena Vogt', 'helena@meridian.example', 'DE')
on conflict (id) do nothing;

insert into buyer_profiles (profile_id, organization_name, scale, billing_email) values
  ('22222222-2222-4222-8222-000000000001', 'Rose Street Bakery', 'local_business', 'accounts@rosestreet.example'),
  ('22222222-2222-4222-8222-000000000002', 'Northline Labs', 'startup', 'ap@northline.example'),
  ('22222222-2222-4222-8222-000000000003', 'Meridian Insurance', 'enterprise', 'procurement@meridian.example')
on conflict (profile_id) do nothing;

-- Developers ---------------------------------------------------------------

insert into profiles (id, role, full_name, email, country_code) values
  ('33333333-3333-4333-8333-000000000001', 'developer', 'Maya Chen', 'maya@builders.example', 'SG'),
  ('33333333-3333-4333-8333-000000000002', 'developer', 'Arjun Mehta', 'arjun@builders.example', 'IN'),
  ('33333333-3333-4333-8333-000000000003', 'developer', 'Sofia Alvarez', 'sofia@builders.example', 'ES'),
  ('33333333-3333-4333-8333-000000000004', 'developer', 'Noah Okonkwo', 'noah@builders.example', 'NG'),
  ('33333333-3333-4333-8333-000000000005', 'developer', 'Lena Fischer', 'lena@builders.example', 'DE')
on conflict (id) do nothing;

insert into developer_profiles (
  profile_id, headline, hourly_rate_usd, tier, identity_status, interview_status,
  bidding_unlocked_at, contracts_delivered, first_pass_acceptance
) values
  ('33333333-3333-4333-8333-000000000001', 'End-to-end product engineer, payments and auth', 68, 'principal', 'approved', 'approved', now() - interval '200 days', 38, 94.0),
  ('33333333-3333-4333-8333-000000000002', 'Ships locked scopes in two to four weeks', 44, 'verified', 'approved', 'approved', now() - interval '120 days', 27, 92.0),
  ('33333333-3333-4333-8333-000000000003', 'AI features that survive production', 72, 'principal', 'approved', 'approved', now() - interval '90 days', 19, 96.0),
  ('33333333-3333-4333-8333-000000000004', 'Pixel-faithful builds from approved screens', 51, 'verified', 'approved', 'approved', now() - interval '60 days', 41, 89.0),
  -- Applicant who has not paid the bidding membership yet.
  ('33333333-3333-4333-8333-000000000005', 'Data-heavy internal tools and dashboards', 79, 'applicant', 'approved', 'submitted', null, 0, null)
on conflict (profile_id) do nothing;

insert into payments (profile_id, purpose, status, amount_cents, provider_reference, paid_at) values
  ('33333333-3333-4333-8333-000000000001', 'bidding_membership', 'paid', 1000, 'pi_seed_maya', now() - interval '200 days'),
  ('33333333-3333-4333-8333-000000000002', 'bidding_membership', 'paid', 1000, 'pi_seed_arjun', now() - interval '120 days'),
  ('33333333-3333-4333-8333-000000000003', 'bidding_membership', 'paid', 1000, 'pi_seed_sofia', now() - interval '90 days'),
  ('33333333-3333-4333-8333-000000000004', 'bidding_membership', 'paid', 1000, 'pi_seed_noah', now() - interval '60 days');

insert into interview_assessments (
  developer_id, status, brief_slug, repo_url, live_url, duration_minutes,
  score_security, score_efficiency, score_maintainability, score_recovery, score_overall, reviewed_at
) values
  ('33333333-3333-4333-8333-000000000002', 'approved', 'ops-microsystem', 'https://github.com/example/sample', 'https://sample.example', 232, 88, 84, 91, 79, 86, now() - interval '120 days');

-- Projects -----------------------------------------------------------------

-- Each requirement consumes one paid posting fee, so seed one per buyer.
insert into payments (profile_id, purpose, status, amount_cents, provider_reference, paid_at) values
  ('22222222-2222-4222-8222-000000000001', 'requirement_posting', 'paid', 100, 'pi_seed_post_rose', now() - interval '7 hours'),
  ('22222222-2222-4222-8222-000000000002', 'requirement_posting', 'paid', 100, 'pi_seed_post_northline', now() - interval '3 hours'),
  ('22222222-2222-4222-8222-000000000003', 'requirement_posting', 'paid', 100, 'pi_seed_post_meridian', now() - interval '2 days');

insert into projects (
  id, buyer_id, title, category, outcome_statement, stage,
  budget_min_cents, budget_max_cents, monthly_run_cents, timeline_weeks, published_at
) values
  (
    '44444444-4444-4444-8444-000000000001',
    '22222222-2222-4222-8222-000000000002',
    'Customer portal with subscription billing',
    'Web application',
    'Our customers should log in, see their invoices, update payment methods and download usage reports without emailing support.',
    'locked', 900000, 1400000, 24000, 7, now() - interval '2 hours'
  ),
  (
    '44444444-4444-4444-8444-000000000002',
    '22222222-2222-4222-8222-000000000001',
    'Online ordering for a two-location bakery',
    'Online store',
    'Customers order cakes online, pick a pickup slot and pay. I get one screen showing today''s orders.',
    'locked', 220000, 380000, 6000, 4, now() - interval '6 hours'
  ),
  (
    '44444444-4444-4444-8444-000000000003',
    '22222222-2222-4222-8222-000000000003',
    'Internal claims triage tool',
    'Internal tool',
    'Claims staff should see incoming claims ranked by risk, open one and record a decision with an audit trail.',
    'locked', 4000000, 6500000, 140000, 14, now() - interval '1 day'
  )
on conflict (id) do nothing;

insert into scope_items (project_id, label, detail, included, position) values
  ('44444444-4444-4444-8444-000000000001', 'Customer sign-in and account', 'Email and SSO login, password reset, profile settings.', true, 1),
  ('44444444-4444-4444-8444-000000000001', 'Invoice history and downloads', 'List of invoices with PDF download and payment status.', true, 2),
  ('44444444-4444-4444-8444-000000000001', 'Payment method management', 'Add, remove and set default card.', true, 3),
  ('44444444-4444-4444-8444-000000000001', 'Usage reports export', 'CSV export filtered by date range.', true, 4),
  ('44444444-4444-4444-8444-000000000001', 'Native mobile app', 'Explicitly excluded from this contract.', false, 5),
  ('44444444-4444-4444-8444-000000000002', 'Product catalogue with photos', 'Cakes and pastries with price and description.', true, 1),
  ('44444444-4444-4444-8444-000000000002', 'Pickup slot selection', 'Customer chooses a date and time window per location.', true, 2),
  ('44444444-4444-4444-8444-000000000002', 'Card payment at checkout', 'Single payment provider, no split payments.', true, 3),
  ('44444444-4444-4444-8444-000000000002', 'Owner order screen', 'Today''s orders with status toggle, works on a phone.', true, 4),
  ('44444444-4444-4444-8444-000000000002', 'Delivery and courier tracking', 'Not in this contract. Pickup only.', false, 5),
  ('44444444-4444-4444-8444-000000000003', 'SSO with corporate identity provider', 'SAML integration, role mapping for three roles.', true, 1),
  ('44444444-4444-4444-8444-000000000003', 'Claim queue with risk ranking', 'Sortable queue, filters, assignment to reviewer.', true, 2),
  ('44444444-4444-4444-8444-000000000003', 'Decision recording with audit trail', 'Immutable log of who decided what and when.', true, 3),
  ('44444444-4444-4444-8444-000000000003', 'Data residency in EU region', 'All storage and processing inside the EU.', true, 4),
  ('44444444-4444-4444-8444-000000000003', 'Replacing the core policy system', 'Out of scope. Read-only integration only.', false, 5);

insert into contracts (
  id, project_id, buyer_id, lock_reference, status, agreed_monthly_cents,
  agreed_weeks, locked_at, buyer_signed_at
) values
  ('55555555-5555-4555-8555-000000000001', '44444444-4444-4444-8444-000000000001', '22222222-2222-4222-8222-000000000002', 'LOCK-4F2A91', 'locked', 24000, 7, now() - interval '2 hours', now() - interval '2 hours'),
  ('55555555-5555-4555-8555-000000000002', '44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000001', 'LOCK-77C0B4', 'locked', 6000, 4, now() - interval '6 hours', now() - interval '6 hours'),
  ('55555555-5555-4555-8555-000000000003', '44444444-4444-4444-8444-000000000003', '22222222-2222-4222-8222-000000000003', 'LOCK-1B93EE', 'locked', 140000, 14, now() - interval '1 day', now() - interval '1 day')
on conflict (id) do nothing;

insert into bids (project_id, developer_id, status, amount_cents, monthly_run_cents, delivery_weeks, message, accepts_locked_scope) values
  ('44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000001', 'shortlisted', 1250000, 22000, 6, 'I have shipped this exact billing surface four times. Fixed price against your locked scope.', true),
  ('44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000002', 'submitted', 940000, 18000, 7, 'Can start Monday. Weekly demo against each locked scope item.', true),
  ('44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000004', 'submitted', 290000, 5500, 3, 'Mobile-first build. You will be able to run the whole shop from your phone.', true),
  ('44444444-4444-4444-8444-000000000003', '33333333-3333-4333-8333-000000000003', 'submitted', 6100000, 145000, 14, 'Risk ranking plus the review workflow, evaluated weekly.', true);
