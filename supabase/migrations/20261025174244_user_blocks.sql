-- A block is owned by its creator and prevents new contact in both directions.
begin;
create table private.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id<>blocked_id)
);
create index user_blocks_target on private.user_blocks(blocked_id);
alter table private.user_blocks enable row level security;
revoke all on private.user_blocks from public,anon,authenticated;

create function private.blocked_pair(target_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.user_blocks
    where (blocker_id=auth.uid() and blocked_id=target_user)
       or (blocker_id=target_user and blocked_id=auth.uid()))
$$;

-- Use the same pair lock for blocking and contact so simultaneous actions cannot
-- deliver a message after a committed block or restore revoked consent.
create function private.lock_social_pair(target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or private.active_role() is null or target_user is null or target_user=auth.uid() then
    raise exception 'Not authorized'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(auth.uid(),target_user)::text || ':' || greatest(auth.uid(),target_user)::text,0));
end $$;

create function private.block_action(target_user uuid, decision text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.lock_social_pair(target_user);
  if decision='block' then
    if not exists(select 1 from public.profiles p where p.id=target_user and (
        (p.public_profile and p.role='jobseeker' and not p.suspended) or
        exists(select 1 from public.friendships f where
          least(f.requester_id,f.recipient_id)=least(auth.uid(),target_user)
          and greatest(f.requester_id,f.recipient_id)=greatest(auth.uid(),target_user)))) then
      raise exception 'Profile unavailable'; end if;
    insert into private.user_blocks(blocker_id,blocked_id) values(auth.uid(),target_user) on conflict do nothing;
    -- Keep history, but revoke friend and message consent. Unblocking does not
    -- silently recreate a friendship or restore messaging permission.
    update public.friendships set status=case when status='none' then 'none' else 'removed' end,
      message_status=null,message_requester_id=null,message_intro_id=null,updated_at=now()
    where least(requester_id,recipient_id)=least(auth.uid(),target_user)
      and greatest(requester_id,recipient_id)=greatest(auth.uid(),target_user);
  elsif decision='unblock' then
    delete from private.user_blocks where blocker_id=auth.uid() and blocked_id=target_user;
  else raise exception 'Invalid block action'; end if;
end $$;
create function public.block_action(target_user uuid, decision text) returns void
language sql security invoker set search_path='' as $$select private.block_action(target_user,decision)$$;

create function private.block_state(target_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  return jsonb_build_object('blocked',private.blocked_pair(target_user),
    'blocked_by_me',exists(select 1 from private.user_blocks where blocker_id=auth.uid() and blocked_id=target_user));
end $$;
create function public.block_state(target_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.block_state(target_user)$$;

create function private.list_blocked_users(page_number integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  with mine as (
    select p.id,p.full_name,b.created_at from private.user_blocks b
      join public.profiles p on p.id=b.blocked_id where b.blocker_id=auth.uid()
  ), paged as (
    select * from mine order by created_at desc,id
      limit 50 offset (greatest(1,least(coalesce(page_number,1),1000))-1)*50
  )
  select jsonb_build_object('people',coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc,id) from paged),'[]'::jsonb),
    'total',(select count(*) from mine)) into result;
  return result;
end $$;
create function public.list_blocked_users(page_number integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$select private.list_blocked_users(page_number)$$;

revoke all on function private.blocked_pair(uuid),private.lock_social_pair(uuid),
  private.block_action(uuid,text),public.block_action(uuid,text),private.block_state(uuid),public.block_state(uuid),
  private.list_blocked_users(integer),public.list_blocked_users(integer) from public,anon,authenticated;
grant execute on function private.block_action(uuid,text),public.block_action(uuid,text),
  private.block_state(uuid),public.block_state(uuid),private.list_blocked_users(integer),public.list_blocked_users(integer) to authenticated;

create or replace function private.friend_action(target_user uuid,decision text) returns uuid
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); f public.friendships; result uuid;
begin
  perform private.lock_social_pair(target_user);
  if private.blocked_pair(target_user) then raise exception 'Interaction unavailable'; end if;
 if me is null or private.active_role() is null or target_user=me then raise exception 'Not authorized'; end if;
 if decision='request' then
   if not exists(select 1 from public.profiles where id=target_user and public_profile and not suspended and role='jobseeker') then raise exception 'Profile unavailable'; end if;
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
   if f.status in ('declined','removed') and f.updated_at > now()-interval '1 day' then raise exception 'Please wait before requesting again'; end if;
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

create or replace function private.start_message_request(target_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); f public.friendships;
begin
  perform private.lock_social_pair(target_user);
  if private.blocked_pair(target_user) then raise exception 'Interaction unavailable'; end if;
  if me is null or private.active_role() is null or target_user is null or target_user=me then
    raise exception 'Not authorized';
  end if;
  -- Reuse the one participant pair, including any independent friend request.
  select * into f from public.friendships
    where least(requester_id,recipient_id)=least(me,target_user)
      and greatest(requester_id,recipient_id)=greatest(me,target_user) for update;
  if f.id is not null and (f.status='accepted' or f.message_status is not null) then return f.id; end if;
  if not exists(select 1 from public.profiles where id=target_user
      and public_profile and role='jobseeker' and not suspended) then
    raise exception 'Profile unavailable';
  end if;
  perform private.limit_action('message_request',20);
  insert into public.friendships(requester_id,recipient_id,status,message_status,message_requester_id)
    values(me,target_user,'none','pending',me)
    on conflict do nothing;
  select * into f from public.friendships
    where least(requester_id,recipient_id)=least(me,target_user)
      and greatest(requester_id,recipient_id)=greatest(me,target_user) for update;
  if f.status<>'accepted' and f.message_status is null then
    update public.friendships set message_status='pending',message_requester_id=me where id=f.id;
  end if;
  return f.id;
end $$;

create or replace function private.send_direct_message(connection_id uuid,message_id uuid,content text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare f public.friendships; previous public.direct_messages; first_request boolean;
begin
  perform private.lock_social_pair((select case when requester_id=auth.uid() then recipient_id else requester_id end from public.friendships where id=connection_id and auth.uid() in(requester_id,recipient_id)));
  if private.blocked_pair((select case when requester_id=auth.uid() then recipient_id else requester_id end from public.friendships where id=connection_id and auth.uid() in(requester_id,recipient_id))) then raise exception 'Interaction unavailable'; end if;
  if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  select * into f from public.friendships where id=connection_id for update;
  if f.id is null or auth.uid() not in(f.requester_id,f.recipient_id) then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.profiles where id in(f.requester_id,f.recipient_id) and suspended) then
    raise exception 'Account unavailable'; end if;
  if content is null or length(btrim(content)) not between 1 and 4000 then raise exception 'Message must be 1 to 4000 characters'; end if;
  -- Retry the same message safely, including after a request has been declined.
  select * into previous from public.direct_messages where id=message_id;
  if previous.id is not null then
    if previous.friendship_id=connection_id and previous.sender_id=auth.uid() and previous.body=btrim(content) then return previous.id; end if;
    raise exception 'Invalid message identifier';
  end if;
  first_request := f.status<>'accepted' and f.message_status='pending';
  if f.status<>'accepted' and f.message_status is distinct from 'accepted' then
    if f.message_status is distinct from 'pending' or f.message_requester_id<>auth.uid() then
      raise exception 'Message request must be accepted'; end if;
    if f.message_intro_id is not null then
      raise exception 'Wait for your message request to be accepted'; end if;
  end if;
  perform private.limit_action('message',500);
  insert into public.direct_messages(id,friendship_id,sender_id,body) values(message_id,connection_id,auth.uid(),btrim(content));
  if first_request then
    update public.friendships set message_intro_id=message_id where id=f.id;
    insert into public.notifications(user_id,title,body) values(
      case when auth.uid()=f.requester_id then f.recipient_id else f.requester_id end,
      'New message request','Someone sent you a message. Open Message requests to review it.');
  end if;
  return message_id;
end $$;

create or replace function private.respond_message_request(connection_id uuid, decision text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); f public.friendships;
begin
  perform private.lock_social_pair((select case when requester_id=auth.uid() then recipient_id else requester_id end from public.friendships where id=connection_id and auth.uid() in(requester_id,recipient_id)));
  if private.blocked_pair((select case when requester_id=auth.uid() then recipient_id else requester_id end from public.friendships where id=connection_id and auth.uid() in(requester_id,recipient_id))) then raise exception 'Interaction unavailable'; end if;
  if me is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  select * into f from public.friendships where id=connection_id for update;
  if f.id is null or me not in(f.requester_id,f.recipient_id)
      or f.message_status is distinct from 'pending' or f.message_requester_id=me
      or decision is null or decision not in('accept','decline') then raise exception 'Action not allowed'; end if;
  if decision='accept' and exists(select 1 from public.profiles
      where id in(f.requester_id,f.recipient_id) and suspended) then raise exception 'Account unavailable'; end if;
  update public.friendships set message_status=case when decision='accept' then 'accepted' else 'declined' end where id=f.id;
end $$;

notify pgrst, 'reload schema';
commit;
