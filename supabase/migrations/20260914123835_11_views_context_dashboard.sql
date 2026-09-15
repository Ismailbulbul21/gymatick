-- GYMATICK 11: list views, session context, dashboard
create view public.v_transactions with (security_invoker = true) as
select
  t.id, t.business_id, t.branch_id, t.reference_no,
  'TX-' || lpad(t.reference_no::text, 6, '0') as reference_label,
  t.kind, t.status, t.amount, t.signed_amount, t.business_date, t.occurred_at, t.is_backdated,
  t.description, t.notes, t.vendor, t.is_salary, t.category_id, c.name as category_name, c.color as category_color,
  t.payment_method_id, pm.name as payment_method_name, pm.type as payment_method_type,
  t.customer_id, cu.full_name as customer_name,
  t.invoice_id, i.invoice_number,
  t.related_transaction_id, t.transfer_group_id,
  sp.id as salary_payment_id, sp.period_month as salary_period, e.full_name as employee_name,
  t.created_by, cp.full_name as created_by_name, t.created_at,
  t.voided_by, vp.full_name as voided_by_name, t.voided_at, t.void_reason, t.updated_at
from public.financial_transactions t
left join public.categories c on c.id = t.category_id
join public.payment_methods pm on pm.id = t.payment_method_id
left join public.customers cu on cu.id = t.customer_id
left join public.invoices i on i.id = t.invoice_id
left join public.salary_payments sp on sp.transaction_id = t.id
left join public.employees e on e.id = sp.employee_id
left join public.profiles cp on cp.id = t.created_by
left join public.profiles vp on vp.id = t.voided_by;

create view public.v_invoices with (security_invoker = true) as
select i.*, (i.total - i.amount_paid) as balance_due,
  coalesce(i.bill_to_name, cu.full_name) as customer_display_name,
  c.name as category_name, p.full_name as created_by_name
from public.invoices i
left join public.customers cu on cu.id = i.customer_id
left join public.categories c on c.id = i.income_category_id
left join public.profiles p on p.id = i.created_by;

create view public.v_employees with (security_invoker = true) as
select e.*,
  coalesce((select r.monthly_salary from public.employee_salary_rates r
            where r.employee_id = e.id and r.effective_month <= date_trunc('month', current_date)::date
            order by r.effective_month desc limit 1), 0) as current_monthly_salary
from public.employees e;

create view public.v_salary_payments with (security_invoker = true) as
select sp.id, sp.business_id, sp.employee_id, e.full_name as employee_name, e.position,
  sp.period_month, sp.payment_type, sp.reason, sp.created_at,
  t.id as transaction_id, 'TX-' || lpad(t.reference_no::text, 6, '0') as reference_label,
  t.amount, t.business_date, t.status, pm.name as payment_method_name,
  p.full_name as created_by_name
from public.salary_payments sp
join public.employees e on e.id = sp.employee_id
join public.financial_transactions t on t.id = sp.transaction_id
join public.payment_methods pm on pm.id = t.payment_method_id
left join public.profiles p on p.id = sp.created_by;

create view public.v_closings with (security_invoker = true) as
select c.*, p.full_name as closed_by_name, rp.full_name as reopened_by_name,
  exists (select 1 from public.financial_transactions t
          where t.business_id = c.business_id and t.branch_id = c.branch_id
            and t.business_date between c.period_start and c.business_date
            and t.status = 'voided' and t.voided_at > c.closed_at) as has_corrections
from public.daily_closings c
left join public.profiles p on p.id = c.closed_by
left join public.profiles rp on rp.id = c.reopened_by;

grant select on public.v_transactions, public.v_invoices, public.v_employees,
  public.v_salary_payments, public.v_closings to authenticated;
revoke all on public.v_transactions, public.v_invoices, public.v_employees,
  public.v_salary_payments, public.v_closings from anon;

-- session context ------------------------------------------------------------
create or replace function public.get_my_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
      else (select coalesce(jsonb_agg(mp.permission_key), '[]'::jsonb)
            from public.member_permissions mp where mp.member_id = m.id) end)
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

