-- A bounded, public-safe search projection. Private profile table grants/RLS
-- remain unchanged. Anonymous access is intentional for opted-in profiles only.
create function private.search_people(keyword text, page_number integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  with filtered as (
    select p.id, p.full_name, p.headline, p.location, p.avatar_path
    from public.profiles p
    where p.public_profile and not p.suspended and p.role = 'jobseeker'
      and length(btrim(coalesce(keyword, ''))) >= 2
      and strpos(lower(p.full_name || ' ' || p.headline || ' ' || p.skills),
                 lower(left(btrim(keyword), 100))) > 0
  ), paged as (
    select * from filtered order by lower(full_name), id
    limit 12 offset (greatest(1, least(coalesce(page_number, 1), 1000)) - 1) * 12
  )
  select jsonb_build_object(
    'people', coalesce((select jsonb_agg(to_jsonb(paged) order by lower(full_name), id) from paged), '[]'::jsonb),
    'total', (select count(*) from filtered)
  )
$$;

create function public.search_people(keyword text default '', page_number integer default 1)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.search_people(keyword, page_number)
$$;

revoke all on function private.search_people(text, integer) from public, anon, authenticated;
revoke all on function public.search_people(text, integer) from public, anon, authenticated;
grant execute on function private.search_people(text, integer) to anon, authenticated;
grant execute on function public.search_people(text, integer) to anon, authenticated;
