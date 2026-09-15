-- Two fixed roles. Admin (owner) can do everything. Shaqaale (staff) records all daily money work
-- but can never void, cancel, deactivate, reopen, or change settings and users. What Shaqaale may do
-- is defined once on the permission catalog (staff_allowed), so it is the same for every staff member.

-- "Remove" actions that shared a permission with "record/edit" actions get their own key.
insert into public.permissions (key, module, label, description, owner_only, front_desk_default, manager_preset, sort_order)
select 'customers.deactivate', p.module, 'Deactivate customers', 'Hide a customer who no longer comes to the gym',
       false, false, false, p.sort_order
from public.permissions p where p.key = 'customers.manage'
on conflict (key) do nothing;

insert into public.permissions (key, module, label, description, owner_only, front_desk_default, manager_preset, sort_order)
select 'money.transfer_edit', p.module, 'Edit transfers', 'Change a transfer after it was recorded',
       false, false, false, p.sort_order
from public.permissions p where p.key = 'money.transfer'
on conflict (key) do nothing;

alter table public.permissions add column if not exists staff_allowed boolean not null default false;
comment on column public.permissions.staff_allowed is 'Granted to every active Shaqaale (staff) member. Owners have every permission.';

update public.permissions set staff_allowed = key = any (array[
  'dashboard.financials',
  'income.view', 'income.create',
  'expenses.view', 'expenses.create',
  'transactions.view_all', 'transactions.backdate', 'transactions.refund',
  'money.transfer',
  'invoices.view', 'invoices.create', 'invoices.record_payment',
  'customers.view', 'customers.manage',
  'closings.view', 'closings.perform',
  'employees.view',
  'salaries.view', 'salaries.pay',
  'reports.view', 'reports.export'
]);

-- Permission checks read the role, not per-person grants.
create or replace function private.has_permission(p_business_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid()) and m.status = 'active'
      and (m.role = 'owner'
           or exists (select 1 from public.permissions p where p.key = p_key and p.staff_allowed))
  )
$$;

