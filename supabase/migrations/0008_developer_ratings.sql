-- Developer ratings and reviews.
--
-- A single star rating tells a buyer almost nothing. Okavo's promise is that
-- you get exactly what you locked, so the review asks four questions a buyer
-- can actually answer from the contract, and the overall score is their
-- average — computed by the database, never supplied by the client.

-- ---------------------------------------------------------------------------
-- Four criteria, one derived score
-- ---------------------------------------------------------------------------

alter table reviews
  add column if not exists score_scope integer,
  add column if not exists score_quality integer,
  add column if not exists score_communication integer,
  add column if not exists score_timeliness integer;

-- Backfill anything written before the criteria existed.
update reviews
  set score_scope = coalesce(score_scope, rating),
      score_quality = coalesce(score_quality, rating),
      score_communication = coalesce(score_communication, rating),
      score_timeliness = coalesce(score_timeliness, rating)
  where score_scope is null;

alter table reviews
  alter column score_scope set not null,
  alter column score_quality set not null,
  alter column score_communication set not null,
  alter column score_timeliness set not null;

alter table reviews
  drop constraint if exists reviews_score_scope_check,
  drop constraint if exists reviews_score_quality_check,
  drop constraint if exists reviews_score_communication_check,
  drop constraint if exists reviews_score_timeliness_check;

alter table reviews
  add constraint reviews_score_scope_check check (score_scope between 1 and 5),
  add constraint reviews_score_quality_check check (score_quality between 1 and 5),
  add constraint reviews_score_communication_check check (score_communication between 1 and 5),
  add constraint reviews_score_timeliness_check check (score_timeliness between 1 and 5);

-- `rating` becomes the average of the four criteria. Generated, so a client
-- cannot post a glowing overall score alongside poor criteria.
alter table reviews drop column if exists rating;

alter table reviews
  add column rating numeric(3, 2)
  generated always as (
    (score_scope + score_quality + score_communication + score_timeliness)::numeric / 4
  ) stored;

-- Same reasoning: "matched what was locked" follows from the scope score.
alter table reviews drop column if exists matched_expectation;

alter table reviews
  add column matched_expectation boolean
  generated always as (score_scope >= 4) stored;

create index if not exists reviews_subject_idx on reviews (subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Reviews are public to signed-in users: that is what makes them useful
-- ---------------------------------------------------------------------------

alter table reviews enable row level security;

drop policy if exists reviews_read on reviews;
drop policy if exists reviews_public_read on reviews;
drop policy if exists reviews_author_write on reviews;

create policy reviews_public_read on reviews
  for select to authenticated using (true);

-- Only a party to the contract may review it, and only as themselves.
create policy reviews_author_write on reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from contracts c
      where c.id = contract_id
        and (c.buyer_id = auth.uid() or c.developer_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- One place the app reads a developer's standing from
-- ---------------------------------------------------------------------------

drop view if exists developer_directory;

create view developer_directory
with (security_invoker = true)
as
select
  dp.profile_id,
  p.full_name,
  p.country_code,
  dp.headline,
  dp.hourly_rate_usd,
  dp.tier,
  dp.identity_status,
  dp.bidding_unlocked_at,
  coalesce(stats.review_count, 0)::integer as review_count,
  stats.rating,
  stats.rating_scope,
  stats.rating_quality,
  stats.rating_communication,
  stats.rating_timeliness,
  coalesce(stats.matched_count, 0)::integer as matched_count,
  coalesce(delivery.contracts_delivered, 0)::integer as contracts_delivered
from developer_profiles dp
join profiles p on p.id = dp.profile_id
left join lateral (
  select
    count(*)::integer as review_count,
    round(avg(r.rating), 2) as rating,
    round(avg(r.score_scope), 2) as rating_scope,
    round(avg(r.score_quality), 2) as rating_quality,
    round(avg(r.score_communication), 2) as rating_communication,
    round(avg(r.score_timeliness), 2) as rating_timeliness,
    count(*) filter (where r.matched_expectation)::integer as matched_count
  from reviews r
  where r.subject_id = dp.profile_id
) stats on true
left join lateral (
  select count(*)::integer as contracts_delivered
  from contracts c
  where c.developer_id = dp.profile_id
    and c.status = 'completed'
) delivery on true;

grant select on developer_directory to authenticated;

-- ---------------------------------------------------------------------------
-- Keep the denormalised columns on developer_profiles honest
-- ---------------------------------------------------------------------------

create or replace function refresh_developer_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.subject_id, old.subject_id);
begin
  update developer_profiles d
    set contracts_delivered = (
          select count(*) from contracts c
          where c.developer_id = target and c.status = 'completed'
        ),
        first_pass_acceptance = (
          select round(100.0 * count(*) filter (where r.matched_expectation) /
                       nullif(count(*), 0), 2)
          from reviews r where r.subject_id = target
        )
    where d.profile_id = target;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_developer on reviews;

create trigger reviews_refresh_developer after insert or update or delete on reviews
  for each row execute function refresh_developer_record();
