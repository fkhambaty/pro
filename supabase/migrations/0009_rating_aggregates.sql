-- Ratings must be computed over every contract, not just the ones the reader
-- can see.
--
-- `developer_directory` ran as the caller, so a buyer counting a developer's
-- delivered contracts saw only their own — every developer read "0 contracts
-- delivered". Review history had the same problem: the project title and the
-- client name came back empty because the underlying contract was invisible.
--
-- Both views now run as owner and expose aggregates and published review text
-- only. No contract contents, no contact details, no money.

drop view if exists developer_directory;

create view developer_directory
with (security_invoker = false)
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
-- Published review history
-- ---------------------------------------------------------------------------

drop view if exists developer_reviews;

create view developer_reviews
with (security_invoker = false)
as
select
  r.id,
  r.subject_id,
  r.rating,
  r.score_scope,
  r.score_quality,
  r.score_communication,
  r.score_timeliness,
  r.matched_expectation,
  r.comment,
  r.created_at,
  pr.title as project_title,
  bp.organization_name as buyer_org
from reviews r
join contracts c on c.id = r.contract_id
join projects pr on pr.id = c.project_id
join buyer_profiles bp on bp.profile_id = c.buyer_id
-- Only reviews written about the developer by their client are public.
where r.subject_id = c.developer_id;

grant select on developer_reviews to authenticated;