create or replace function public.record_sign_in(p_business_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_member uuid; v_last timestamptz;
begin
  v_member := private.assert_member(p_business_id);
  select m.last_sign_in_at into v_last from public.business_members m where m.id = v_member;
  update public.business_members set last_sign_in_at = now() where id = v_member;
  if v_last is null or now() - v_last > interval '30 minutes' then
    perform private.write_audit(p_business_id, 'auth.login', 'auth', 'member', v_member, 'Signed in');
  end if;
end $$;

-- dashboard ------------------------------------------------------------------
create or replace function public.get_dashboard_summary(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date; v_branch uuid; v_can_income boolean; v_can_expense boolean; v_can_salary boolean;
  v_can_fin boolean; v_can_closings boolean; v_income numeric; v_refunds numeric; v_expenses numeric;
  v_salaries numeric; v_count integer; v_next jsonb; v_balances jsonb; v_salary jsonb;
  v_last public.v_closings; v_today_closing public.daily_closings; v_unclosed integer; v_cdate date;
  v_outstanding jsonb;
begin
  perform private.assert_member(p_business_id);
  v_today := private.current_business_date(p_business_id);
  v_branch := private.default_branch_id(p_business_id);
  v_can_income := private.has_permission(p_business_id, 'income.view');
  v_can_expense := private.has_permission(p_business_id, 'expenses.view');
  v_can_salary := private.has_permission(p_business_id, 'salaries.view');
  v_can_fin := private.has_permission(p_business_id, 'dashboard.financials');
  v_can_closings := private.has_permission(p_business_id, 'closings.view');

  select
    coalesce(sum(t.amount) filter (where t.kind = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'expense' and t.is_salary), 0),
    count(*) filter (where t.kind <> 'transfer_in')
  into v_income, v_refunds, v_expenses, v_salaries, v_count
  from public.financial_transactions t
  where t.business_id = p_business_id and t.status = 'posted' and t.business_date = v_today;

  select checkpoint_date into v_cdate from private.last_checkpoint(p_business_id, v_branch);
  select * into v_today_closing from public.daily_closings c
  where c.business_id = p_business_id and c.branch_id = v_branch and c.status = 'closed'
    and c.period_start <= v_today and c.business_date >= v_today limit 1;

  if v_today_closing.id is not null then
    select jsonb_build_object('business_date', v_today + 1,
      'income', coalesce(sum(t.amount) filter (where t.kind = 'income'), 0),
      'expenses', coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0),
      'count', count(*) filter (where t.kind <> 'transfer_in'))
    into v_next
    from public.financial_transactions t
    where t.business_id = p_business_id and t.status = 'posted' and t.business_date = v_today + 1;
  end if;

  if v_can_fin then
    v_balances := private.current_balances(p_business_id, v_branch);
    select jsonb_build_object('total', coalesce(sum(i.total - i.amount_paid), 0), 'count', count(*))
    into v_outstanding
    from public.invoices i
    where i.business_id = p_business_id and i.status in ('pending','partially_paid');
  end if;

  if v_can_salary then
    v_salary := public.get_salary_overview(p_business_id, date_trunc('month', v_today)::date) -> 'totals';
  end if;

  if v_can_closings then
    select * into v_last from public.v_closings c
    where c.business_id = p_business_id and c.branch_id = v_branch and c.kind = 'daily' and c.status = 'closed'
    order by c.business_date desc limit 1;
  end if;

  select count(*) into v_unclosed
  from generate_series(coalesce(v_cdate, v_today) + 1, v_today - 1, interval '1 day') d
  where exists (select 1 from public.financial_transactions t
                where t.business_id = p_business_id and t.status = 'posted' and t.business_date = d::date);

  return jsonb_build_object(
    'business_date', v_today,
    'today', jsonb_build_object(
      'income', case when v_can_income then v_income - v_refunds end,
      'gross_income', case when v_can_income then v_income end,
      'refunds', case when v_can_income then v_refunds end,
      'expenses', case when v_can_expense then v_expenses end,
      'salaries', case when v_can_salary then v_salaries end,
      'net', case when v_can_income and v_can_expense then (v_income - v_refunds - v_expenses) end,
      'transaction_count', v_count),
    'after_close', v_next,
    'balance', v_balances,
    'outstanding_invoices', v_outstanding,
    'pending_salaries', v_salary,
    'closing_status', jsonb_build_object(
      'is_closed', v_today_closing.id is not null,
      'closed_at', v_today_closing.closed_at,
      'difference_total', case when v_can_closings then v_today_closing.difference_total end,
      'is_balanced', case when v_can_closings then v_today_closing.is_balanced end,
      'unclosed_days_with_activity', v_unclosed,
      'last_checkpoint_date', v_cdate),
    'last_closing', case when v_can_closings and v_last.id is not null then jsonb_build_object(
      'id', v_last.id, 'business_date', v_last.business_date, 'period_start', v_last.period_start,
      'opening_total', v_last.opening_total, 'money_in_total', v_last.money_in_total,
      'money_out_total', v_last.money_out_total, 'expected_total', v_last.expected_total,
      'actual_total', v_last.actual_total, 'difference_total', v_last.difference_total,
      'is_balanced', v_last.is_balanced, 'notes', v_last.notes,
      'closed_by_name', v_last.closed_by_name, 'closed_at', v_last.closed_at) end,
    'permissions', jsonb_build_object('income', v_can_income, 'expenses', v_can_expense,
      'salaries', v_can_salary, 'financials', v_can_fin, 'closings', v_can_closings));
end $$;

create or replace function public.get_cashflow_series(p_business_id uuid, p_from date, p_to date)
returns table (day date, income numeric, expenses numeric, net numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_permission(p_business_id, 'income.view');
  perform private.assert_permission(p_business_id, 'expenses.view');
  if p_to - p_from > 366 then
    perform private.raise_error('RANGE_TOO_LARGE', 'Choose a range of one year or less.');
  end if;
  return query
  select d::date,
    coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
      - coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0) as income,
    coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0) as expenses,
    coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
      - coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0)
      - coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0) as net
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.financial_transactions t
    on t.business_id = p_business_id and t.status = 'posted' and t.business_date = d::date
  group by d order by d;
end $$;

grant execute on function public.get_my_context() to authenticated;
grant execute on function public.record_sign_in(uuid) to authenticated;
grant execute on function public.get_dashboard_summary(uuid) to authenticated;
grant execute on function public.get_cashflow_series(uuid, date, date) to authenticated;
revoke all on function public.get_my_context() from anon;
revoke all on function public.record_sign_in(uuid) from anon;
revoke all on function public.get_dashboard_summary(uuid) from anon;
revoke all on function public.get_cashflow_series(uuid, date, date) from anon;
