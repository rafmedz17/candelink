-- CANDELINK: reproducible baseline. Application roles never receive service-role credentials.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;
create type public.account_role as enum ('jobseeker','business_owner','admin');
create type public.verification_status as enum ('pending','verified','rejected','suspended');
create type public.job_status as enum ('draft','published','closed','archived');
create type public.application_status as enum ('Submitted','Under Review','Shortlisted','Interview','Accepted','Rejected','Withdrawn');

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 role public.account_role not null default 'jobseeker', suspended boolean not null default false,
 full_name text not null default '' check(length(full_name)<=100), headline text not null default '' check(length(headline)<=150),
 location text not null default 'Candelaria, Quezon', introduction text not null default '' check(length(introduction)<=3000),
 skills text not null default '', education text not null default '', experience text not null default '', avatar_path text, cv_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.businesses (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120),
 description text not null check(length(description) between 20 and 5000), category text not null,
 address text not null, operating_details text not null default '', logo_path text,
 verification_status public.verification_status not null default 'pending', moderation_reason text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_members (
 business_id uuid not null references public.businesses on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 primary key(business_id,user_id), created_at timestamptz not null default now()
);
create table public.business_contacts (
 business_id uuid primary key references public.businesses on delete cascade,
 contact_email text not null check(length(contact_email)<=254)
);
create table public.business_verification_requests (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses on delete cascade,
 requested_by uuid not null references public.profiles, status text not null default 'pending' check(status in ('pending','verified','rejected','suspended')),
 reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_pending_verification on public.business_verification_requests(business_id) where status='pending';
create table public.jobs (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses on delete cascade,
 title text not null check(length(title) between 4 and 150), description text not null check(length(description) between 30 and 15000),
 responsibilities text not null default '', qualifications text not null default '',
 employment_type text not null check(employment_type in ('Full-time','Part-time','Contract','Internship')),
 arrangement text not null check(arrangement in ('On-site','Hybrid','Remote')), location text not null, category text not null,
 salary_min integer check(salary_min>=0), salary_max integer check(salary_max>=salary_min), vacancies integer not null default 1 check(vacancies between 1 and 1000),
 deadline date not null, status public.job_status not null default 'draft',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.applications (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.jobs on delete restrict,
 applicant_id uuid not null references public.profiles on delete cascade,
 status public.application_status not null default 'Submitted', cover_letter text not null default '' check(length(cover_letter)<=6000),
 cv_path text not null check(length(cv_path)<=500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(job_id,applicant_id)
);
create table public.applicant_notes (
 application_id uuid primary key references public.applications on delete cascade,
 author_id uuid not null references public.profiles, note text not null check(length(note)<=6000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.saved_jobs (
 user_id uuid not null references public.profiles on delete cascade, job_id uuid not null references public.jobs on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,job_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 title text not null,body text not null,read boolean not null default false,created_at timestamptz not null default now()
);
create table public.reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles,
 subject_type text not null check(subject_type in ('user','business','job')),subject_id uuid not null,
 reason text not null check(length(reason) between 10 and 3000),status text not null default 'pending' check(status in ('pending','resolved','dismissed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.profiles,
 action text not null,target_type text not null,target_id uuid not null,reason text not null,created_at timestamptz not null default now()
);
create table private.rate_limits(user_id uuid not null,operation text not null,window_start date not null default current_date,requests integer not null default 1, primary key(user_id,operation,window_start));
alter table private.rate_limits enable row level security;

create index business_members_user on public.business_members(user_id,business_id);
create index verification_business on public.business_verification_requests(business_id);
create index verification_user on public.business_verification_requests(requested_by);
create index jobs_business on public.jobs(business_id);
create index jobs_discovery on public.jobs(status,created_at desc);
create index jobs_filters on public.jobs(employment_type,arrangement,location);
create index jobs_search on public.jobs using gin(to_tsvector('english',title || ' ' || description || ' ' || location));
create index applications_applicant on public.applications(applicant_id,created_at desc);
create index applications_job on public.applications(job_id,status);
create index notes_author on public.applicant_notes(author_id);
create index bookmarks_job on public.saved_jobs(job_id);
create index notifications_user on public.notifications(user_id,created_at desc);
create index reports_reporter on public.reports(reporter_id);
create index reports_status on public.reports(status,created_at desc);
create index audit_actor on public.audit_logs(actor_id);

-- Helpers are deliberately in a non-exposed schema with a fixed search path.
create function private.active_role() returns public.account_role language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=(select auth.uid()) and not suspended
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(private.active_role()='admin',false) $$;
create function private.is_member(bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.active_role()='business_owner' and exists(select 1 from public.business_members where business_id=bid and user_id=(select auth.uid()))
$$;
create function private.owns_application(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id where a.id=aid and private.is_member(j.business_id))
$$;
create function private.can_view_profile(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id where a.applicant_id=uid and private.is_member(j.business_id))
$$;
create function private.limit_action(op text, maximum integer) returns void language plpgsql security definer set search_path='' as $$
 declare n integer;
 begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into private.rate_limits(user_id,operation) values(auth.uid(),op)
 on conflict(user_id,operation,window_start) do update set requests=private.rate_limits.requests+1 returning requests into n;
 if n>maximum then raise exception 'Daily action limit reached'; end if;
 end $$;
create function private.touch() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.profiles(id,full_name,role) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100),case when new.raw_user_meta_data->>'account_type'='business_owner' then 'business_owner'::public.account_role else 'jobseeker'::public.account_role end);return new;end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_user();
do $$declare t text;begin foreach t in array array['profiles','businesses','business_verification_requests','jobs','applications','applicant_notes','reports'] loop execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch()',t);end loop;end$$;

create function private.validate_job() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status='published' and (new.deadline<current_date or not exists(select 1 from public.businesses b where b.id=new.business_id and b.verification_status='verified')) then raise exception 'Publishing requires a verified business and a current deadline';end if;return new;end$$;
create trigger valid_job before insert or update on public.jobs for each row execute function private.validate_job();
create function private.application_insert() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if private.active_role()<>'jobseeker' or new.applicant_id<>auth.uid() or new.status<>'Submitted' then raise exception 'Invalid applicant';end if;
 if not exists(select 1 from public.jobs j join public.businesses b on b.id=j.business_id where j.id=new.job_id and j.status='published' and j.deadline>=current_date and b.verification_status='verified') then raise exception 'Job is not accepting applications';end if;
 if split_part(new.cv_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='cvs' and name=new.cv_path) then raise exception 'Upload a CV owned by the applicant';end if;
 perform private.limit_action('application',30);return new;end$$;
create trigger valid_application before insert on public.applications for each row execute function private.application_insert();
create function private.application_notify() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then insert into public.notifications(user_id,title,body) select m.user_id,'A new local connection','A new application was submitted for '||j.title from public.jobs j join public.business_members m on m.business_id=j.business_id where j.id=new.job_id;
 elsif new.status<>old.status then insert into public.notifications(user_id,title,body) values(new.applicant_id,'Your application has an update','Your application is now: '||new.status);end if;return new;end$$;
create trigger application_notifications after insert or update on public.applications for each row execute function private.application_notify();

-- Explicit privileges: editable profile columns exclude role and suspension.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.businesses,public.jobs to anon,authenticated;
grant select on public.profiles,public.business_members,public.business_contacts,public.business_verification_requests,public.applications,public.applicant_notes,public.saved_jobs,public.notifications,public.reports,public.audit_logs to authenticated;
grant update(full_name,headline,location,introduction,skills,education,experience,avatar_path,cv_path) on public.profiles to authenticated;
grant insert on public.jobs,public.applications,public.saved_jobs,public.business_verification_requests,public.reports,public.applicant_notes to authenticated;
grant update(title,description,responsibilities,qualifications,employment_type,arrangement,location,category,salary_min,salary_max,vacancies,deadline,status) on public.jobs to authenticated;
grant update(note,author_id) on public.applicant_notes to authenticated;
grant update(read) on public.notifications to authenticated;
grant delete on public.saved_jobs to authenticated;
do $$declare t text;begin foreach t in array array['profiles','businesses','business_members','business_contacts','business_verification_requests','jobs','applications','applicant_notes','saved_jobs','notifications','reports','audit_logs'] loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_admin()) or private.can_view_profile(id));
create policy profile_edit on public.profiles for update to authenticated using(id=(select auth.uid()) and private.active_role() is not null) with check(id=(select auth.uid()) and private.active_role() is not null);
create policy business_read on public.businesses for select to anon,authenticated using(verification_status='verified' or private.is_member(id) or (select private.is_admin()));
create policy members_read on public.business_members for select to authenticated using(user_id=(select auth.uid()) or private.is_member(business_id) or (select private.is_admin()));
create policy contacts_read on public.business_contacts for select to authenticated using(private.is_member(business_id) or (select private.is_admin()));
create policy verification_read on public.business_verification_requests for select to authenticated using(private.is_member(business_id) or (select private.is_admin()));
create policy verification_insert on public.business_verification_requests for insert to authenticated with check(requested_by=(select auth.uid()) and status='pending' and reason is null and private.is_member(business_id));
create policy job_read on public.jobs for select to anon,authenticated using((status='published' and deadline>=current_date and exists(select 1 from public.businesses b where b.id=business_id and b.verification_status='verified')) or private.is_member(business_id) or (select private.is_admin()));
create policy job_insert on public.jobs for insert to authenticated with check(private.is_member(business_id));
create policy job_edit on public.jobs for update to authenticated using(private.is_member(business_id)) with check(private.is_member(business_id));
create policy applications_read on public.applications for select to authenticated using((applicant_id=(select auth.uid()) and private.active_role()='jobseeker') or private.owns_application(id) or (select private.is_admin()));
create policy applications_insert on public.applications for insert to authenticated with check(applicant_id=(select auth.uid()) and private.active_role()='jobseeker' and status='Submitted');
create policy notes_read on public.applicant_notes for select to authenticated using(private.owns_application(application_id));
create policy notes_insert on public.applicant_notes for insert to authenticated with check(private.owns_application(application_id) and author_id=(select auth.uid()));
create policy notes_update on public.applicant_notes for update to authenticated using(private.owns_application(application_id)) with check(private.owns_application(application_id) and author_id=(select auth.uid()));
create policy saved_read on public.saved_jobs for select to authenticated using(user_id=(select auth.uid()) and private.active_role()='jobseeker');
create policy saved_insert on public.saved_jobs for insert to authenticated with check(user_id=(select auth.uid()) and private.active_role()='jobseeker');
create policy saved_delete on public.saved_jobs for delete to authenticated using(user_id=(select auth.uid()) and private.active_role()='jobseeker');
create policy notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()) and private.active_role() is not null);
create policy notifications_edit on public.notifications for update to authenticated using(user_id=(select auth.uid()) and private.active_role() is not null) with check(user_id=(select auth.uid()));
create policy reports_read on public.reports for select to authenticated using(reporter_id=(select auth.uid()) or (select private.is_admin()));
create policy reports_insert on public.reports for insert to authenticated with check(reporter_id=(select auth.uid()) and status='pending' and private.active_role() is not null);
create policy audit_read on public.audit_logs for select to authenticated using((select private.is_admin()));

-- RPC entry points are invokers. Privileged implementations stay private, validate the caller,
-- and are granted only to authenticated (never anonymous) callers.
create function private.save_business(details jsonb,bid uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare result uuid;begin
 if private.active_role() is distinct from 'business_owner'::public.account_role then raise exception 'Business owner required';end if;
 if bid is null then perform private.limit_action('business',3);
 insert into public.businesses(name,description,category,address,operating_details) values(details->>'name',details->>'description',details->>'category',details->>'address',coalesce(details->>'operating_details','')) returning id into result;
 insert into public.business_members(business_id,user_id) values(result,auth.uid());
 else if not private.is_member(bid) then raise exception 'Not authorized';end if;
 result=bid;update public.businesses set name=details->>'name',description=details->>'description',category=details->>'category',address=details->>'address',operating_details=coalesce(details->>'operating_details',''),verification_status=case when verification_status='verified' then 'pending'::public.verification_status else verification_status end where id=bid;
 update public.jobs set status='closed' where business_id=bid and status='published';end if;
 insert into public.business_contacts(business_id,contact_email) values(result,details->>'contact_email') on conflict(business_id) do update set contact_email=excluded.contact_email;
 return result;end$$;
create function public.create_business(details jsonb) returns uuid language sql security invoker set search_path='' as $$select private.save_business(details)$$;
create function public.update_business(details jsonb,bid uuid) returns uuid language sql security invoker set search_path='' as $$select private.save_business(details,bid)$$;
create function private.change_status(application_id uuid,new_status public.application_status) returns void language plpgsql security definer set search_path='' as $$declare a public.applications;begin
 if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized';end if;
 select * into a from public.applications where id=application_id for update;
 if a.id is null then raise exception 'Application not found';end if;
 if a.status in ('Accepted','Rejected','Withdrawn') then raise exception 'Application is final';end if;
 if a.applicant_id=auth.uid() and new_status='Withdrawn' then null;
 elsif private.owns_application(a.id) and new_status in ('Under Review','Shortlisted','Interview','Accepted','Rejected') then null;
 else raise exception 'Not authorized';end if;
 update public.applications set status=new_status where id=a.id;
 end$$;
create function public.change_application_status(application_id uuid,new_status public.application_status) returns void language sql security invoker set search_path='' as $$select private.change_status(application_id,new_status)$$;
create function private.moderate(target_id uuid,target_type text,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.is_admin() or length(reason)<10 then raise exception 'Administrator and reason required';end if;
 if target_type='business' and decision in ('verified','rejected','suspended','pending') then
 update public.businesses set verification_status=decision::public.verification_status,moderation_reason=reason where id=target_id;
 update public.business_verification_requests set status=case when decision='pending' then 'pending' else decision end,reason=moderate.reason where business_id=target_id and status='pending';
 if decision<>'verified' then update public.jobs set status='closed' where business_id=target_id and status='published';end if;
 elsif target_type='user' and decision in ('suspend','restore') and target_id<>auth.uid() then
 update public.profiles set suspended=(decision='suspend') where id=target_id;
 elsif target_type='job' and decision in ('closed','archived') then update public.jobs set status=decision::public.job_status where id=target_id;
 elsif target_type='report' and decision in ('resolved','dismissed') then update public.reports set status=decision where id=target_id;
 else raise exception 'Invalid moderation decision';end if;
 insert into public.audit_logs(actor_id,action,target_type,target_id,reason) values(auth.uid(),decision,target_type,target_id,reason);
 end$$;
create function public.moderate(target_id uuid,target_type text,decision text,reason text) returns void language sql security invoker set search_path='' as $$select private.moderate(target_id,target_type,decision,reason)$$;

-- Private PDF CV bucket. Image bucket uses owner folders and public read for avatar images.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('cvs','cvs',false,5242880,array['application/pdf']),('avatars','avatars',true,5242880,array['image/jpeg','image/png']);
create policy file_insert on storage.objects for insert to authenticated with check(bucket_id in ('cvs','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text and private.active_role() is not null);
create policy cv_read on storage.objects for select to authenticated using(bucket_id='cvs' and private.active_role() is not null and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.applications a where a.cv_path=name and private.owns_application(a.id))));
create policy avatar_read on storage.objects for select to anon,authenticated using(bucket_id='avatars');
create policy file_delete on storage.objects for delete to authenticated using(bucket_id in ('cvs','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text and private.active_role() is not null and not exists(select 1 from public.applications a where a.cv_path=name));

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.active_role(),private.is_admin(),private.is_member(uuid) to anon,authenticated;
grant execute on function private.owns_application(uuid),private.can_view_profile(uuid),private.save_business(jsonb,uuid),private.change_status(uuid,public.application_status),private.moderate(uuid,text,text,text) to authenticated;
revoke all on function public.create_business(jsonb),public.update_business(jsonb,uuid),public.change_application_status(uuid,public.application_status),public.moderate(uuid,text,text,text) from public,anon;
grant execute on function public.create_business(jsonb),public.update_business(jsonb,uuid),public.change_application_status(uuid,public.application_status),public.moderate(uuid,text,text,text) to authenticated;

create function private.limit_insert() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then return new;end if; -- Trusted SQL seed; API inserts still require explicit grants and RLS.
 perform private.limit_action(tg_table_name,case when tg_table_name='reports' then 10 when tg_table_name='jobs' then 20 else 5 end);return new;end$$;
revoke all on function private.limit_insert() from public,anon,authenticated;
create trigger rate_limit_reports before insert on public.reports for each row execute function private.limit_insert();
create trigger rate_limit_jobs before insert on public.jobs for each row execute function private.limit_insert();
create trigger rate_limit_verification before insert on public.business_verification_requests for each row execute function private.limit_insert();

-- Search is an invoker: public discovery still obeys jobs and businesses RLS.
create function public.search_jobs(keyword text default '',employment text default '',work_mode text default '',place text default '',sort_by text default 'newest',page_number integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$
 with filtered as (
 select j.*,b.name as company from public.jobs j join public.businesses b on b.id=j.business_id
 where j.status='published' and j.deadline>=current_date and b.verification_status='verified'
 and (keyword='' or (j.title||' '||j.description||' '||j.location||' '||b.name) ilike '%'||left(keyword,150)||'%')
 and (employment='' or j.employment_type=employment) and (work_mode='' or j.arrangement=work_mode)
 and (place='' or j.location ilike '%'||left(place,150)||'%')
 ), paged as (select * from filtered order by case when sort_by='salary' then salary_max end desc nulls last,created_at desc,id limit 8 offset (greatest(1,least(page_number,100000))-1)*8)
 select jsonb_build_object('jobs',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb),'total',(select count(*) from filtered))
$$;
revoke all on function public.search_jobs(text,text,text,text,text,integer) from public;
grant execute on function public.search_jobs(text,text,text,text,text,integer) to anon,authenticated;
grant update(logo_path) on public.businesses to authenticated;
create policy business_logo_edit on public.businesses for update to authenticated using(private.is_member(id)) with check(private.is_member(id) and split_part(logo_path,'/',1)=(select auth.uid())::text);
