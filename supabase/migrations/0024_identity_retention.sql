-- Identity-document retention and account-erasure workflow.

-- Backfill decisions made before the retention trigger existed.
update identity_verifications
   set expires_at = (reviewed_at + interval '90 days')::date
 where status in ('approved', 'rejected')
   and reviewed_at is not null
   and expires_at is null;

create table if not exists account_erasure_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  admin_note text
);

create unique index if not exists account_erasure_one_open
  on account_erasure_requests(profile_id)
  where status in ('requested', 'processing');
alter table account_erasure_requests enable row level security;
drop policy if exists account_erasure_owner_read on account_erasure_requests;
create policy account_erasure_owner_read on account_erasure_requests
  for select to authenticated using (profile_id = auth.uid() or is_admin());

create or replace function request_account_erasure()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into request_id
    from account_erasure_requests
   where profile_id = auth.uid()
     and status in ('requested', 'processing');
  if request_id is not null then return request_id; end if;

  insert into account_erasure_requests(profile_id)
  values (auth.uid())
  returning id into request_id;

  insert into ops_events(
    severity, category, code, summary, entity_type, entity_id
  ) values (
    'warning', 'privacy', 'account_erasure_requested',
    'An account erasure request needs review',
    'profile', auth.uid()::text
  );
  return request_id;
end;
$$;

revoke all on function request_account_erasure() from public;
grant execute on function request_account_erasure() to authenticated;

-- Called only after the sweep has successfully removed the private objects.
create or replace function redact_identity_paths(p_verification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update identity_verifications
     set document_storage_path = '[purged]',
         selfie_storage_path = case
           when selfie_storage_path is null then null else '[purged]'
         end
   where id = p_verification_id
     and expires_at <= current_date;
end;
$$;

revoke all on function redact_identity_paths(uuid) from public;
grant execute on function redact_identity_paths(uuid) to service_role;

create or replace function complete_identity_erasure(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  erasure account_erasure_requests%rowtype;
begin
  select * into erasure
    from account_erasure_requests
   where id = p_request_id
   for update;
  if not found or erasure.status not in ('requested', 'processing') then
    raise exception 'Erasure request is not open';
  end if;

  update identity_verifications
     set document_storage_path = '[purged]',
         selfie_storage_path = case
           when selfie_storage_path is null then null else '[purged]'
         end
   where developer_id = erasure.profile_id;

  update account_erasure_requests
     set status = 'completed', processed_at = now()
   where id = erasure.id;
end;
$$;

revoke all on function complete_identity_erasure(uuid) from public;
grant execute on function complete_identity_erasure(uuid) to service_role;

comment on table account_erasure_requests is
  'Requests are reviewed before deleting the auth account because legal transaction records may require minimisation rather than blanket deletion.';
