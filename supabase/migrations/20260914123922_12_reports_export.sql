-- GYMATICK 12: reports and CSV export
create or replace function private.period_totals(p_business_id uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'gross_income', coalesce(sum(t.amount) filter (where t.kind = 'income'), 0),
    'refunds', coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0),
    'income', coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
              - coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0),
    'expenses', coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0),
    'salaries', coalesce(sum(t.amount) filter (where t.kind = 'expense' and t.is_salary), 0),
    'owner_deposits', coalesce(sum(t.amount) filter (where t.kind = 'owner_deposit'), 0),
    'owner_withdrawals', coalesce(sum(t.amount) filter (where t.kind = 'owner_withdrawal'), 0),
    'transfers', coalesce(sum(t.amount) filter (where t.kind = 'transfer_out'), 0),
    'net', coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
           - coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0)
           - coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0),
    'transaction_count', count(*) filter (where t.kind <> 'transfer_in'))
  from public.financial_transactions t
  where t.business_id = p_business_id and t.status = 'posted'
    and t.business_date between p_from and p_to
$$;

create or replace function public.get_report(p_business_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_totals jsonb; v_prev jsonb; v_days integer; v_today date; v_elapsed integer;
  v_grain text; v_series jsonb; v_income_cats jsonb; v_expense_cats jsonb; v_methods jsonb;
  v_closings jsonb; v_outstanding jsonb;
begin
  perform private.assert_permission(p_business_id, 'reports.view');
  if p_to < p_from then
    perform private.raise_error('INVALID_INPUT', 'The end date must be after the start date.');
  end if;
  if p_to - p_from > 1100 then
    perform private.raise_error('RANGE_TOO_LARGE', 'Choose a range of three years or less.');
  end if;

  v_today := private.current_business_date(p_business_id);
  v_days := (p_to - p_from) + 1;
  v_elapsed := greatest(least(p_to, v_today) - p_from + 1, 1);
  v_totals := private.period_totals(p_business_id, p_from, p_to);
  v_prev := private.period_totals(p_business_id, p_from - v_days, p_from - 1);
  v_grain := case when v_days <= 62 then 'day' when v_days <= 190 then 'week' else 'month' end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', b.bucket, 'income', b.income, 'expenses', b.expenses, 'net', b.income - b.expenses)
    order by b.bucket), '[]'::jsonb)
  into v_series
  from (
    select date_trunc(v_grain, d)::date as bucket,
      coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
        - coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0) as income,
      coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0) as expenses
    from generate_series(p_from, p_to, interval '1 day') d
    left join public.financial_transactions t
      on t.business_id = p_business_id and t.status = 'posted' and t.business_date = d::date
    group by 1) b;

  select coalesce(jsonb_agg(jsonb_build_object('category_id', x.id, 'name', x.name, 'color', x.color,
    'amount', x.amount, 'count', x.cnt,
    'share', case when x.total > 0 then round(100 * x.amount / x.total, 1) else 0 end) order by x.amount desc), '[]'::jsonb)
  into v_income_cats
  from (
    select c.id, c.name, c.color, sum(t.amount) as amount, count(*) as cnt,
      sum(sum(t.amount)) over () as total
    from public.financial_transactions t join public.categories c on c.id = t.category_id
    where t.business_id = p_business_id and t.status = 'posted' and t.kind = 'income'
      and t.business_date between p_from and p_to
    group by c.id, c.name, c.color) x;

  select coalesce(jsonb_agg(jsonb_build_object('category_id', x.id, 'name', x.name, 'color', x.color,
    'amount', x.amount, 'count', x.cnt,
    'share', case when x.total > 0 then round(100 * x.amount / x.total, 1) else 0 end) order by x.amount desc), '[]'::jsonb)
  into v_expense_cats
  from (
    select c.id, c.name, c.color, sum(t.amount) as amount, count(*) as cnt,
      sum(sum(t.amount)) over () as total
    from public.financial_transactions t join public.categories c on c.id = t.category_id
    where t.business_id = p_business_id and t.status = 'posted' and t.kind = 'expense'
      and t.business_date between p_from and p_to
    group by c.id, c.name, c.color) x;

  select coalesce(jsonb_agg(jsonb_build_object('payment_method_id', pm.id, 'name', pm.name, 'type', pm.type,
    'money_in', coalesce(sum(t.amount) filter (where t.kind = 'income'), 0),
    'money_out', coalesce(sum(t.amount) filter (where t.kind in ('expense','refund')), 0),
    'net', coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
           - coalesce(sum(t.amount) filter (where t.kind in ('expense','refund')), 0))
    order by pm.sort_order), '[]'::jsonb)
  into v_methods
  from public.payment_methods pm
  left join public.financial_transactions t
    on t.payment_method_id = pm.id and t.status = 'posted' and t.business_date between p_from and p_to
  where pm.business_id = p_business_id
  group by pm.id, pm.name, pm.type, pm.sort_order;

  if private.has_permission(p_business_id, 'closings.view') then
    select jsonb_build_object(
      'days_closed', count(*),
      'balanced_days', count(*) filter (where c.is_balanced),
      'days_with_difference', count(*) filter (where not c.is_balanced),
      'difference_total', coalesce(sum(c.difference_total), 0))
    into v_closings
    from public.daily_closings c
    where c.business_id = p_business_id and c.kind = 'daily' and c.status = 'closed'
      and c.business_date between p_from and p_to;
  end if;

  select jsonb_build_object(
    'invoiced', coalesce(sum(i.total), 0),
    'collected', coalesce(sum(i.amount_paid), 0),
    'outstanding', coalesce(sum(i.total - i.amount_paid) filter (where i.status in ('pending','partially_paid')), 0),
    'outstanding_count', count(*) filter (where i.status in ('pending','partially_paid')),
    'invoice_count', count(*) filter (where i.status <> 'cancelled'))
  into v_outstanding
  from public.invoices i
  where i.business_id = p_business_id and i.issue_date between p_from and p_to;

  return jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days,
      'previous_from', p_from - v_days, 'previous_to', p_from - 1, 'today', v_today),
    'totals', v_totals || jsonb_build_object(
      'average_daily_income', round((v_totals ->> 'income')::numeric / v_elapsed, 2)),
    'previous', v_prev,
    'granularity', v_grain, 'series', v_series,
    'income_categories', v_income_cats, 'expense_categories', v_expense_cats,
    'payment_methods', v_methods, 'closings', v_closings, 'invoices', v_outstanding);