create or replace function private.businesses_with_permission(p_key text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id from public.business_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
    and (m.role = 'owner'
         or exists (select 1 from public.permissions p where p.key = p_key and p.staff_allowed))
$$;

create or replace function private.assert_permission(p_business_id uuid, p_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_member uuid;
begin
  if (select auth.uid()) is null then
    perform private.raise_error('PERMISSION_DENIED', 'You must be signed in.');
  end if;
  select m.id into v_member
  from public.business_members m
  where m.business_id = p_business_id and m.user_id = (select auth.uid()) and m.status = 'active'
    and (m.role = 'owner'
         or exists (select 1 from public.permissions p where p.key = p_key and p.staff_allowed));
  if v_member is null then
    perform private.raise_error('PERMISSION_DENIED', 'You do not have permission to do this.',
      jsonb_build_object('permission', p_key));
  end if;
  return v_member;
end $$;

-- Editing a transfer someone recorded is separate from recording one.
create or replace function private.edit_permission_key(p_kind public.transaction_kind)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_kind in ('income', 'refund') then 'income.edit'
    when p_kind = 'expense' then 'expenses.edit'
    when p_kind in ('transfer_in', 'transfer_out') then 'money.transfer_edit'
    else 'money.owner_movements' end
$$;

-- Voiding removes money from the records: admin only, even for your own recent entry.
create or replace function public.void_transaction(p_transaction_id uuid, p_reason text)
returns setof public.financial_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.financial_transactions;
  v_closed boolean;
  v_closing_id uuid;
  v_action text;
begin
  select * into v_row from public.financial_transactions t where t.id = p_transaction_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That transaction no longer exists.'); end if;
  perform private.assert_member(v_row.business_id);
  if v_row.status = 'voided' then
    perform private.raise_error('ALREADY_VOIDED', 'This transaction is already voided.');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform private.raise_error('REASON_REQUIRED', 'Please give a reason (at least 5 characters).');
  end if;

  v_closed := private.is_period_closed(v_row.business_id, v_row.branch_id, v_row.business_date);
  if v_closed then
    perform private.assert_permission(v_row.business_id, 'closings.correct');
    select c.id into v_closing_id from public.daily_closings c
    where c.business_id = v_row.business_id and c.branch_id = v_row.branch_id and c.status = 'closed'
      and c.business_date >= v_row.business_date and c.period_start <= v_row.business_date
    order by c.business_date limit 1;
  elsif not private.has_permission(v_row.business_id, 'transactions.void') then
    perform private.raise_error('PERMISSION_DENIED', 'Only an admin can void an entry.',
      jsonb_build_object('permission', 'transactions.void'));
  end if;

  if v_row.kind = 'income' and exists (
      select 1 from public.financial_transactions r
      where r.related_transaction_id = v_row.id and r.kind = 'refund' and r.status = 'posted') then
    perform private.raise_error('HAS_REFUNDS', 'Void the refunds for this payment first.');
  end if;

  update public.financial_transactions t
  set status = 'voided', void_reason = btrim(p_reason), voided_by = (select auth.uid()),
      voided_at = now(), updated_by = (select auth.uid())
  where (t.id = v_row.id or (v_row.transfer_group_id is not null and t.transfer_group_id = v_row.transfer_group_id))
    and t.status = 'posted';

  v_action := case
    when v_row.is_salary then 'salary.voided'
    when v_row.kind = 'expense' then 'expense.voided'
    when v_row.kind = 'refund' then 'refund.voided'
    when v_row.kind in ('transfer_in','transfer_out') then 'transfer.voided'
    when v_row.kind in ('owner_deposit','owner_withdrawal') then 'owner_movement.voided'
    else 'income.voided' end;

  perform private.write_audit(v_row.business_id, v_action,
    case when v_row.kind = 'expense' then 'expenses' when v_row.kind = 'income' then 'income' else 'transactions' end,
    'transaction', v_row.id,
    format('Voided %s (%s) - %s', v_row.description, private.fmt_money(v_row.business_id, v_row.amount), btrim(p_reason)),
    null, jsonb_build_object('reason', btrim(p_reason), 'reference_no', v_row.reference_no,
                             'business_date', v_row.business_date, 'closed_day', v_closed));

  if v_closed then
    perform private.write_audit(v_row.business_id, 'closing.corrected', 'closings', 'closing', v_closing_id,
      format('Correction on a closed day: voided %s (%s)', v_row.description,
             private.fmt_money(v_row.business_id, v_row.amount)),
      null, jsonb_build_object('transaction_id', v_row.id, 'reason', btrim(p_reason),
                               'business_date', v_row.business_date));
  end if;

  return query select * from public.financial_transactions t
    where t.id = v_row.id or (v_row.transfer_group_id is not null and t.transfer_group_id = v_row.transfer_group_id);
end $$;

-- Deactivating a customer needs its own permission (admin only).
create or replace function public.set_customer_status(p_customer_id uuid, p_status public.record_status)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.customers;
begin
  select * into v_row from public.customers c where c.id = p_customer_id;
  if not found then perform private.raise_error('NOT_FOUND', 'That customer no longer exists.'); end if;
  perform private.assert_permission(v_row.business_id, 'customers.deactivate');
  update public.customers set status = p_status where id = p_customer_id returning * into v_row;
  perform private.write_audit(v_row.business_id,
    case when p_status = 'active' then 'customer.reactivated' else 'customer.deactivated' end,
    'customers', 'customer', v_row.id,
    format('Customer %s set to %s', v_row.full_name, p_status));
  return v_row;
end $$;

-- The session context lists the role's permissions.
create or replace function public.get_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_profile public.profiles; v_memberships jsonb;
begin
  if v_uid is null then
    perform private.raise_error('PERMISSION_DENIED', 'You must be signed in.');
  end if;
  select * into v_profile from public.profiles p where p.id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', m.id, 'business_id', b.id, 'business_name', b.name, 'logo_path', b.logo_path,
    'role', m.role, 'status', m.status, 'title', m.title,
    'is_demo', b.is_demo, 'go_live_date', b.go_live_date,
    'onboarding_completed', b.onboarding_completed_at is not null,
    'business_date', private.current_business_date(b.id),
    'settings', to_jsonb(s) - 'updated_by',
    'permissions', case when m.role = 'owner'
      then (select coalesce(jsonb_agg(p2.key), '[]'::jsonb) from public.permissions p2)
      else (select coalesce(jsonb_agg(p2.key), '[]'::jsonb) from public.permissions p2 where p2.staff_allowed) end)
    order by b.name), '[]'::jsonb)
  into v_memberships
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  join public.business_settings s on s.business_id = b.id
  where m.user_id = v_uid and m.status = 'active';

  return jsonb_build_object(
    'user', jsonb_build_object('id', v_uid, 'email', (select email from auth.users where id = v_uid),
      'full_name', v_profile.full_name, 'phone', v_profile.phone,
      'preferred_language', v_profile.preferred_language, 'theme_preference', v_profile.theme_preference,
      'must_change_password', v_profile.must_change_password),
    'memberships', v_memberships);
