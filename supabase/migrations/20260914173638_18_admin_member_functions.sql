-- Service-role-only helpers for the admin-users Edge Function.
-- The Edge Function verifies the caller's JWT and passes their user id as p_actor_id;
-- every function re-checks that the actor is an active owner before changing anything.

create or replace function public.admin_assert_owner(p_actor_id uuid, p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = p_actor_id
      and m.role = 'owner' and m.status = 'active'
  ) then
    perform private.raise_error('PERMISSION_DENIED', 'Only an owner can manage users.');
  end if;
end $$;

create or replace function public.admin_member_target(p_actor_id uuid, p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.business_members; v_name text;
begin
  select * into v_m from public.business_members m where m.id = p_member_id;
  if not found then
    perform private.raise_error('NOT_FOUND', 'That user no longer exists.');
  end if;
  perform public.admin_assert_owner(p_actor_id, v_m.business_id);
  if v_m.user_id = p_actor_id then
    perform private.raise_error('SELF_CHANGE_NOT_ALLOWED', 'You cannot change your own access.');
  end if;
  select p.full_name into v_name from public.profiles p where p.id = v_m.user_id;
  return jsonb_build_object('member_id', v_m.id, 'user_id', v_m.user_id, 'business_id', v_m.business_id,
    'role', v_m.role, 'status', v_m.status, 'full_name', v_name);
end $$;

create or replace function public.admin_attach_member(
  p_actor_id uuid, p_business_id uuid, p_user_id uuid, p_full_name text,
  p_role public.member_role, p_title text, p_permission_keys text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_name text := left(nullif(btrim(p_full_name), ''), 120);
  v_title text := left(nullif(btrim(p_title), ''), 60);
  v_keys text[] := case when p_role = 'staff' then coalesce(p_permission_keys, '{}') else '{}' end;
begin
  perform public.admin_assert_owner(p_actor_id, p_business_id);
  if v_name is null then
    perform private.raise_error('INVALID_INPUT', 'Enter the person''s full name.');
  end if;
  if exists (select 1 from public.business_members m where m.user_id = p_user_id) then
    perform private.raise_error('EMAIL_IN_USE', 'This person already has access to a gym in GYMATICK.');
  end if;
  if exists (select 1 from unnest(v_keys) k where not exists (select 1 from public.permissions p where p.key = k)) then
    perform private.raise_error('INVALID_INPUT', 'One of the permissions does not exist.');
  end if;

  insert into public.profiles (id, full_name, must_change_password)
  values (p_user_id, v_name, true)
  on conflict (id) do update set full_name = excluded.full_name, must_change_password = true;

  insert into public.business_members (business_id, user_id, role, status, title, invited_by)
  values (p_business_id, p_user_id, p_role, 'active', v_title, p_actor_id)
  returning id into v_member;

  insert into public.member_permissions (member_id, permission_key, granted_by)
  select v_member, k, p_actor_id from unnest(v_keys) k
  on conflict do nothing;

  insert into public.audit_logs (business_id, actor_id, action, module, entity_type, entity_id, summary, metadata)
  values (p_business_id, p_actor_id, 'member.created', 'users', 'member', v_member,
    format('Added %s as %s', v_name, case when p_role = 'owner' then 'an owner' else coalesce(v_title, 'staff') end),
    jsonb_build_object('role', p_role, 'permissions', to_jsonb(v_keys)));

  return jsonb_build_object('member_id', v_member, 'user_id', p_user_id);
end $$;

create or replace function public.admin_set_member_status(p_actor_id uuid, p_member_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_target jsonb; v_status public.business_members.status%type;
begin
  if p_status is null or p_status not in ('active', 'inactive') then
    perform private.raise_error('INVALID_INPUT', 'Unknown status.');
  end if;
  v_target := public.admin_member_target(p_actor_id, p_member_id);
  if v_target ->> 'status' = p_status then
    return v_target || jsonb_build_object('changed', false);
  end if;
  v_status := p_status;

  update public.business_members m
  set status = v_status,
      deactivated_at = case when p_status = 'inactive' then now() end,
      deactivated_by = case when p_status = 'inactive' then p_actor_id end
  where m.id = p_member_id;

  insert into public.audit_logs (business_id, actor_id, action, module, entity_type, entity_id, summary, changes)
  values ((v_target ->> 'business_id')::uuid, p_actor_id,
    case when p_status = 'inactive' then 'member.deactivated' else 'member.reactivated' end,
    'users', 'member', p_member_id,
    format('%s %s', case when p_status = 'inactive' then 'Deactivated' else 'Reactivated' end,
      coalesce(v_target ->> 'full_name', 'user')),
    jsonb_build_object('status', jsonb_build_object('from', v_target ->> 'status', 'to', p_status)));

  return v_target || jsonb_build_object('status', p_status, 'changed', true);
end $$;

create or replace function public.admin_flag_password_reset(p_actor_id uuid, p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_target jsonb;
begin
  v_target := public.admin_member_target(p_actor_id, p_member_id);
  update public.profiles set must_change_password = true where id = (v_target ->> 'user_id')::uuid;
  insert into public.audit_logs (business_id, actor_id, action, module, entity_type, entity_id, summary)
  values ((v_target ->> 'business_id')::uuid, p_actor_id, 'member.password_reset', 'users', 'member', p_member_id,
    format('Reset the password for %s', coalesce(v_target ->> 'full_name', 'user')));
  return v_target;
end $$;

-- Only the Edge Function (service role) may call these.
do $$
declare v_fn text;
begin
  foreach v_fn in array array['admin_assert_owner', 'admin_member_target', 'admin_attach_member',
                              'admin_set_member_status', 'admin_flag_password_reset'] loop
    execute format('revoke all on function public.%I from public, anon, authenticated', v_fn);
    execute format('grant execute on function public.%I to service_role', v_fn);
  end loop;
end $$;
