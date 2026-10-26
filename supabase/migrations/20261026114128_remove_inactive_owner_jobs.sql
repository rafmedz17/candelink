-- Remove jobs when a business has no active member left, including legacy orphans.
-- Applications and their notes belong to the deleted jobs; CV files remain owned
-- by their applicants. Restoring an account never recreates deleted jobs.
begin;
create function private.remove_inactive_business_jobs(bid uuid, excluded_user uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  perform 1 from public.businesses where id=bid for update;
  if not found then return 0; end if;
  if exists(select 1 from public.business_members m join public.profiles p on p.id=m.user_id
      where m.business_id=bid and m.user_id is distinct from excluded_user and not p.suspended) then
    return 0;
  end if;
  delete from public.applications a using public.jobs j where a.job_id=j.id and j.business_id=bid;
  delete from public.jobs where business_id=bid;
  get diagnostics removed = row_count;
  return removed;
end $$;

create function private.remove_owner_jobs_on_account_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare affected record;
begin
  if tg_op='UPDATE' then
    if not new.suspended or old.suspended then return new; end if;
  end if;
  for affected in select business_id from public.business_members where user_id=old.id order by business_id loop
    perform private.remove_inactive_business_jobs(affected.business_id,old.id);
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger remove_owner_jobs_on_account_change
before delete or update of suspended on public.profiles
for each row execute function private.remove_owner_jobs_on_account_change();

create function private.remove_owner_jobs_on_membership_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.remove_inactive_business_jobs(old.business_id);
  return old;
end $$;
create trigger remove_owner_jobs_on_membership_change
after delete or update of user_id,business_id on public.business_members
for each row execute function private.remove_owner_jobs_on_membership_change();

revoke all on function private.remove_inactive_business_jobs(uuid,uuid),
  private.remove_owner_jobs_on_account_change(),private.remove_owner_jobs_on_membership_change()
  from public,anon,authenticated;

-- One-time cleanup covers jobs left behind before these triggers existed.
do $$
declare affected record;
begin
  for affected in select distinct business_id from public.jobs order by business_id loop
    perform private.remove_inactive_business_jobs(affected.business_id);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
