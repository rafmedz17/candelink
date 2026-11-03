-- Members with an active owner account may manage and delete their businesses.
begin;
create function private.delete_business(bid uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or private.active_role() is distinct from 'business_owner'::public.account_role then
    raise exception 'Business owner required';
  end if;
  perform 1 from public.businesses where id=bid for update;
  if not found or not private.is_member(bid) then raise exception 'Business unavailable'; end if;
  delete from public.applications a using public.jobs j where a.job_id=j.id and j.business_id=bid;
  delete from public.jobs where business_id=bid;
  delete from public.businesses where id=bid;
end $$;
create function public.delete_business(bid uuid) returns void
language sql security invoker set search_path='' as $$select private.delete_business(bid)$$;
revoke all on function private.delete_business(uuid),public.delete_business(uuid) from public,anon,authenticated;
grant execute on function private.delete_business(uuid),public.delete_business(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
