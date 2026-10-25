begin;
alter table public.businesses add column cover_paths text[] not null default '{}'
  check(cardinality(cover_paths)<=6 and array_position(cover_paths,null) is null);

create function private.business_photo(bid uuid, image_path text, remove_photo boolean) returns void
language plpgsql security definer set search_path='' as $$
declare current_paths text[];
begin
  if private.is_member(bid) is distinct from true then raise exception 'Business membership required'; end if;
  select cover_paths into current_paths from public.businesses where id=bid for update;
  if remove_photo is null or image_path is null then raise exception 'Invalid photo'; end if;
  if remove_photo then
    update public.businesses set cover_paths=array_remove(current_paths,image_path) where id=bid;
  else
    if split_part(image_path,'/',1) is distinct from auth.uid()::text
      or not exists(select 1 from storage.objects where bucket_id='avatars' and name=image_path)
      then raise exception 'Upload your own photo first'; end if;
    if image_path=any(current_paths) then return; end if;
    if cardinality(current_paths)>=6 then raise exception 'Maximum six background photos'; end if;
    update public.businesses set cover_paths=array_append(current_paths,image_path) where id=bid;
  end if;
end $$;
create function public.business_photo(bid uuid,image_path text,remove_photo boolean default false) returns void
language sql security invoker set search_path='' as $$select private.business_photo(bid,image_path,remove_photo)$$;

create function private.set_business_logo(bid uuid,image_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if private.is_member(bid) is distinct from true then raise exception 'Business membership required'; end if;
  if image_path is not null and (split_part(image_path,'/',1) is distinct from auth.uid()::text
    or not exists(select 1 from storage.objects where bucket_id='avatars' and name=image_path))
    then raise exception 'Upload your own logo first'; end if;
  update public.businesses set logo_path=image_path where id=bid;
end $$;
create function public.set_business_logo(bid uuid,image_path text) returns void
language sql security invoker set search_path='' as $$select private.set_business_logo(bid,image_path)$$;
revoke all on function private.business_photo(uuid,text,boolean),public.business_photo(uuid,text,boolean),
  private.set_business_logo(uuid,text),public.set_business_logo(uuid,text) from public,anon,authenticated;
grant execute on function private.business_photo(uuid,text,boolean),public.business_photo(uuid,text,boolean),
  private.set_business_logo(uuid,text),public.set_business_logo(uuid,text) to authenticated;
create or replace function private.prepare_user_deletion(target_user uuid) returns void
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
  update public.businesses b set cover_paths=array(select path from unnest(b.cover_paths) path
    where split_part(path,'/',1)<>target_user::text)
    where exists(select 1 from unnest(b.cover_paths) path where split_part(path,'/',1)=target_user::text);
  insert into public.audit_logs(actor_id,action,target_type,target_id,reason)
    values(auth.uid(),'delete_requested','user',target_user,'Administrator requested permanent account deletion');
end $$;
notify pgrst, 'reload schema';
commit;
