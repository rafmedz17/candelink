-- Friend requests and conversations are visible only to their participants.
create table public.friendships (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','removed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(requester_id <> recipient_id)
);
create unique index friendships_pair on public.friendships(least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index friendships_requester on public.friendships(requester_id,updated_at desc);
create index friendships_recipient on public.friendships(recipient_id,updated_at desc);
create table public.direct_messages (
 id uuid primary key, friendship_id uuid not null references public.friendships(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index messages_conversation on public.direct_messages(friendship_id,created_at desc,id desc);
create index messages_sender on public.direct_messages(sender_id);
alter table public.friendships enable row level security;
alter table public.direct_messages enable row level security;
revoke all on public.friendships,public.direct_messages from public,anon,authenticated;
grant select on public.friendships,public.direct_messages to authenticated;

create function private.can_read_conversation(cid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.active_role() is not null and exists(
   select 1 from public.friendships f where f.id=cid and auth.uid() in(f.requester_id,f.recipient_id))
$$;
create policy friendships_participants on public.friendships for select to authenticated
 using(private.active_role() is not null and (select auth.uid()) in(requester_id,recipient_id));
create policy messages_participants on public.direct_messages for select to authenticated
 using(private.can_read_conversation(friendship_id));

create function private.friend_action(target_user uuid,decision text) returns uuid
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
   if f.updated_at > now()-interval '1 day' then raise exception 'Please wait before requesting again'; end if;
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
create function public.friend_action(target_user uuid,decision text) returns uuid
language sql security invoker set search_path='' as $$select private.friend_action(target_user,decision)$$;

create function private.list_connections(page_number integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized'; end if;
 with mine as (
   select f.*, jsonb_build_object('id',p.id,'full_name',p.full_name,'headline',p.headline,'avatar_path',p.avatar_path,'public_profile',p.public_profile and p.role='jobseeker' and not p.suspended,'active',not p.suspended) as peer,
   (select max(m.created_at) from public.direct_messages m where m.friendship_id=f.id) as last_message_at
   from public.friendships f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end
   where auth.uid() in(f.requester_id,f.recipient_id)
     and (f.status in('pending','accepted') or exists(select 1 from public.direct_messages m where m.friendship_id=f.id))
 ), paged as (
   select * from mine order by coalesce(last_message_at,updated_at) desc,id
   limit 50 offset (greatest(1,least(coalesce(page_number,1),1000))-1)*50
 )
 select jsonb_build_object('connections',coalesce((select jsonb_agg(to_jsonb(paged) order by coalesce(last_message_at,updated_at) desc,id) from paged),'[]'::jsonb),'total',(select count(*) from mine)) into result;
 return result;
end $$;
create function public.list_connections(page_number integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$select private.list_connections(page_number)$$;

create function private.send_direct_message(connection_id uuid,message_id uuid,content text) returns uuid
language plpgsql security definer set search_path='' as $$
declare f public.friendships; previous public.direct_messages;
begin
 if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized'; end if;
 select * into f from public.friendships where id=connection_id for update;
 if f.id is null or auth.uid() not in(f.requester_id,f.recipient_id) then raise exception 'Not authorized'; end if;
 if f.status<>'accepted' or exists(select 1 from public.profiles where id in(f.requester_id,f.recipient_id) and suspended) then raise exception 'Messaging requires an active friendship'; end if;
 if content is null or length(btrim(content)) not between 1 and 4000 then raise exception 'Message must be 1 to 4000 characters'; end if;
 select * into previous from public.direct_messages where id=message_id;
 if previous.id is not null then
   if previous.friendship_id=connection_id and previous.sender_id=auth.uid() and previous.body=btrim(content) then return previous.id; end if;
   raise exception 'Invalid message identifier';
 end if;
 perform private.limit_action('message',500);
 insert into public.direct_messages(id,friendship_id,sender_id,body) values(message_id,connection_id,auth.uid(),btrim(content));
 return message_id;
end $$;
create function public.send_direct_message(connection_id uuid,message_id uuid,content text) returns uuid
language sql security invoker set search_path='' as $$select private.send_direct_message(connection_id,message_id,content)$$;

create function private.conversation_messages(connection_id uuid,before_message uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_read_conversation(connection_id) then raise exception 'Not authorized'; end if;
 if before_message is not null and not exists(select 1 from public.direct_messages where id=before_message and friendship_id=connection_id) then raise exception 'Invalid cursor'; end if;
 with batch as (
   select id,sender_id,body,created_at from public.direct_messages
   where friendship_id=connection_id and (before_message is null or (created_at,id)<(select created_at,id from public.direct_messages where id=before_message))
   order by created_at desc,id desc limit 31
 ), page as (select * from batch order by created_at desc,id desc limit 30)
 select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(page) order by created_at,id) from page),'[]'::jsonb),'has_more',(select count(*)>30 from batch)) into result;
 return result;
end $$;
create function public.conversation_messages(connection_id uuid,before_message uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.conversation_messages(connection_id,before_message)$$;

create function private.connection_details(connection_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_read_conversation(connection_id) then raise exception 'Not authorized'; end if;
 return (select to_jsonb(f)||jsonb_build_object('peer',jsonb_build_object('id',p.id,'full_name',p.full_name,'headline',p.headline,'avatar_path',p.avatar_path,'public_profile',p.public_profile and p.role='jobseeker' and not p.suspended,'active',not p.suspended))
 from public.friendships f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end where f.id=connection_id);
end $$;
create function public.connection_details(connection_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.connection_details(connection_id)$$;
revoke all on function private.connection_details(uuid),public.connection_details(uuid) from public,anon,authenticated;
grant execute on function private.connection_details(uuid),public.connection_details(uuid) to authenticated;

revoke all on function private.can_read_conversation(uuid),private.friend_action(uuid,text),private.list_connections(integer),private.send_direct_message(uuid,uuid,text),private.conversation_messages(uuid,uuid) from public,anon,authenticated;
revoke all on function public.friend_action(uuid,text),public.list_connections(integer),public.send_direct_message(uuid,uuid,text),public.conversation_messages(uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_read_conversation(uuid),private.friend_action(uuid,text),private.list_connections(integer),private.send_direct_message(uuid,uuid,text),private.conversation_messages(uuid,uuid) to authenticated;
grant execute on function public.friend_action(uuid,text),public.list_connections(integer),public.send_direct_message(uuid,uuid,text),public.conversation_messages(uuid,uuid) to authenticated;
