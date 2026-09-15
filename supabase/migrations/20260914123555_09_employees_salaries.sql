-- GYMATICK 09: employees, salary rate history, salary payments (one expense each)
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  position text not null check (char_length(btrim(position)) between 1 and 60),
  start_date date not null,
  end_date date,
  status public.record_status not null default 'active',
  profile_id uuid references public.profiles(id),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  constraint emp_branch_fk foreign key (business_id, branch_id) references public.branches (business_id, id),
  constraint emp_dates check (end_date is null or end_date >= start_date),
  constraint emp_inactive_end check (status = 'active' or end_date is not null)
);
create index employees_list_idx on public.employees (business_id, status, full_name);
create index employees_branch_idx on public.employees (branch_id);
create index employees_profile_idx on public.employees (profile_id);
create trigger employees_updated before update on public.employees for each row execute function private.set_updated_at();

create table public.employee_salary_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  employee_id uuid not null,
  monthly_salary numeric(14,2) not null check (monthly_salary >= 0 and monthly_salary <= 999999999999.99),
  effective_month date not null check (extract(day from effective_month) = 1),
  reason text check (reason is null or char_length(reason) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, effective_month),
  constraint rate_employee_fk foreign key (business_id, employee_id) references public.employees (business_id, id)
);
create index salary_rates_idx on public.employee_salary_rates (employee_id, effective_month desc);

create table public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  employee_id uuid not null,
  period_month date not null check (extract(day from period_month) = 1),
  payment_type public.salary_payment_type not null default 'salary',
  transaction_id uuid not null unique,
  reason text check (reason is null or char_length(reason) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  constraint sp_employee_fk foreign key (business_id, employee_id) references public.employees (business_id, id),
  constraint sp_transaction_fk foreign key (business_id, transaction_id) references public.financial_transactions (business_id, id),
  constraint sp_adjustment_reason check (payment_type <> 'adjustment' or char_length(btrim(coalesce(reason, ''))) >= 5)
);
create index salary_payments_period_idx on public.salary_payments (employee_id, period_month);
create index salary_payments_business_idx on public.salary_payments (business_id, period_month);
create trigger salary_payments_updated before update on public.salary_payments for each row execute function private.set_updated_at();

-- a salary expense can never exist without its salary payment
create or replace function private.ensure_salary_link()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.salary_payments sp where sp.transaction_id = new.id) then
    perform private.raise_error('SALARY_LINK_MISSING', 'Salary expenses must be created through Pay salary.');
  end if;
  return null;
end $$;
create constraint trigger financial_transactions_salary_link
after insert on public.financial_transactions
deferrable initially deferred
for each row when (new.is_salary) execute function private.ensure_salary_link();

revoke all on public.employees, public.employee_salary_rates, public.salary_payments from anon, authenticated;
grant select on public.employees, public.employee_salary_rates, public.salary_payments to authenticated;
alter table public.employees enable row level security;
alter table public.employee_salary_rates enable row level security;
alter table public.salary_payments enable row level security;

create policy employees_select on public.employees for select to authenticated
  using (business_id in (select private.businesses_with_permission('employees.view')));
create policy salary_rates_select on public.employee_salary_rates for select to authenticated
  using (business_id in (select private.businesses_with_permission('salaries.view')));
create policy salary_payments_select on public.salary_payments for select to authenticated
  using (business_id in (select private.businesses_with_permission('salaries.view')));

-- helpers --------------------------------------------------------------------
create or replace function private.salary_obligation(p_employee_id uuid, p_period date)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.monthly_salary from public.employee_salary_rates r
    where r.employee_id = p_employee_id and r.effective_month <= p_period
    order by r.effective_month desc limit 1), 0)
$$;

create or replace function private.salary_paid(p_employee_id uuid, p_period date)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(t.amount), 0)
  from public.salary_payments sp
  join public.financial_transactions t on t.id = sp.transaction_id
  where sp.employee_id = p_employee_id and sp.period_month = p_period and t.status = 'posted'
