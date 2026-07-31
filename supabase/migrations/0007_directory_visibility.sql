-- Make the marketplace legible.
--
-- `profiles` and `buyer_profiles` were readable only by their owner, so a
-- developer browsing the board saw every client as "Buyer" and a buyer
-- comparing four bids saw four developers all called "Developer".
--
-- Signed-in users may now read the parts of a profile the marketplace is
-- built on — who you are, where you are, which company posted the work —
-- while contact and billing details stay private via column grants.

-- ---------------------------------------------------------------------------
-- profiles: name and country are public to signed-in users, email is not
-- ---------------------------------------------------------------------------

drop policy if exists profiles_self_read on profiles;
drop policy if exists profiles_directory_read on profiles;

create policy profiles_directory_read on profiles
  for select to authenticated using (true);

revoke select on profiles from authenticated;
grant select (
  id, role, full_name, avatar_url, country_code, timezone, created_at, updated_at
) on profiles to authenticated;

-- ---------------------------------------------------------------------------
-- buyer_profiles: the trading name is public, billing details are not
-- ---------------------------------------------------------------------------

drop policy if exists buyer_read on buyer_profiles;
drop policy if exists buyer_directory_read on buyer_profiles;

create policy buyer_directory_read on buyer_profiles
  for select to authenticated using (true);

revoke select on buyer_profiles from authenticated;
grant select (
  profile_id, organization_name, scale, website, created_at, updated_at
) on buyer_profiles to authenticated;