end $$;

-- Employee positions offered in the employee form, editable by the admin.
alter table public.business_settings
  add column if not exists employee_positions text[] not null
  default array['Macallinka', 'Macallimada Dumarka', 'Nadaafada', 'Maamulka Xafiiska']::text[];

create or replace function public.update_business_settings(p_business_id uuid, p_patch jsonb)
returns public.business_settings
language plpgsql
security definer
set search_path = ''
as $$
declare v_old public.business_settings; v_row public.business_settings; v_positions text[];
begin
  perform private.assert_permission(p_business_id, 'settings.manage');
  select * into v_old from public.business_settings s where s.business_id = p_business_id;
  if (p_patch ? 'currency_code' or p_patch ? 'currency_decimals')
     and exists (select 1 from public.financial_transactions t where t.business_id = p_business_id)
     and (coalesce(p_patch ->> 'currency_code', v_old.currency_code) <> v_old.currency_code
          or coalesce((p_patch ->> 'currency_decimals')::smallint, v_old.currency_decimals) <> v_old.currency_decimals) then
    perform private.raise_error('CURRENCY_LOCKED', 'Currency cannot change after transactions are recorded.');
  end if;

  if p_patch ? 'employee_positions' then
    if jsonb_typeof(p_patch -> 'employee_positions') <> 'array' then
      perform private.raise_error('INVALID_INPUT', 'Positions must be a list.');
    end if;
    select coalesce(array_agg(x.name order by x.ord), '{}') into v_positions
    from (
      select distinct on (lower(btrim(e.value))) btrim(e.value) as name, e.ord
      from jsonb_array_elements_text(p_patch -> 'employee_positions') with ordinality as e(value, ord)
      where btrim(e.value) <> ''
      order by lower(btrim(e.value)), e.ord
    ) x;
    if cardinality(v_positions) = 0 then
      perform private.raise_error('INVALID_INPUT', 'Keep at least one employee position.');
    end if;
    if cardinality(v_positions) > 30
       or exists (select 1 from unnest(v_positions) as p(name) where char_length(p.name) > 60) then
      perform private.raise_error('INVALID_INPUT', 'Use at most 30 positions, each up to 60 characters.');
    end if;
  end if;

  update public.business_settings s set
    currency_code = coalesce(upper(nullif(btrim(coalesce(p_patch ->> 'currency_code','')),'')), s.currency_code),
    currency_symbol = coalesce(nullif(btrim(coalesce(p_patch ->> 'currency_symbol','')),''), s.currency_symbol),
    currency_decimals = coalesce((p_patch ->> 'currency_decimals')::smallint, s.currency_decimals),
    locale = coalesce(nullif(btrim(coalesce(p_patch ->> 'locale','')),''), s.locale),
    timezone = coalesce(nullif(btrim(coalesce(p_patch ->> 'timezone','')),''), s.timezone),
    day_cutoff = coalesce((p_patch ->> 'day_cutoff')::time, s.day_cutoff),
    week_starts_on = coalesce((p_patch ->> 'week_starts_on')::smallint, s.week_starts_on),
    invoice_prefix = coalesce(upper(nullif(btrim(coalesce(p_patch ->> 'invoice_prefix','')),'')), s.invoice_prefix),
    invoice_footer = case when p_patch ? 'invoice_footer' then nullif(btrim(coalesce(p_patch ->> 'invoice_footer','')),'') else s.invoice_footer end,
    invoice_default_due_days = case when p_patch ? 'invoice_default_due_days' then (p_patch ->> 'invoice_default_due_days')::smallint else s.invoice_default_due_days end,
    large_amount_threshold = coalesce((p_patch ->> 'large_amount_threshold')::numeric, s.large_amount_threshold),
    staff_edit_window_minutes = coalesce((p_patch ->> 'staff_edit_window_minutes')::smallint, s.staff_edit_window_minutes),
    idle_timeout_minutes = coalesce((p_patch ->> 'idle_timeout_minutes')::smallint, s.idle_timeout_minutes),
    employee_positions = coalesce(v_positions, s.employee_positions),
    updated_by = (select auth.uid())
  where s.business_id = p_business_id returning * into v_row;
  perform private.write_audit(p_business_id, 'settings.preferences_updated', 'settings', 'business', p_business_id,
    'Financial preferences updated', p_patch);
  return v_row;
end $$;
