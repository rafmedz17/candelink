-- Reasons are optional; every moderation action still creates an audit entry.
begin;
create or replace function private.moderate(target_id uuid,target_type text,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.is_admin() then raise exception 'Administrator access required';end if;
 reason := btrim(coalesce(reason,''));
 if length(reason)>2000 then raise exception 'Reason must be at most 2000 characters';end if;
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

notify pgrst, 'reload schema';
commit;
