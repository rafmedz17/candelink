-- Public profiles remain opt-in for both jobseekers and business owners.
begin;
create or replace function private.search_people(keyword text, page_number integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  with filtered as (
    select p.id, p.full_name, p.headline, p.location, p.avatar_path
    from public.profiles p
    where p.public_profile and not p.suspended and p.role in ('jobseeker','business_owner')
      and p.id is distinct from (select auth.uid())
      and not exists(select 1 from private.user_blocks b
        where b.blocker_id=p.id and b.blocked_id=(select auth.uid()))
      and length(btrim(coalesce(keyword, ''))) >= 2
      and strpos(lower(p.full_name || ' ' || p.headline || ' ' || p.skills),
                 lower(left(btrim(keyword), 100))) > 0
  ), paged as (
    select * from filtered order by lower(full_name), id
    limit 12 offset (greatest(1, least(coalesce(page_number, 1), 1000)) - 1) * 12
  )
  select jsonb_build_object(
    'people', coalesce((select jsonb_agg(to_jsonb(paged) order by lower(full_name), id) from paged), '[]'::jsonb),
    'total', (select count(*) from filtered)
  )
$$;

create or replace function private.public_profile(profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'full_name', p.full_name,
    'headline', p.headline,
    'location', p.location,
    'introduction', p.introduction,
    'skills', p.skills,
    'education', p.education,
    'experience', p.experience,
    'avatar_path', p.avatar_path,
    'updated_at', p.updated_at
  )
  from public.profiles p
  where p.id = profile_id
    and p.role in ('jobseeker','business_owner')
    and p.public_profile = true and not p.suspended
    and not exists(select 1 from private.user_blocks b
      where b.blocker_id=p.id and b.blocked_id=(select auth.uid()))
$$;



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
      and public_profile and role in ('jobseeker','business_owner') and not suspended) then
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

create or replace function private.block_action(target_user uuid, decision text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.lock_social_pair(target_user);
  if decision='block' then
    if not exists(select 1 from public.profiles p where p.id=target_user and (
        (p.public_profile and p.role in ('jobseeker','business_owner') and not p.suspended) or
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

create or replace function private.list_connections(page_number integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  with mine as (
    select f.*,
      jsonb_build_object('id',p.id,'full_name',p.full_name,'headline',p.headline,'avatar_path',p.avatar_path,
        'public_profile',p.public_profile and p.role in ('jobseeker','business_owner') and not p.suspended,'active',not p.suspended) as peer,
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
create or replace function private.list_message_conversations(page_number integer, requests boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; me uuid := auth.uid();
begin
  if me is null or private.active_role() is null then raise exception 'Not authorized'; end if;
  with mine as (
    select f.*,
      jsonb_build_object('id',p.id,'full_name',p.full_name,'headline',p.headline,'avatar_path',p.avatar_path,
        'public_profile',p.public_profile and p.role in ('jobseeker','business_owner') and not p.suspended,'active',not p.suspended) as peer,
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
create or replace function private.connection_details(connection_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_read_conversation(connection_id) then raise exception 'Not authorized'; end if;
 return (select to_jsonb(f)||jsonb_build_object('peer',jsonb_build_object('id',p.id,'full_name',p.full_name,'headline',p.headline,'avatar_path',p.avatar_path,'public_profile',p.public_profile and p.role in ('jobseeker','business_owner') and not p.suspended,'active',not p.suspended))
 from public.friendships f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end where f.id=connection_id);
end $$;
create function private.community_profiles() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from (
    select p.id,p.full_name,p.avatar_path,p.role from public.profiles p
    where p.public_profile and not p.suspended and p.role in ('jobseeker','business_owner')
      and p.id is distinct from (select auth.uid())
      and not exists(select 1 from private.user_blocks b where b.blocker_id=p.id and b.blocked_id=(select auth.uid()))
    order by p.created_at desc,p.id limit 3
  ) p
$$;
create function public.community_profiles() returns jsonb
language sql stable security invoker set search_path='' as $$select private.community_profiles()$$;
revoke all on function private.community_profiles(),public.community_profiles() from public,anon,authenticated;
grant execute on function private.community_profiles(),public.community_profiles() to anon,authenticated;
notify pgrst, 'reload schema';
commit;