end $$;

create or replace function public.export_transactions(
  p_business_id uuid, p_from date, p_to date, p_kinds public.transaction_kind[] default null,
  p_include_voided boolean default false)
returns table (
  business_date date, occurred_at timestamptz, reference text, kind text, status text,
  description text, category text, payment_method text, customer text, vendor text,
  invoice_number text, direction text, amount numeric, recorded_by text, notes text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_permission(p_business_id, 'reports.export');
  if p_to - p_from > 1100 then
    perform private.raise_error('RANGE_TOO_LARGE', 'Choose a range of three years or less.');
  end if;
  return query
  select t.business_date, t.occurred_at, 'TX-' || lpad(t.reference_no::text, 6, '0'),
    t.kind::text, t.status::text, t.description, c.name, pm.name, cu.full_name, t.vendor,
    i.invoice_number,
    case when t.kind in ('income','transfer_in','owner_deposit') then 'in' else 'out' end,
    t.amount, p.full_name, t.notes
  from public.financial_transactions t
  left join public.categories c on c.id = t.category_id
  join public.payment_methods pm on pm.id = t.payment_method_id
  left join public.customers cu on cu.id = t.customer_id
  left join public.invoices i on i.id = t.invoice_id
  left join public.profiles p on p.id = t.created_by
  where t.business_id = p_business_id
    and t.business_date between p_from and p_to
    and (p_include_voided or t.status = 'posted')
    and (p_kinds is null or t.kind = any(p_kinds))
  order by t.business_date desc, t.occurred_at desc
  limit 100000;
end $$;

create or replace function public.log_export(p_business_id uuid, p_from date, p_to date, p_row_count integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_permission(p_business_id, 'reports.export');
  perform private.write_audit(p_business_id, 'report.exported', 'reports', 'export', null,
    format('Exported %s transactions for %s to %s', p_row_count,
      to_char(p_from, 'DD Mon YYYY'), to_char(p_to, 'DD Mon YYYY')),
    null, jsonb_build_object('from', p_from, 'to', p_to, 'rows', p_row_count));
end $$;

grant execute on function public.get_report(uuid, date, date) to authenticated;
grant execute on function public.export_transactions(uuid, date, date, public.transaction_kind[], boolean) to authenticated;
grant execute on function public.log_export(uuid, date, date, integer) to authenticated;
revoke all on function public.get_report(uuid, date, date) from anon;
revoke all on function public.export_transactions(uuid, date, date, public.transaction_kind[], boolean) from anon;
revoke all on function public.log_export(uuid, date, date, integer) from anon;
revoke all on function private.period_totals(uuid, date, date) from public;
