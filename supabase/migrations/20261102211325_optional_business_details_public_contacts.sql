-- Only name, category and address are required. New public contacts are opt-in;
-- previously private contact emails are not copied into these public fields.
begin;
alter table public.businesses drop constraint businesses_description_check;
alter table public.businesses alter column description set default '';
alter table public.businesses add constraint businesses_description_check check(length(description)<=5000);
alter table public.businesses add constraint businesses_category_nonblank check(length(btrim(category)) between 1 and 100);
alter table public.businesses add constraint businesses_address_nonblank check(length(btrim(address)) between 1 and 300);
alter table public.businesses
  add column public_email text not null default '' check(length(public_email)<=254 and (public_email='' or public_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  add column public_phone text not null default '' check(public_phone='' or (length(public_phone)<=40 and public_phone ~ '^[+]?[0-9() .-]+$' and length(regexp_replace(public_phone,'[^0-9]','','g')) between 7 and 15));
create or replace function private.save_business(details jsonb,bid uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if private.active_role() is distinct from 'business_owner'::public.account_role then
    raise exception 'Business owner required'; end if;
  if bid is null then
    perform private.limit_action('business',3);
    insert into public.businesses(name,description,category,address,operating_details,public_email,public_phone)
      values(btrim(details->>'name'),coalesce(details->>'description',''),btrim(details->>'category'),btrim(details->>'address'),
        coalesce(details->>'operating_details',''),coalesce(details->>'public_email',''),coalesce(details->>'public_phone','')) returning id into result;
    insert into public.business_members(business_id,user_id) values(result,auth.uid());
  else
    if not private.is_member(bid) then raise exception 'Not authorized'; end if;
    result := bid;
    update public.businesses set name=btrim(details->>'name'),description=coalesce(details->>'description',''),
      category=btrim(details->>'category'),address=btrim(details->>'address'),
      operating_details=coalesce(details->>'operating_details',''),
      public_email=case when details ? 'public_email' then coalesce(details->>'public_email','') else public_email end,
      public_phone=case when details ? 'public_phone' then coalesce(details->>'public_phone','') else public_phone end where id=bid;
  end if;
  if details ? 'contact_email' then
  insert into public.business_contacts(business_id,contact_email) values(result,coalesce(details->>'contact_email',''))
    on conflict(business_id) do update set contact_email=excluded.contact_email;
  end if;
  return result;
end $$;
notify pgrst, 'reload schema';
commit;
