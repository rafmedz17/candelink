-- Friend requests may be retried immediately after cancellation, decline, removal, or unblocking.
begin;
create or replace function private.friend_action(target_user uuid,decision text) returns uuid
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); f public.friendships; result uuid;
begin
  perform private.lock_social_pair(target_user);
  if private.blocked_pair(target_user) then raise exception 'Interaction unavailable'; end if;
 if me is null or private.active_role() is null or target_user=me then raise exception 'Not authorized'; end if;
 if decision='request' then
   if not exists(select 1 from public.profiles where id=target_user and public_profile and not suspended and role in ('jobseeker','business_owner')) then raise exception 'Profile unavailable'; end if;
   perform private.limit_action('friend_request',20);
   insert into public.friendships(requester_id,recipient_id) values(me,target_user)
   on conflict do nothing returning id into result;
   if result is not null then
     insert into public.notifications(user_id,title,body) values(target_user,'New friend request','Someone wants to connect. Open Friends to review the request.');
     return result;
   end if;
 end if;
 select * into f from public.friendships where least(requester_id,recipient_id)=least(me,target_user)
   and greatest(requester_id,recipient_id)=greatest(me,target_user) for update;
 if f.id is null then raise exception 'Request not found'; end if;
 if decision='request' then
   if f.status in ('pending','accepted') then raise exception 'Already connected or pending'; end if;
   update public.friendships set requester_id=me,recipient_id=target_user,status='pending',updated_at=now() where id=f.id;
   insert into public.notifications(user_id,title,body) values(target_user,'New friend request','Someone wants to connect. Open Friends to review the request.');
 elsif decision='accept' and f.status='pending' and f.recipient_id=me then
   if not exists(select 1 from public.profiles where id=target_user and not suspended) then raise exception 'Account unavailable'; end if;
   update public.friendships set status='accepted',updated_at=now() where id=f.id;
   insert into public.notifications(user_id,title,body) values(target_user,'Friend request accepted','You can now send a private message from Friends or Messages.');
 elsif decision='decline' and f.status='pending' and f.recipient_id=me then
   update public.friendships set status='declined',updated_at=now() where id=f.id;
 elsif decision='cancel' and f.status='pending' and f.requester_id=me then
   update public.friendships set status='removed',updated_at=now() where id=f.id;
 elsif decision='remove' and f.status='accepted' then
   update public.friendships set status='removed',updated_at=now() where id=f.id;
 else raise exception 'Action not allowed'; end if;
 return f.id;
end $$;
notify pgrst, 'reload schema';
commit;
