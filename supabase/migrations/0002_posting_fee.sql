-- Buyer-side posting fee.
--
-- Only needed if 0001_schema.sql was applied before the posting fee existed.
-- On a fresh database 0001 already contains everything here, and running this
-- file is a harmless no-op.

alter type payment_purpose add value if not exists 'requirement_posting';

alter table payments add column if not exists project_id uuid;
alter table payments add column if not exists consumed_at timestamptz;

create index if not exists payments_unconsumed_idx on payments (profile_id, purpose)
  where consumed_at is null;

create or replace function enforce_posting_fee()
returns trigger
language plpgsql
as $$
declare
  fee_id uuid;
begin
  select id into fee_id
  from payments
  where profile_id = new.buyer_id
    and purpose = 'requirement_posting'
    and status = 'paid'
    and consumed_at is null
  order by created_at
  limit 1;

  if fee_id is null then
    raise exception 'A posting fee must be paid before creating a requirement';
  end if;

  update payments
    set consumed_at = now(), project_id = new.id
    where id = fee_id;

  return new;
end;
$$;

drop trigger if exists projects_posting_fee on projects;

create trigger projects_posting_fee before insert on projects
  for each row execute function enforce_posting_fee();
