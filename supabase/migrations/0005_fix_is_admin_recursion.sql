-- Fixes infinite recursion in the profiles row level security policy.
--
-- `is_admin()` reads from `profiles`, and the `profiles` select policy calls
-- `is_admin()`. Without SECURITY DEFINER the inner read re-evaluates the same
-- policy, Postgres detects the recursion, and every profile read fails — which
-- means nobody could load their own account.
--
-- SECURITY DEFINER runs the lookup as the function owner with RLS bypassed.
-- The body is a single equality check on auth.uid(), so it cannot leak data,
-- and search_path is pinned so the function cannot be hijacked.

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function is_admin() from public;
grant execute on function is_admin() to authenticated, anon;
