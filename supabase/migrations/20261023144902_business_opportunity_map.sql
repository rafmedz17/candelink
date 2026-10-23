-- Business locations are public only under the existing businesses/jobs RLS.
alter table public.businesses add column latitude double precision, add column longitude double precision;
alter table public.businesses add constraint businesses_pin_coordinates check (
  (latitude is null and longitude is null) or
  (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
);
create index businesses_pin on public.businesses(latitude, longitude) where latitude is not null and longitude is not null;

-- No direct coordinate UPDATE grant: only active members can save their own pin.
create function private.set_business_location(bid uuid, pin_latitude double precision, pin_longitude double precision) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_member(bid) is distinct from true then raise exception 'Business membership required'; end if;
  if not ((pin_latitude is null and pin_longitude is null) or
    (pin_latitude is not null and pin_longitude is not null and pin_latitude between -90 and 90 and pin_longitude between -180 and 180))
    then raise exception 'Choose valid latitude and longitude together'; end if;
  perform private.limit_action('business_location',60);
  update public.businesses set latitude = pin_latitude, longitude = pin_longitude where id = bid;
end $$;
create function public.set_business_location(bid uuid, pin_latitude double precision, pin_longitude double precision) returns void
language sql security invoker set search_path = '' as $$ select private.set_business_location(bid,pin_latitude,pin_longitude) $$;
revoke all on function private.set_business_location(uuid,double precision,double precision), public.set_business_location(uuid,double precision,double precision) from public, anon, authenticated;
grant execute on function private.set_business_location(uuid,double precision,double precision), public.set_business_location(uuid,double precision,double precision) to authenticated;

-- An invoker projection respects RLS even when a signed-in owner browses the map.
-- Only current, published jobs from verified businesses appear; no contacts/CVs.
create function public.map_opportunities(south double precision, north double precision, west double precision, east double precision, keyword text default '', page_number integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if south is null or north is null or west is null or east is null
    or not (south between -90 and 90 and north between -90 and 90 and west between -180 and 180 and east between -180 and 180 and south < north and west < east)
    then raise exception 'Invalid map bounds'; end if;
  with filtered as (
    select j.id, j.business_id, j.title, j.employment_type, j.arrangement, j.location, j.created_at,
      b.name as company, b.address, b.latitude, b.longitude
    from public.jobs j join public.businesses b on b.id=j.business_id
    where j.status='published' and (j.deadline is null or j.deadline>=current_date) and b.verification_status='verified'
      and b.latitude between south and north and b.longitude between west and east
      and (coalesce(keyword,'')='' or (j.title || ' ' || b.name || ' ' || j.location) ilike '%' || left(keyword,150) || '%')
  ), paged as (
    select * from filtered order by created_at desc,id
    limit 100 offset (greatest(1,least(coalesce(page_number,1),1000))-1)*100
  )
  select jsonb_build_object('opportunities',coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc,id) from paged),'[]'::jsonb),
    'total',(select count(*) from filtered)) into result;
  return result;
end $$;
revoke all on function public.map_opportunities(double precision,double precision,double precision,double precision,text,integer) from public, anon, authenticated;
grant execute on function public.map_opportunities(double precision,double precision,double precision,double precision,text,integer) to anon, authenticated;