$$;

create or replace function public.create_employee(
  p_business_id uuid, p_full_name text, p_position text, p_start_date date,
  p_monthly_salary numeric, p_phone text default null, p_notes text default null)
returns public.employees language plpgsql security definer set search_path = '' as $$
declare v_emp public.employees; v_branch uuid;
begin
  perform private.assert_permission(p_business_id, 'employees.manage');
  perform private.assert_permission(p_business_id, 'salaries.view');
  if p_monthly_salary is null or p_monthly_salary < 0 then
    perform private.raise_error('INVALID_AMOUNT', 'Enter a monthly salary of 0 or more.');
  end if;
  v_branch := private.default_branch_id(p_business_id);
  insert into public.employees (business_id, branch_id, full_name, position, start_date, phone, notes, created_by)
  values (p_business_id, v_branch, btrim(p_full_name), btrim(p_position), p_start_date,
          nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''), (select auth.uid()))
  returning * into v_emp;

  insert into public.employee_salary_rates (business_id, employee_id, monthly_salary, effective_month, reason, created_by)
  values (p_business_id, v_emp.id, round(p_monthly_salary, 2), date_trunc('month', p_start_date)::date,
          'Starting salary', (select auth.uid()));

  perform private.write_audit(p_business_id, 'employee.created', 'employees', 'employee', v_emp.id,
    format('Added employee %s (%s) at %s per month', v_emp.full_name, v_emp.position,
           private.fmt_money(p_business_id, p_monthly_salary)));
  return v_emp;
end $$;

create or replace function public.update_employee(p_employee_id uuid, p_patch jsonb)
returns public.employees language plpgsql security definer set search_path = '' as $$
declare v_old public.employees; v_new public.employees;
begin
  select * into v_old from public.employees e where e.id = p_employee_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That employee no longer exists.'); end if;
  perform private.assert_permission(v_old.business_id, 'employees.manage');
  update public.employees e set
    full_name = coalesce(nullif(btrim(coalesce(p_patch ->> 'full_name', '')), ''), e.full_name),
    position  = coalesce(nullif(btrim(coalesce(p_patch ->> 'position', '')), ''), e.position),
    phone     = case when p_patch ? 'phone' then nullif(btrim(coalesce(p_patch ->> 'phone','')), '') else e.phone end,
    notes     = case when p_patch ? 'notes' then nullif(btrim(coalesce(p_patch ->> 'notes','')), '') else e.notes end,
    start_date = coalesce((p_patch ->> 'start_date')::date, e.start_date),
    updated_by = (select auth.uid())
  where e.id = p_employee_id returning * into v_new;
  perform private.write_audit(v_old.business_id, 'employee.updated', 'employees', 'employee', v_new.id,
    format('Updated employee %s', v_new.full_name));
  return v_new;
end $$;

