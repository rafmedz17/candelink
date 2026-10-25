-- Blocked accounts cannot discover or open the public profile of their blocker.
-- Enforced in the database, including direct RPC calls and search pagination.
begin;
-- Keep the safe public projection, excluding the caller before counting/paging.
-- IS DISTINCT FROM preserves anonymous discovery when auth.uid() is null.
create or replace function private.search_people(keyword text, page_number integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  with filtered as (
    select p.id, p.full_name, p.headline, p.location, p.avatar_path
    from public.profiles p
    where p.public_profile and not p.suspended and p.role = 'jobseeker'
      and p.id is distinct from (select auth.uid())
      and not exists(select 1 from private.user_blocks b
        where b.blocker_id=p.id and b.blocked_id=(select auth.uid()))
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

create or replace function private.public_profile(profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'headline', p.headline,
    'location', p.location,
    'introduction', p.introduction,
    'skills', p.skills,
    'education', p.education,
    'experience', p.experience,
    'avatar_path', p.avatar_path,
    'updated_at', p.updated_at
  )
  from public.profiles p
  where p.id = profile_id
    and p.role = 'jobseeker'::public.account_role
    and p.public_profile = true
    and not exists(select 1 from private.user_blocks b
      where b.blocker_id=p.id and b.blocked_id=(select auth.uid()))
$$;


notify pgrst, 'reload schema';
commit;
