-- Email dispatch cannot use ALTER DATABASE app.settings via the SQL API.
-- Secrets live in private.okavo_config (service_role / postgres only).
-- Insert notify_secret + notify_user_url once after deploy; never commit values.

create schema if not exists private;

create table if not exists private.okavo_config (
  key text primary key,
  value text not null
);

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;
grant all on all tables in schema private to postgres, service_role;

create or replace function notify_profile(
  target uuid,
  kind notification_kind,
  title text,
  body text,
  link_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  secret text;
  endpoint text;
  request_id bigint;
begin
  if target is null then return; end if;

  insert into notifications (profile_id, kind, title, body, link_path)
  values (target, kind, title, body, link_path)
  returning id into new_id;

  select value into secret from private.okavo_config where key = 'notify_secret';
  select value into endpoint from private.okavo_config where key = 'notify_user_url';
  if secret is null or endpoint is null then
    return;
  end if;

  begin
    select net.http_post(
      url := endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-okavo-notify', secret
      ),
      body := jsonb_build_object(
        'profile_id', target,
        'title', title,
        'body', body,
        'link_path', link_path,
        'cta', 'Open in Okavo'
      )
    ) into request_id;

    update notifications
       set email_dispatched_at = now()
     where id = new_id;
  exception when others then
    raise warning 'notify_profile email dispatch failed: %', sqlerrm;
  end;
end;
$$;

create or replace function invite_builder_to_project(p_project_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row projects%rowtype;
  invite_id uuid;
  token text;
  clean_email text;
  secret text;
  endpoint text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  clean_email := lower(trim(p_email));
  if clean_email is null or position('@' in clean_email) = 0 then
    raise exception 'Enter a valid email address';
  end if;

  select * into project_row from projects where id = p_project_id;
  if not found then
    raise exception 'Project not found';
  end if;

  if project_row.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can invite a builder';
  end if;

  if project_row.stage = 'drafting' then
    raise exception 'Lock the requirement before inviting a builder';
  end if;

  token := encode(gen_random_bytes(24), 'hex');

  insert into project_invites (project_id, invited_by, email, token)
  values (p_project_id, auth.uid(), clean_email, token)
  returning id into invite_id;

  select value into secret from private.okavo_config where key = 'notify_secret';
  select value into endpoint from private.okavo_config where key = 'notify_user_url';

  if secret is not null and endpoint is not null then
    begin
      perform net.http_post(
        url := endpoint,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-okavo-notify', secret
        ),
        body := jsonb_build_object(
          'email', clean_email,
          'title', 'You are invited to bid on a locked Okavo brief',
          'body', 'A buyer locked a software requirement and invited you to review the same frozen scope and bid.',
          'link_path', '/app/project/' || p_project_id || '?invite=' || token,
          'cta', 'Open the locked brief'
        )
      );
    exception when others then
      raise warning 'invite email dispatch failed: %', sqlerrm;
    end;
  end if;

  perform notify_profile(
    auth.uid(),
    'contract',
    'Invite sent',
    'Invitation emailed to ' || clean_email || '.',
    '/app/project/' || p_project_id
  );

  return invite_id;
end;
$$;

-- Hire means "awaiting developer countersign", not delivery.
create or replace function on_bid_awarded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row projects%rowtype;
  buyer_name text;
begin
  if new.status <> 'awarded' or old.status = 'awarded' then
    return null;
  end if;

  select * into project_row from projects where id = new.project_id;
  select organization_name into buyer_name
    from buyer_profiles where profile_id = project_row.buyer_id;

  perform ensure_thread(new.project_id, new.developer_id);

  perform notify_profile(
    new.developer_id,
    'contract',
    'You were hired — countersign the lock',
    coalesce(buyer_name, 'A buyer') || ' hired you for "' || project_row.title ||
      '". Open the contract and countersign the frozen scope before delivery starts.',
    '/app/contract/' || new.project_id
  );

  return null;
end;
$$;

-- Payment attestation only after both parties signed the lock.
create or replace function attest_external_milestone_payment(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_row milestones%rowtype;
  contract_row contracts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into milestone_row
  from milestones
  where id = p_milestone_id
  for update;

  if not found then
    raise exception 'Milestone not found';
  end if;

  if milestone_row.status is distinct from 'pending' then
    raise exception 'Milestone is not awaiting payment confirmation';
  end if;

  select * into contract_row
  from contracts
  where id = milestone_row.contract_id;

  if not found then
    raise exception 'Contract not found';
  end if;

  if contract_row.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can confirm an outside payment';
  end if;

  if contract_row.developer_signed_at is null then
    raise exception 'The developer must countersign the lock before payments can be confirmed';
  end if;

  if exists (
    select 1
    from payments
    where milestone_id = milestone_row.id
      and purpose = 'milestone_funding'
      and status = 'paid'
  ) then
    raise exception 'This milestone is already marked paid';
  end if;

  insert into payments (
    profile_id,
    purpose,
    status,
    amount_cents,
    currency,
    provider,
    provider_reference,
    contract_id,
    milestone_id,
    project_id,
    paid_at
  ) values (
    contract_row.buyer_id,
    'milestone_funding',
    'paid',
    milestone_row.amount_cents,
    'USD',
    'external',
    'external:' || milestone_row.id::text,
    contract_row.id,
    milestone_row.id,
    contract_row.project_id,
    now()
  );

  update milestones
  set status = 'funded',
      funded_at = now()
  where id = milestone_row.id;
end;
$$;

create or replace function resolve_dispute_against_scope(
  p_dispute_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dispute_row disputes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into dispute_row from disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found';
  end if;

  if dispute_row.status like 'resolved%' then
    return;
  end if;

  update disputes
     set status = 'resolved_buyer',
         resolution_note = coalesce(nullif(trim(p_note), ''), 'Resolved against the locked scope.'),
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_dispute_id;

  update contracts
     set status = 'active',
         updated_at = now()
   where id = dispute_row.contract_id
     and status = 'disputed';
end;
$$;

revoke all on function resolve_dispute_against_scope(uuid, text) from public;
grant execute on function resolve_dispute_against_scope(uuid, text) to authenticated;
