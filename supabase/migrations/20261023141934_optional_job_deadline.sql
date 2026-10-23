-- A null deadline accepts applications while the verified business keeps the job published.
-- Existing dates retain the same inclusive expiry rule.
alter table public.jobs alter column deadline drop not null;

create or replace function private.validate_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (
    (new.deadline is not null and new.deadline < current_date)
    or not exists (select 1 from public.businesses b where b.id = new.business_id and b.verification_status = 'verified')
  ) then raise exception 'Publishing requires a verified business and a deadline that is blank or current'; end if;
  return new;
end $$;

alter policy job_read on public.jobs using (
  (status = 'published' and (deadline is null or deadline >= current_date)
    and exists (select 1 from public.businesses b where b.id = business_id and b.verification_status = 'verified'))
  or private.is_member(business_id) or (select private.is_admin())
);

create or replace function private.application_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.active_role() <> 'jobseeker' or new.applicant_id <> auth.uid() or new.status <> 'Submitted'
    then raise exception 'Invalid applicant'; end if;
  if not exists (
    select 1 from public.jobs j join public.businesses b on b.id = j.business_id
    where j.id = new.job_id and j.status = 'published'
      and (j.deadline is null or j.deadline >= current_date) and b.verification_status = 'verified'
  ) then raise exception 'Job is not accepting applications'; end if;
  if split_part(new.cv_path,'/',1) <> auth.uid()::text or not exists (
    select 1 from storage.objects where bucket_id = 'cvs' and name = new.cv_path
  ) then raise exception 'Upload a CV owned by the applicant'; end if;
  perform private.limit_action('application',30);
  return new;
end $$;

create or replace function public.search_jobs(keyword text default '',employment text default '',work_mode text default '',place text default '',sort_by text default 'newest',page_number integer default 1)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select j.*, b.name as company from public.jobs j join public.businesses b on b.id = j.business_id
    where j.status = 'published' and (j.deadline is null or j.deadline >= current_date) and b.verification_status = 'verified'
      and (keyword = '' or (j.title || ' ' || j.description || ' ' || j.location || ' ' || b.name) ilike '%' || left(keyword,150) || '%')
      and (employment = '' or j.employment_type = employment) and (work_mode = '' or j.arrangement = work_mode)
      and (place = '' or j.location ilike '%' || left(place,150) || '%')
  ), paged as (
    select * from filtered order by case when sort_by = 'salary' then salary_max end desc nulls last, created_at desc, id
    limit 8 offset (greatest(1,least(page_number,100000)) - 1) * 8
  )
  select jsonb_build_object('jobs',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb),'total',(select count(*) from filtered))
$$;