create or replace function public.change_employee_salary(
  p_employee_id uuid, p_monthly_salary numeric, p_effective_month date, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_emp public.employees; v_month date; v_previous numeric;
begin
  select * into v_emp from public.employees e where e.id = p_employee_id;
  if not found then perform private.raise_error('NOT_FOUND', 'That employee no longer exists.'); end if;
  perform private.assert_permission(v_emp.business_id, 'employees.manage');
  perform private.assert_permission(v_emp.business_id, 'salaries.view');
  if p_monthly_salary is null or p_monthly_salary < 0 then
    perform private.raise_error('INVALID_AMOUNT', 'Enter a monthly salary of 0 or more.');
  end if;
  v_month := date_trunc('month', coalesce(p_effective_month, private.current_business_date(v_emp.business_id)))::date;
  v_previous := private.salary_obligation(p_employee_id, v_month);

  insert into public.employee_salary_rates (business_id, employee_id, monthly_salary, effective_month, reason, created_by)
  values (v_emp.business_id, p_employee_id, round(p_monthly_salary, 2), v_month,
          nullif(btrim(coalesce(p_reason, '')), ''), (select auth.uid()))
  on conflict (employee_id, effective_month)
  do update set monthly_salary = excluded.monthly_salary, reason = excluded.reason, created_by = excluded.created_by;

  perform private.write_audit(v_emp.business_id, 'employee.salary_changed', 'employees', 'employee', p_employee_id,
    format('%s salary set to %s from %s', v_emp.full_name,
           private.fmt_money(v_emp.business_id, p_monthly_salary), to_char(v_month, 'Mon YYYY')),
    jsonb_build_object('monthly_salary', jsonb_build_object('from', v_previous, 'to', round(p_monthly_salary, 2))),
    jsonb_build_object('effective_month', v_month, 'reason', p_reason));
  return jsonb_build_object('employee_id', p_employee_id, 'effective_month', v_month,
    'monthly_salary', round(p_monthly_salary, 2), 'previous', v_previous);
end $$;

create or replace function public.set_employee_status(
  p_employee_id uuid, p_status public.record_status, p_end_date date default null, p_reason text default null)
returns public.employees language plpgsql security definer set search_path = '' as $$
declare v_emp public.employees; v_new public.employees;
begin
  select * into v_emp from public.employees e where e.id = p_employee_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That employee no longer exists.'); end if;
  perform private.assert_permission(v_emp.business_id, 'employees.manage');
  if p_status = 'inactive' and p_end_date is null then
    perform private.raise_error('INVALID_INPUT', 'Choose the last working day.');
  end if;
  update public.employees e
  set status = p_status,
      end_date = case when p_status = 'inactive' then p_end_date else null end,
      updated_by = (select auth.uid())
  where e.id = p_employee_id returning * into v_new;
  perform private.write_audit(v_emp.business_id,
    case when p_status = 'inactive' then 'employee.deactivated' else 'employee.reactivated' end,
    'employees', 'employee', p_employee_id,
    format('%s %s', v_emp.full_name, case when p_status = 'inactive' then 'deactivated' else 'reactivated' end),
    null, jsonb_build_object('end_date', p_end_date, 'reason', p_reason));
  return v_new;
end $$;

create or replace function public.get_salary_overview(p_business_id uuid, p_period_month date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_period date; v_start date; v_rows jsonb; v_arrears numeric := 0; v_arrears_rows jsonb;
  v_oblig numeric := 0; v_paid numeric := 0;
begin
  perform private.assert_permission(p_business_id, 'salaries.view');
  v_period := date_trunc('month', coalesce(p_period_month, private.current_business_date(p_business_id)))::date;
  select coalesce(s.salary_tracking_start_month, v_period) into v_start
  from public.business_settings s where s.business_id = p_business_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'employee_id', x.id, 'full_name', x.full_name, 'position', x.position,
           'status', x.status, 'monthly_salary', x.obligation, 'paid', x.paid,
           'remaining', greatest(x.obligation - x.paid, 0),
           'state', case when x.obligation = 0 then 'none'
                         when x.paid >= x.obligation then 'paid'
                         when x.paid > 0 then 'partial' else 'unpaid' end,
           'last_payment_at', x.last_payment_at, 'last_payment_method', x.last_method)
           order by x.full_name), '[]'::jsonb),
         coalesce(sum(x.obligation), 0), coalesce(sum(x.paid), 0)
  into v_rows, v_oblig, v_paid
  from (
    select e.id, e.full_name, e.position, e.status,
      private.salary_obligation(e.id, v_period) as obligation,
      private.salary_paid(e.id, v_period) as paid,
      (select max(t.business_date) from public.salary_payments sp
        join public.financial_transactions t on t.id = sp.transaction_id
        where sp.employee_id = e.id and sp.period_month = v_period and t.status = 'posted') as last_payment_at,
      (select pm.name from public.salary_payments sp
        join public.financial_transactions t on t.id = sp.transaction_id
        join public.payment_methods pm on pm.id = t.payment_method_id
        where sp.employee_id = e.id and sp.period_month = v_period and t.status = 'posted'
        order by t.business_date desc limit 1) as last_method
    from public.employees e
    where e.business_id = p_business_id
      and e.start_date <= (v_period + interval '1 month - 1 day')::date
      and (e.end_date is null or e.end_date >= v_period)
  ) x;

  select coalesce(sum(greatest(private.salary_obligation(e.id, m.month) - private.salary_paid(e.id, m.month), 0)), 0),
         coalesce(jsonb_agg(distinct jsonb_build_object('month', m.month)) filter (
           where private.salary_obligation(e.id, m.month) - private.salary_paid(e.id, m.month) > 0), '[]'::jsonb)
  into v_arrears, v_arrears_rows
  from public.employees e
  cross join lateral (
    select generate_series(v_start, (v_period - interval '1 month')::date, interval '1 month')::date as month) m
  where e.business_id = p_business_id
    and e.start_date <= (m.month + interval '1 month - 1 day')::date
    and (e.end_date is null or e.end_date >= m.month);

  return jsonb_build_object(
    'period_month', v_period, 'employees', v_rows,
    'totals', jsonb_build_object('obligations', v_oblig, 'paid', v_paid,
      'pending', greatest(v_oblig - v_paid, 0),
      'employee_count', jsonb_array_length(v_rows),
      'unpaid_count', (select count(*) from jsonb_array_elements(v_rows) r
                       where (r ->> 'remaining')::numeric > 0)),
    'arrears', jsonb_build_object('total', v_arrears, 'months', v_arrears_rows, 'since', v_start));
