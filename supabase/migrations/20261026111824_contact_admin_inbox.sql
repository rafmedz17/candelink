-- Authenticated support messages use the normal private inbox and reply flow.
begin;
create function private.contact_admin(message_id uuid, content text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); administrator uuid; f public.friendships;
  previous public.direct_messages; first_contact boolean;
begin
  if me is null or private.active_role() not in ('jobseeker','business_owner')
      or private.active_role() is null then raise exception 'Not authorized'; end if;
  if message_id is null or content is null or length(btrim(content)) not between 1 and 4000 then
    raise exception 'Message must be 1 to 4000 characters'; end if;
  -- Retry a submitted message without delivering it twice or choosing another admin.
  select * into previous from public.direct_messages where id=message_id;
  if previous.id is not null then
    select * into f from public.friendships where id=previous.friendship_id;
    administrator := case when f.requester_id=me then f.recipient_id else f.requester_id end;
    if previous.sender_id<>me or previous.body<>btrim(content)
        or not exists(select 1 from public.profiles where id=administrator and role='admin' and not suspended)
        or private.blocked_pair(administrator) then raise exception 'Invalid message identifier'; end if;
    return f.id;
  end if;
  -- Reuse an existing admin conversation, otherwise select the earliest active admin.
  select p.id into administrator from public.profiles p
    left join public.friendships pair on least(pair.requester_id,pair.recipient_id)=least(me,p.id)
      and greatest(pair.requester_id,pair.recipient_id)=greatest(me,p.id)
    where p.role='admin' and not p.suspended and p.id<>me and not private.blocked_pair(p.id)
    order by (pair.id is not null) desc,p.created_at,p.id limit 1;
  if administrator is null then raise exception 'Admin unavailable'; end if;
  perform private.lock_social_pair(administrator);
  if private.blocked_pair(administrator) or not exists(select 1 from public.profiles
      where id=administrator and role='admin' and not suspended) then raise exception 'Admin unavailable'; end if;
  perform private.limit_action('admin_contact',20);
  insert into public.friendships(requester_id,recipient_id,status,message_status,message_requester_id)
    values(me,administrator,'none','accepted',me) on conflict do nothing;
  select * into f from public.friendships
    where least(requester_id,recipient_id)=least(me,administrator)
      and greatest(requester_id,recipient_id)=greatest(me,administrator) for update;
  first_contact := not exists(select 1 from public.direct_messages where friendship_id=f.id);
  update public.friendships set message_status='accepted',message_requester_id=me,updated_at=now() where id=f.id;
  perform private.send_direct_message(f.id,message_id,content);
  if first_contact then
    insert into public.notifications(user_id,title,body) values(administrator,
      'New admin contact','A community member contacted the team. Open Messages to reply.');
  end if;
  return f.id;
end $$;
create function public.contact_admin(message_id uuid, content text) returns uuid
language sql security invoker set search_path='' as $$select private.contact_admin(message_id,content)$$;
revoke all on function private.contact_admin(uuid,text),public.contact_admin(uuid,text) from public,anon,authenticated;
grant execute on function private.contact_admin(uuid,text),public.contact_admin(uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
