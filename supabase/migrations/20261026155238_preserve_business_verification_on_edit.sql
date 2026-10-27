-- Ordinary profile edits preserve the administrator's verification decision
-- and never close a business's published jobs.
begin;
create or replace function private.save_business(details jsonb,bid uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if private.active_role() is distinct from 'business_owner'::public.account_role then
    raise exception 'Business owner required'; end if;
  if bid is null then
    perform private.limit_action('business',3);
    insert into public.businesses(name,description,category,address,operating_details)
      values(details->>'name',details->>'description',details->>'category',details->>'address',
        coalesce(details->>'operating_details','')) returning id into result;
    insert into public.business_members(business_id,user_id) values(result,auth.uid());
  else
    if not private.is_member(bid) then raise exception 'Not authorized'; end if;
    result := bid;
    update public.businesses set name=details->>'name',description=details->>'description',
      category=details->>'category',address=details->>'address',
      operating_details=coalesce(details->>'operating_details','') where id=bid;
  end if;
  insert into public.business_contacts(business_id,contact_email) values(result,details->>'contact_email')
    on conflict(business_id) do update set contact_email=excluded.contact_email;
  return result;
end $$;
notify pgrst, 'reload schema';
commit;
