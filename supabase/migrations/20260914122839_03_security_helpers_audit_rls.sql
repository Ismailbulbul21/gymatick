-- GYMATICK 03: RLS helpers, audit log, policies and privileges for core tables

create or replace function private.my_business_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.business_id from public.business_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function private.businesses_with_permission(p_key text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.business_id from public.business_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
    and (m.role = 'owner'
         or exists (select 1 from public.member_permissions mp
                    where mp.member_id = m.id and mp.permission_key = p_key))
$$;

create or replace function private.has_permission(p_business_id uuid, p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid()) and m.status = 'active'
      and (m.role = 'owner'
           or exists (select 1 from public.member_permissions mp
                      where mp.member_id = m.id and mp.permission_key = p_key))
  )
$$;

create or replace function private.is_owner(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = 'owner')
$$;

-- returns the caller's member id, or raises PERMISSION_DENIED
create or replace function private.assert_permission(p_business_id uuid, p_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_member uuid;
begin
  if (select auth.uid()) is null then
    perform private.raise_error('PERMISSION_DENIED', 'You must be signed in.');
  end if;
  select m.id into v_member
  from public.business_members m
  where m.business_id = p_business_id and m.user_id = (select auth.uid()) and m.status = 'active'
    and (m.role = 'owner'
         or exists (select 1 from public.member_permissions mp
                    where mp.member_id = m.id and mp.permission_key = p_key));
  if v_member is null then
    perform private.raise_error('PERMISSION_DENIED', 'You do not have permission to do this.',
      jsonb_build_object('permission', p_key));
  end if;
  return v_member;
end $$;

create or replace function private.assert_member(p_business_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_member uuid;
begin
  select m.id into v_member from public.business_members m
  where m.business_id = p_business_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then
    perform private.raise_error('PERMISSION_DENIED', 'You do not have access to this gym.');
  end if;
  return v_member;
end $$;

-- people who share a business with the caller (for "recorded by" names)
create or replace function private.colleague_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct m.user_id from public.business_members m
  where m.business_id in (select private.my_business_ids())
$$;

-- business date helpers
create or replace function private.business_date_for(p_business_id uuid, p_ts timestamptz)
returns date language sql stable security definer set search_path = '' as $$
  select ((p_ts at time zone s.timezone) - s.day_cutoff::interval)::date
  from public.business_settings s where s.business_id = p_business_id
$$;

create or replace function private.current_business_date(p_business_id uuid)
returns date language sql stable security definer set search_path = '' as $$
  select private.business_date_for(p_business_id, now())
$$;

create or replace function private.default_branch_id(p_business_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select b.id from public.branches b
  where b.business_id = p_business_id and b.is_default
  limit 1
$$;

-- append-only audit log
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  actor_id uuid references public.profiles(id),
  action text not null check (char_length(action) <= 60),
  module text not null check (char_length(module) <= 40),
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id uuid,
  summary text not null check (char_length(summary) <= 500),
  changes jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (business_id, entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (business_id, actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (business_id, action, created_at desc);

create or replace function private.forbid_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform private.raise_error('AUDIT_APPEND_ONLY', 'Activity log entries cannot be changed or deleted.');
  return null;
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
for each row execute function private.forbid_audit_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
execute function private.forbid_audit_mutation();

create or replace function private.write_audit(
  p_business_id uuid, p_action text, p_module text, p_entity_type text,
  p_entity_id uuid, p_summary text, p_changes jsonb default null, p_metadata jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (business_id, actor_id, action, module, entity_type, entity_id, summary, changes, metadata)
  values (p_business_id, (select auth.uid()), p_action, p_module, p_entity_type, p_entity_id, left(p_summary, 500), p_changes, p_metadata)
$$;

-- privileges: no client writes on core tables, no access at all for anonymous users
revoke all on public.businesses, public.business_settings, public.branches, public.profiles,
  public.business_members, public.permissions, public.member_permissions, public.audit_logs
  from anon, authenticated;
grant select on public.businesses, public.business_settings, public.branches, public.profiles,
  public.business_members, public.permissions, public.member_permissions, public.audit_logs
  to authenticated;

alter table public.businesses enable row level security;
alter table public.business_settings enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.permissions enable row level security;
alter table public.member_permissions enable row level security;
alter table public.audit_logs enable row level security;

create policy businesses_select on public.businesses for select to authenticated
  using (id in (select private.my_business_ids()));
create policy business_settings_select on public.business_settings for select to authenticated
  using (business_id in (select private.my_business_ids()));
create policy branches_select on public.branches for select to authenticated
  using (business_id in (select private.my_business_ids()));
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.colleague_ids()));
create policy business_members_select on public.business_members for select to authenticated
  using (user_id = (select auth.uid())
         or business_id in (select private.businesses_with_permission('users.manage')));
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy member_permissions_select on public.member_permissions for select to authenticated
  using (member_id in (select m.id from public.business_members m
                       where m.user_id = (select auth.uid())
                          or m.business_id in (select private.businesses_with_permission('users.manage'))));
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (business_id in (select private.businesses_with_permission('audit.view')));

-- helpers used inside policies must be executable by the caller
grant execute on function private.my_business_ids() to authenticated;
grant execute on function private.businesses_with_permission(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;
grant execute on function private.colleague_ids() to authenticated;
grant execute on function private.business_date_for(uuid, timestamptz) to authenticated;
grant execute on function private.current_business_date(uuid) to authenticated;

revoke all on function private.assert_permission(uuid, text) from public;
revoke all on function private.assert_member(uuid) from public;
revoke all on function private.write_audit(uuid, text, text, text, uuid, text, jsonb, jsonb) from public;
revoke all on function private.default_branch_id(uuid) from public;
