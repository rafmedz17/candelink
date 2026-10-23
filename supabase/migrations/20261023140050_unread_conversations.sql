-- Read positions stay private. Callers can advance only their own position in
-- a conversation they participate in, up to a message they have actually loaded.
create table private.conversation_reads (
  friendship_id uuid not null references public.friendships(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_created_at timestamptz not null,
  last_read_message_id uuid not null references public.direct_messages(id) on delete cascade,
  primary key (friendship_id, user_id)
);
create index conversation_reads_user on private.conversation_reads(user_id);
create index conversation_reads_message on private.conversation_reads(last_read_message_id);
alter table private.conversation_reads enable row level security;
revoke all on private.conversation_reads from public, anon, authenticated;
create index notifications_unread on public.notifications(user_id) where not read;
create index friendships_incoming_pending on public.friendships(recipient_id) where status = 'pending';

create function private.unread_message_count(cid uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.direct_messages m
  left join private.conversation_reads r
    on r.friendship_id = m.friendship_id and r.user_id = (select auth.uid())
  where m.friendship_id = cid and m.sender_id <> (select auth.uid())
    and (select private.can_read_conversation(cid))
    and (r.friendship_id is null or
      (m.created_at, m.id) > (r.last_read_created_at, r.last_read_message_id))
$$;
revoke all on function private.unread_message_count(uuid) from public, anon, authenticated;

create function private.mark_conversation_read(connection_id uuid, last_message_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.direct_messages;
begin
  if not private.can_read_conversation(connection_id) then raise exception 'Not authorized'; end if;
  select * into m from public.direct_messages where id = last_message_id and friendship_id = connection_id;
  if m.id is null then raise exception 'Message not found'; end if;
  insert into private.conversation_reads as r
    (friendship_id, user_id, last_read_created_at, last_read_message_id)
    values (connection_id, auth.uid(), m.created_at, m.id)
  on conflict (friendship_id, user_id) do update
    set last_read_created_at = excluded.last_read_created_at,
        last_read_message_id = excluded.last_read_message_id
    where (r.last_read_created_at, r.last_read_message_id)
      < (excluded.last_read_created_at, excluded.last_read_message_id);
end $$;
create function public.mark_conversation_read(connection_id uuid, last_message_id uuid) returns void
language sql security invoker set search_path = '' as $$
  select private.mark_conversation_read(connection_id, last_message_id)
$$;
revoke all on function private.mark_conversation_read(uuid,uuid), public.mark_conversation_read(uuid,uuid) from public, anon, authenticated;
grant execute on function private.mark_conversation_read(uuid,uuid), public.mark_conversation_read(uuid,uuid) to authenticated;

-- Counts cover every conversation, rather than only the currently loaded page.
create function private.account_activity() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'messages', (select coalesce(sum(private.unread_message_count(f.id)), 0)
      from public.friendships f where me in (f.requester_id, f.recipient_id)),
    'friends', (select count(*) from public.friendships where recipient_id = me and status = 'pending'),
    'notifications', (select count(*) from public.notifications where user_id = me and not read)
  );
end $$;
create function public.account_activity() returns jsonb
language sql stable security invoker set search_path = '' as $$select private.account_activity()$$;
revoke all on function private.account_activity(), public.account_activity() from public, anon, authenticated;
grant execute on function private.account_activity(), public.account_activity() to authenticated;

-- Extend the existing participant-only projection with message previews and counts.
create or replace function private.list_connections(page_number integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  with mine as (
    select f.*,
      jsonb_build_object('id',p.id,'full_name',p.full_name,'headline',p.headline,'avatar_path',p.avatar_path,
        'public_profile',p.public_profile and p.role='jobseeker' and not p.suspended,'active',not p.suspended) as peer,
      latest.created_at as last_message_at,
      case when latest.id is null then null else jsonb_build_object(
        'id',latest.id,'sender_id',latest.sender_id,'body',left(latest.body,140),'created_at',latest.created_at
      ) end as last_message
    from public.friendships f
    join public.profiles p on p.id = case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end
    left join lateral (
      select m.id, m.sender_id, m.body, m.created_at from public.direct_messages m
      where m.friendship_id=f.id order by m.created_at desc, m.id desc limit 1
    ) latest on true
    where auth.uid() in (f.requester_id,f.recipient_id)
      and (f.status in ('pending','accepted') or latest.id is not null)
  ), paged as (
    select * from mine order by coalesce(last_message_at,updated_at) desc,id
    limit 50 offset (greatest(1,least(coalesce(page_number,1),1000))-1)*50
  )
  select jsonb_build_object(
    'connections',coalesce((select jsonb_agg(
      to_jsonb(paged) || jsonb_build_object('unread_count',private.unread_message_count(paged.id))
      order by coalesce(last_message_at,updated_at) desc,id
    ) from paged),'[]'::jsonb),
    'total',(select count(*) from mine)
  ) into result;
  return result;
end $$;
