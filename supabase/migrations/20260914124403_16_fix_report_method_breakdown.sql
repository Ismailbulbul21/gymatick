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

  select coalesce(jsonb_agg(jsonb_build_object('payment_method_id', x.id, 'name', x.name, 'type', x.type,
    'money_in', x.money_in, 'money_out', x.money_out, 'net', x.money_in - x.money_out)
    order by x.sort_order), '[]'::jsonb)
  into v_methods
  from (
    select pm.id, pm.name, pm.type, pm.sort_order,
      coalesce(sum(t.amount) filter (where t.kind = 'income'), 0) as money_in,
      coalesce(sum(t.amount) filter (where t.kind in ('expense','refund')), 0) as money_out
    from public.payment_methods pm
    left join public.financial_transactions t
      on t.payment_method_id = pm.id and t.status = 'posted' and t.business_date between p_from and p_to
    where pm.business_id = p_business_id
    group by pm.id, pm.name, pm.type, pm.sort_order) x;

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
