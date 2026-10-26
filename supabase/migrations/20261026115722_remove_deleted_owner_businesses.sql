-- A business with no remaining members belongs to a deleted owner. Remove the
-- business and its verification/contact records; keep shared or suspended owners.
begin;
create function private.remove_orphan_business(bid uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.businesses where id=bid for update;
  if not found or exists(select 1 from public.business_members where business_id=bid) then
    return false;
  end if;
  perform private.remove_inactive_business_jobs(bid);
  delete from public.businesses where id=bid;
  return found;
end $$;
create function private.remove_orphan_business_on_member_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.remove_orphan_business(old.business_id);
  return old;
end $$;
create trigger remove_orphan_business_on_member_change
after delete or update of user_id,business_id on public.business_members
for each row execute function private.remove_orphan_business_on_member_change();
revoke all on function private.remove_orphan_business(uuid),private.remove_orphan_business_on_member_change()
  from public,anon,authenticated;
do $$
declare orphan record;
begin
  for orphan in select b.id from public.businesses b where not exists(
    select 1 from public.business_members m where m.business_id=b.id) order by b.id loop
    perform private.remove_orphan_business(orphan.id);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
