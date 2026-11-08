-- Creation and its initial review request are atomic. Existing decisions stay intact.
begin;
create function private.request_business_review(bid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare current_status public.verification_status;
begin
  if auth.uid() is null or not coalesce(private.is_member(bid),false) then raise exception 'Business membership required'; end if;
  select verification_status into current_status from public.businesses where id=bid for update;
  if current_status is null or current_status not in ('pending','rejected') then raise exception 'Business cannot be submitted for review'; end if;
  if exists(select 1 from public.business_verification_requests where business_id=bid and status='pending') then return; end if;
  -- The existing insert trigger applies the verification request rate limit.
  insert into public.business_verification_requests(business_id,requested_by) values(bid,auth.uid());
  update public.businesses set verification_status='pending' where id=bid and verification_status='rejected';
end $$;
create function public.request_business_review(bid uuid) returns void
language sql security invoker set search_path='' as $$select private.request_business_review(bid)$$;
create or replace function public.create_business(details jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  result := private.save_business(details);
  perform private.request_business_review(result);
  return result;
end $$;
revoke all on function private.request_business_review(uuid),public.request_business_review(uuid) from public,anon,authenticated;
grant execute on function private.request_business_review(uuid),public.request_business_review(uuid) to authenticated;
-- Replace the legacy direct-insert path so suspended/verified businesses cannot
-- bypass the review state machine through the Data API.
revoke insert on public.business_verification_requests from authenticated;
notify pgrst, 'reload schema';
commit;