end $$;

create or replace function public.pay_salary(
  p_employee_id uuid, p_period_month date, p_amount numeric, p_payment_method_id uuid,
  p_idempotency_key uuid, p_payment_type public.salary_payment_type default 'salary',
  p_business_date date default null, p_notes text default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.employees; v_period date; v_obligation numeric; v_paid numeric;
  v_category uuid; v_tx public.financial_transactions; v_payment public.salary_payments;
  v_last record; v_existing public.salary_payments;
begin
  select * into v_emp from public.employees e where e.id = p_employee_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That employee no longer exists.'); end if;
  perform private.assert_permission(v_emp.business_id, 'salaries.pay');
  if p_payment_type = 'adjustment' then
    perform private.assert_permission(v_emp.business_id, 'salaries.adjust');
    if char_length(btrim(coalesce(p_reason, ''))) < 5 then
      perform private.raise_error('REASON_REQUIRED', 'Give a reason for the adjustment (at least 5 characters).');
    end if;
  end if;

  select sp.* into v_existing from public.salary_payments sp
  join public.financial_transactions t on t.id = sp.transaction_id
  where t.business_id = v_emp.business_id and t.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('salary_payment_id', v_existing.id, 'transaction_id', v_existing.transaction_id, 'replayed', true);
  end if;

  v_period := date_trunc('month', coalesce(p_period_month, private.current_business_date(v_emp.business_id)))::date;
  if v_emp.start_date > (v_period + interval '1 month - 1 day')::date
     or (v_emp.end_date is not null and v_emp.end_date < v_period) then
    perform private.raise_error('EMPLOYEE_NOT_ELIGIBLE',
      format('%s was not employed in %s.', v_emp.full_name, to_char(v_period, 'Mon YYYY')));
  end if;

  v_obligation := private.salary_obligation(p_employee_id, v_period);
  v_paid := private.salary_paid(p_employee_id, v_period);

  if p_payment_type in ('salary','advance') and p_amount > v_obligation - v_paid then
    select t.business_date as paid_on, p.full_name as paid_by into v_last
    from public.salary_payments sp
    join public.financial_transactions t on t.id = sp.transaction_id
    left join public.profiles p on p.id = t.created_by
    where sp.employee_id = p_employee_id and sp.period_month = v_period and t.status = 'posted'
    order by t.created_at desc limit 1;
    perform private.raise_error('SALARY_EXCEEDS_REMAINING',
      format('%s has only %s left for %s.', v_emp.full_name,
             private.fmt_money(v_emp.business_id, greatest(v_obligation - v_paid, 0)), to_char(v_period, 'Mon YYYY')),
      jsonb_build_object('obligation', v_obligation, 'paid', v_paid,
        'remaining', greatest(v_obligation - v_paid, 0),
        'last_paid_on', v_last.paid_on, 'last_paid_by', v_last.paid_by));
  end if;

  select c.id into v_category from public.categories c
  where c.business_id = v_emp.business_id and c.system_code = 'salary';
  if v_category is null then
    perform private.raise_error('SETUP_INCOMPLETE', 'The Salary category is missing.');
  end if;

  v_tx := private.create_transaction(
    p_business_id => v_emp.business_id, p_kind => 'expense', p_amount => p_amount,
    p_payment_method_id => p_payment_method_id, p_idempotency_key => p_idempotency_key,
    p_category_id => v_category, p_business_date => p_business_date,
    p_description => format('Salary - %s - %s', v_emp.full_name, to_char(v_period, 'Mon YYYY')),
    p_notes => p_notes, p_vendor => v_emp.full_name, p_is_salary => true, p_allow_system_category => true);

  insert into public.salary_payments (business_id, employee_id, period_month, payment_type, transaction_id, reason, created_by)
  values (v_emp.business_id, p_employee_id, v_period, p_payment_type, v_tx.id,
          nullif(btrim(coalesce(p_reason, '')), ''), (select auth.uid()))
  returning * into v_payment;

  perform private.write_audit(v_emp.business_id,
    case when p_payment_type = 'adjustment' then 'salary.adjusted' else 'salary.paid' end,
    'salaries', 'salary_payment', v_payment.id,
    format('Paid %s to %s for %s (%s)', private.fmt_money(v_emp.business_id, p_amount), v_emp.full_name,
           to_char(v_period, 'Mon YYYY'), p_payment_type),
    null, jsonb_build_object('transaction_id', v_tx.id, 'period_month', v_period,
      'reference_no', v_tx.reference_no, 'reason', p_reason));

  return jsonb_build_object('salary_payment_id', v_payment.id, 'transaction_id', v_tx.id,
    'reference_no', v_tx.reference_no, 'business_date', v_tx.business_date,
    'period_month', v_period, 'amount', v_tx.amount,
    'obligation', v_obligation, 'paid_after', v_paid + p_amount);
end $$;

grant execute on function public.create_employee(uuid, text, text, date, numeric, text, text) to authenticated;
grant execute on function public.update_employee(uuid, jsonb) to authenticated;
grant execute on function public.change_employee_salary(uuid, numeric, date, text) to authenticated;
grant execute on function public.set_employee_status(uuid, public.record_status, date, text) to authenticated;
grant execute on function public.get_salary_overview(uuid, date) to authenticated;
grant execute on function public.pay_salary(uuid, date, numeric, uuid, uuid, public.salary_payment_type, date, text, text) to authenticated;
revoke all on function public.create_employee(uuid, text, text, date, numeric, text, text) from anon;
revoke all on function public.update_employee(uuid, jsonb) from anon;
revoke all on function public.change_employee_salary(uuid, numeric, date, text) from anon;
revoke all on function public.set_employee_status(uuid, public.record_status, date, text) from anon;
revoke all on function public.get_salary_overview(uuid, date) from anon;
revoke all on function public.pay_salary(uuid, date, numeric, uuid, uuid, public.salary_payment_type, date, text, text) from anon;
revoke all on function private.salary_obligation(uuid, date) from public;
revoke all on function private.salary_paid(uuid, date) from public;
