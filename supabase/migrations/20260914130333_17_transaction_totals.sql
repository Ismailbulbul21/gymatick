-- Totals for whatever the person is currently filtering, counted in Postgres.
create or replace function public.get_transaction_totals(
  p_business_id uuid,
  p_from date,
  p_to date,
  p_kinds public.transaction_kind[] default null,
  p_category_id uuid default null,
  p_payment_method_id uuid default null,
  p_status text default 'posted',
  p_search text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_can_income boolean; v_can_expense boolean; v_can_all boolean; v_can_salary boolean;
  v_kinds public.transaction_kind[]; v_result jsonb;
begin
  perform private.assert_member(p_business_id);
  v_can_income := private.has_permission(p_business_id, 'income.view');
  v_can_expense := private.has_permission(p_business_id, 'expenses.view');
  v_can_all := private.has_permission(p_business_id, 'transactions.view_all');
  v_can_salary := private.has_permission(p_business_id, 'salaries.view');

  -- only the kinds this person is allowed to see
  select array_agg(k) into v_kinds
  from unnest(coalesce(p_kinds, enum_range(null::public.transaction_kind))) k
  where (k in ('income','refund') and v_can_income)
     or (k = 'expense' and v_can_expense)
     or (k in ('transfer_in','transfer_out','owner_deposit','owner_withdrawal') and v_can_all);

  if v_kinds is null then
    return jsonb_build_object('count', 0, 'income', 0, 'refunds', 0, 'expenses', 0, 'salaries', 0,
      'net', 0, 'money_in', 0, 'money_out', 0, 'average', 0, 'by_method', '[]'::jsonb);
  end if;

  with rows as (
    select t.*
    from public.financial_transactions t
    where t.business_id = p_business_id
      and t.business_date between p_from and p_to
      and t.kind = any(v_kinds)
      and (not t.is_salary or v_can_salary)
      and (p_status = 'all' or t.status = p_status::public.transaction_status)
      and (p_category_id is null or t.category_id = p_category_id)
      and (p_payment_method_id is null or t.payment_method_id = p_payment_method_id)
      and (p_search is null or btrim(p_search) = '' or t.description ilike '%' || btrim(p_search) || '%'
           or t.vendor ilike '%' || btrim(p_search) || '%')
  )
  select jsonb_build_object(
    'count', count(*) filter (where kind <> 'transfer_in'),
    'income', coalesce(sum(amount) filter (where kind = 'income' and status = 'posted'), 0),
    'refunds', coalesce(sum(amount) filter (where kind = 'refund' and status = 'posted'), 0),
    'expenses', coalesce(sum(amount) filter (where kind = 'expense' and status = 'posted'), 0),
    'salaries', coalesce(sum(amount) filter (where kind = 'expense' and is_salary and status = 'posted'), 0),
    'money_in', coalesce(sum(amount) filter (where kind in ('income','transfer_in','owner_deposit') and status = 'posted'), 0),
    'money_out', coalesce(sum(amount) filter (where kind in ('expense','refund','transfer_out','owner_withdrawal') and status = 'posted'), 0),
    'net', coalesce(sum(amount) filter (where kind = 'income' and status = 'posted'), 0)
           - coalesce(sum(amount) filter (where kind = 'refund' and status = 'posted'), 0)
           - coalesce(sum(amount) filter (where kind = 'expense' and status = 'posted'), 0),
    'average', case when count(*) filter (where kind = 'income' and status = 'posted') > 0
      then round(coalesce(sum(amount) filter (where kind = 'income' and status = 'posted'), 0)
                 / count(*) filter (where kind = 'income' and status = 'posted'), 2) else 0 end,
    'top_category', (
      select jsonb_build_object('name', c.name, 'amount', sum(r2.amount),
        'share', round(100 * sum(r2.amount) / nullif((select sum(amount) from rows where status = 'posted'
                                                      and kind = any(array['income','expense']::public.transaction_kind[])), 0), 1))
      from rows r2 join public.categories c on c.id = r2.category_id
      where r2.status = 'posted' and r2.category_id is not null
      group by c.name order by sum(r2.amount) desc limit 1),
    'by_method', (
      select coalesce(jsonb_agg(jsonb_build_object('name', pm.name, 'amount', x.amount) order by x.amount desc), '[]'::jsonb)
      from (select payment_method_id, sum(amount) as amount from rows
            where status = 'posted' and kind in ('income','expense')
            group by payment_method_id) x
      join public.payment_methods pm on pm.id = x.payment_method_id))
  into v_result
  from rows;

  return v_result;
end $$;

revoke all on function public.get_transaction_totals(uuid, date, date, public.transaction_kind[], uuid, uuid, text, text) from public, anon;
grant execute on function public.get_transaction_totals(uuid, date, date, public.transaction_kind[], uuid, uuid, text, text) to authenticated;
