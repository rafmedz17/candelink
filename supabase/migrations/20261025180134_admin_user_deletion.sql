-- Keep historical records when their author is deleted through the Auth API.
begin;
alter table public.audit_logs alter column actor_id drop not null;
alter table public.audit_logs drop constraint audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey foreign key(actor_id) references public.profiles(id) on delete set null;
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey foreign key(reporter_id) references public.profiles(id) on delete set null;
alter table public.applicant_notes alter column author_id drop not null;
alter table public.applicant_notes drop constraint applicant_notes_author_id_fkey;
alter table public.applicant_notes add constraint applicant_notes_author_id_fkey foreign key(author_id) references public.profiles(id) on delete set null;
alter table public.business_verification_requests alter column requested_by drop not null;
alter table public.business_verification_requests drop constraint business_verification_requests_requested_by_fkey;
alter table public.business_verification_requests add constraint business_verification_requests_requested_by_fkey foreign key(requested_by) references public.profiles(id) on delete set null;

create function private.prepare_user_deletion(target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'Administrator access required'; end if;
  if target_user is null or target_user=auth.uid() then raise exception 'You cannot delete your own account'; end if;
  perform 1 from public.profiles where id=target_user for update;
  if not found then raise exception 'Account not found'; end if;
  -- Fail closed if external Storage/Auth cleanup fails; an admin can retry.
  update public.profiles set suspended=true,public_profile=false where id=target_user;
  update public.jobs set status='closed' where status='published' and business_id in (
    select bm.business_id from public.business_members bm where bm.user_id=target_user
      and not exists(select 1 from public.business_members other
        join public.profiles p on p.id=other.user_id
        where other.business_id=bm.business_id and other.user_id<>target_user and not p.suspended)
  );
  update public.businesses set logo_path=null where logo_path like target_user::text || '/%';
  insert into public.audit_logs(actor_id,action,target_type,target_id,reason)
    values(auth.uid(),'delete_requested','user',target_user,'Administrator requested permanent account deletion');
end $$;
create function public.prepare_user_deletion(target_user uuid) returns void
language sql security invoker set search_path='' as $$select private.prepare_user_deletion(target_user)$$;
revoke all on function private.prepare_user_deletion(uuid),public.prepare_user_deletion(uuid) from public,anon,authenticated;
grant execute on function private.prepare_user_deletion(uuid),public.prepare_user_deletion(uuid) to authenticated;

-- Enforce self-protection on direct profile deletes as well as the RPC.
create function private.prevent_self_profile_deletion() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.id=auth.uid() then raise exception 'You cannot delete your own account'; end if;
  return old;
end $$;
revoke all on function private.prevent_self_profile_deletion() from public,anon,authenticated;
create trigger prevent_self_profile_deletion before delete on public.profiles
  for each row execute function private.prevent_self_profile_deletion();
notify pgrst, 'reload schema';
commit;
