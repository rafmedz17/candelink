-- Private follows; only active jobseekers can follow verified businesses.
begin;
create table private.business_follows (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(business_id,user_id)
);
create index business_follows_user on private.business_follows(user_id);
alter table private.business_follows enable row level security;
revoke all on private.business_follows from public,anon,authenticated;

create table private.business_job_alerts (
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key(job_id,user_id)
);
create index business_job_alerts_user on private.business_job_alerts(user_id);
alter table private.business_job_alerts enable row level security;
revoke all on private.business_job_alerts from public,anon,authenticated;
alter table public.notifications add column job_id uuid references public.jobs(id) on delete set null;
create index notifications_job on public.notifications(job_id) where job_id is not null;

create function private.follow_business(bid uuid, following boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or private.active_role() is distinct from 'jobseeker' then raise exception 'Jobseeker access required'; end if;
  if bid is null or following is null then raise exception 'Invalid follow action'; end if;
  perform 1 from public.businesses where id=bid for key share;
  if not found then raise exception 'Business unavailable'; end if;
  if following then
    if not exists(select 1 from public.businesses where id=bid and verification_status='verified')
        or not exists(select 1 from public.business_members m join public.profiles p on p.id=m.user_id
          where m.business_id=bid and not p.suspended) then raise exception 'Business unavailable'; end if;
    if not exists(select 1 from private.business_follows where business_id=bid and user_id=auth.uid()) then
      perform private.limit_action('business_follow',100);
      insert into private.business_follows(business_id,user_id) values(bid,auth.uid()) on conflict do nothing;
    end if;
  else
    delete from private.business_follows where business_id=bid and user_id=auth.uid();
  end if;
  return following;
end $$;
create function public.follow_business(bid uuid, following boolean) returns boolean
language sql security invoker set search_path='' as $$select private.follow_business(bid,following)$$;
create function private.business_follow_state(bid uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or private.active_role() is distinct from 'jobseeker' then raise exception 'Jobseeker access required'; end if;
  return exists(select 1 from private.business_follows where business_id=bid and user_id=auth.uid());
end $$;
create function public.business_follow_state(bid uuid) returns boolean
language sql stable security invoker set search_path='' as $$select private.business_follow_state(bid)$$;
revoke all on function private.follow_business(uuid,boolean),public.follow_business(uuid,boolean),
  private.business_follow_state(uuid),public.business_follow_state(uuid) from public,anon,authenticated;
grant execute on function private.follow_business(uuid,boolean),public.follow_business(uuid,boolean),
  private.business_follow_state(uuid),public.business_follow_state(uuid) to authenticated;

create function private.notify_business_followers() returns trigger
language plpgsql security definer set search_path='' as $$
declare business_name text;
begin
  if new.status<>'published' then return new; end if;
  if tg_op='UPDATE' then if old.status='published' then return new; end if; end if;
  if new.deadline is not null and new.deadline<current_date then return new; end if;
  select name into business_name from public.businesses where id=new.business_id and verification_status='verified';
  if business_name is null or not exists(select 1 from public.business_members m join public.profiles p on p.id=m.user_id
      where m.business_id=new.business_id and not p.suspended) then return new; end if;
  with delivered as (
    insert into private.business_job_alerts(job_id,user_id)
    select new.id,f.user_id from private.business_follows f join public.profiles p on p.id=f.user_id
      where f.business_id=new.business_id and p.role='jobseeker' and not p.suspended
    on conflict do nothing returning user_id
  )
  insert into public.notifications(user_id,title,body,job_id)
    select user_id,'New opportunity from ' || business_name,
      business_name || ' published ' || new.title || '. View the job to learn more.',new.id from delivered;
  return new;
end $$;
revoke all on function private.notify_business_followers() from public,anon,authenticated;
create trigger notify_business_followers after insert or update of status on public.jobs
for each row execute function private.notify_business_followers();
notify pgrst, 'reload schema';
commit;
