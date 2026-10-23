-- Public professional profiles are opt-in. The underlying profiles table remains
-- private because it also holds sensitive paths such as the applicant's CV.
alter table public.profiles
  add column if not exists public_profile boolean not null default false;

grant update(public_profile) on public.profiles to authenticated;

-- Return only information intended for a public professional profile. Keep this
-- as a small, explicit allow-list rather than broadening profile table RLS.
create function private.public_profile(profile_id uuid)
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
$$;

create function public.get_public_profile(profile_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.public_profile(profile_id)
$$;

revoke all on function private.public_profile(uuid) from public, anon, authenticated;
grant execute on function private.public_profile(uuid) to anon, authenticated;
revoke all on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
