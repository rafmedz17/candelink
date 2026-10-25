-- Messaging consent is independent of friendship consent. Existing friendships
-- keep their current behavior; accepting a message request never adds a friend.
alter table public.friendships drop constraint friendships_status_check;
alter table public.friendships add constraint friendships_status_check
  check(status in ('none','pending','accepted','declined','removed'));
alter table public.friendships
  add column message_status text check (message_status in ('pending','accepted','declined')),
  add column message_requester_id uuid references public.profiles(id) on delete cascade,
  add column message_intro_id uuid references public.direct_messages(id) on delete set null,
  add constraint message_request_participant check (
    (message_status is null and message_requester_id is null) or
    (message_status is not null and message_requester_id is not null
      and message_requester_id in (requester_id,recipient_id))
  );

create function private.start_message_request(target_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); f public.friendships;
begin
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
create function public.start_message_request(target_user uuid) returns uuid
language sql security invoker set search_path = '' as $$select private.start_message_request(target_user)$$;

create function private.respond_message_request(connection_id uuid, decision text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); f public.friendships;
begin
  if me is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  select * into f from public.friendships where id=connection_id for update;
  if f.id is null or me not in(f.requester_id,f.recipient_id)
      or f.message_status is distinct from 'pending' or f.message_requester_id=me
      or decision is null or decision not in('accept','decline') then raise exception 'Action not allowed'; end if;
  if decision='accept' and exists(select 1 from public.profiles
      where id in(f.requester_id,f.recipient_id) and suspended) then raise exception 'Account unavailable'; end if;
  update public.friendships set message_status=case when decision='accept' then 'accepted' else 'declined' end where id=f.id;
end $$;
create function public.respond_message_request(connection_id uuid, decision text) returns void
language sql security invoker set search_path = '' as $$select private.respond_message_request(connection_id,decision)$$;

create or replace function private.send_direct_message(connection_id uuid,message_id uuid,content text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare f public.friendships; previous public.direct_messages; first_request boolean;
begin
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

-- Filter before pagination so requests do not displace the regular inbox.
create function private.list_message_conversations(page_number integer, requests boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; me uuid := auth.uid();
begin
  if me is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  with mine as (
    select f.*,
      jsonb_build_object('id',p.id,'full_name',p.full_name,'headline',p.headline,'avatar_path',p.avatar_path,
        'public_profile',p.public_profile and p.role='jobseeker' and not p.suspended,'active',not p.suspended) as peer,
      latest.created_at as last_message_at,
      case when latest.id is null then null else jsonb_build_object(
        'id',latest.id,'sender_id',latest.sender_id,'body',left(latest.body,140),'created_at',latest.created_at
      ) end as last_message
    from public.friendships f
    join public.profiles p on p.id=case when f.requester_id=me then f.recipient_id else f.requester_id end
    left join lateral (
      select m.* from public.direct_messages m where m.friendship_id=f.id
      order by m.created_at desc,m.id desc limit 1
    ) latest on true
    where me in(f.requester_id,f.recipient_id)
      and case when requests then
        f.status<>'accepted' and f.message_status='pending' and f.message_requester_id<>me and f.message_intro_id is not null
      else
        (f.status='accepted' or f.message_status is not null or latest.id is not null)
        and not (f.status<>'accepted' and coalesce(f.message_status='pending',false) and f.message_requester_id<>me)
      end
  ), paged as (
    select * from mine order by coalesce(last_message_at,updated_at) desc,id
      limit 50 offset (greatest(1,least(coalesce(page_number,1),1000))-1)*50
  )
  select jsonb_build_object('connections',coalesce((select jsonb_agg(
    to_jsonb(paged)||jsonb_build_object('unread_count',private.unread_message_count(paged.id))
    order by coalesce(last_message_at,updated_at) desc,id) from paged),'[]'::jsonb),
    'total',(select count(*) from mine),
    'request_count',(select count(*) from public.friendships f where me in(f.requester_id,f.recipient_id)
      and f.status<>'accepted' and f.message_status='pending' and f.message_requester_id<>me
      and f.message_intro_id is not null)) into result;
  return result;
end $$;
create function public.list_message_conversations(page_number integer default 1, requests boolean default false) returns jsonb
language sql stable security invoker set search_path = '' as $$select private.list_message_conversations(page_number,requests)$$;

revoke all on function private.start_message_request(uuid), public.start_message_request(uuid),
  private.respond_message_request(uuid,text), public.respond_message_request(uuid,text),
  private.list_message_conversations(integer,boolean), public.list_message_conversations(integer,boolean)
  from public,anon,authenticated;
grant execute on function private.start_message_request(uuid), public.start_message_request(uuid),
  private.respond_message_request(uuid,text), public.respond_message_request(uuid,text),
  private.list_message_conversations(integer,boolean), public.list_message_conversations(integer,boolean)
  to authenticated;

-- A message-only pair has no friend request to retry.
create or replace function private.friend_action(target_user uuid,decision text) returns uuid
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); f public.friendships; result uuid;
begin
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
