-- Repair cleanup for businesses whose final owner is deleted, even when an
-- earlier membership trigger was missing. Never remove a shared business.
begin;
create or replace function private.remove_orphan_business(bid uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.businesses where id=bid for update;
  if not found or exists(select 1 from public.business_members where business_id=bid) then return false; end if;
  delete from public.applications a using public.jobs j where a.job_id=j.id and j.business_id=bid;
  delete from public.jobs where business_id=bid;
  delete from public.businesses where id=bid;
  return found;
end $$;
create or replace function private.remove_orphan_business_on_member_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.remove_orphan_business(old.business_id);
  return old;
end $$;
drop trigger if exists remove_orphan_business_on_member_change on public.business_members;
create trigger remove_orphan_business_on_member_change
  after delete or update of user_id,business_id on public.business_members
  for each row execute function private.remove_orphan_business_on_member_change();

-- Capture memberships before the profile's cascading FK deletes remove them.
create or replace function private.remove_sole_owner_businesses_before_delete() returns trigger
language plpgsql security definer set search_path='' as $$
declare owned record;
begin
  for owned in select business_id from public.business_members where user_id=old.id order by business_id loop
    perform 1 from public.businesses where id=owned.business_id for update;
    if exists(select 1 from public.business_members where business_id=owned.business_id and user_id<>old.id) then continue; end if;
    delete from public.applications a using public.jobs j where a.job_id=j.id and j.business_id=owned.business_id;
    delete from public.jobs where business_id=owned.business_id;
    delete from public.businesses where id=owned.business_id;
  end loop;
  return old;
end $$;
drop trigger if exists remove_sole_owner_businesses_before_delete on public.profiles;
create trigger remove_sole_owner_businesses_before_delete before delete on public.profiles
  for each row execute function private.remove_sole_owner_businesses_before_delete();
revoke all on function private.remove_orphan_business(uuid),private.remove_orphan_business_on_member_change(),private.remove_sole_owner_businesses_before_delete() from public,anon,authenticated;
-- Remove any legacy businesses whose owner accounts have already been deleted.
do $$
declare orphan record;
begin
  for orphan in select b.id from public.businesses b where not exists(select 1 from public.business_members m where m.business_id=b.id) order by b.id loop
    perform private.remove_orphan_business(orphan.id);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
