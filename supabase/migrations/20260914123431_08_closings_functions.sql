-- GYMATICK 08: Xisaab Xir - opening balances, preview, closing, reopening, detail
create or replace function private.current_balances(p_business_id uuid, p_branch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cid uuid; v_cdate date; v_rows jsonb; v_total numeric;
begin
  select closing_id, checkpoint_date into v_cid, v_cdate from private.last_checkpoint(p_business_id, p_branch_id);
  if v_cdate is null then
    return jsonb_build_object('total', 0, 'by_method', '[]'::jsonb, 'checkpoint_date', null);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'payment_method_id', x.id, 'name', x.name, 'type', x.type, 'balance', x.balance)
           order by x.sort_order), '[]'::jsonb),
         coalesce(sum(x.balance), 0)
  into v_rows, v_total
  from (
    select pm.id, pm.name, pm.type, pm.sort_order,
      coalesce(l.actual_amount, 0) + coalesce((
        select sum(t.signed_amount) from public.financial_transactions t
        where t.business_id = p_business_id and t.branch_id = p_branch_id
          and t.payment_method_id = pm.id and t.status = 'posted' and t.business_date > v_cdate), 0) as balance
    from public.payment_methods pm
    left join public.daily_closing_lines l on l.closing_id = v_cid and l.payment_method_id = pm.id
    where pm.business_id = p_business_id and (pm.status = 'active' or l.id is not null)
  ) x;
  return jsonb_build_object('total', v_total, 'by_method', v_rows, 'checkpoint_date', v_cdate);
end $$;

create or replace function private.closing_state(p_business_id uuid, p_branch_id uuid, p_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cid uuid; v_cdate date; v_today date; v_period_start date;
  v_lines jsonb; v_opening numeric; v_expected numeric;
  v_income numeric; v_refund numeric; v_expense numeric; v_salary numeric;
  v_odep numeric; v_owdr numeric; v_transfer numeric; v_count integer; v_token text;
  v_closing public.daily_closings;
begin
  select closing_id, checkpoint_date into v_cid, v_cdate from private.last_checkpoint(p_business_id, p_branch_id);
  if v_cdate is null then
    perform private.raise_error('ONBOARDING_REQUIRED', 'Set the opening balances first.');
  end if;
  v_today := private.current_business_date(p_business_id);

  if p_date <= v_cdate then
    select * into v_closing from public.daily_closings c
    where c.business_id = p_business_id and c.branch_id = p_branch_id and c.status = 'closed'
      and c.period_start <= p_date and c.business_date >= p_date
    order by c.business_date limit 1;
    return jsonb_build_object('status', 'closed', 'business_date', p_date,
      'closing_id', v_closing.id, 'closed_at', v_closing.closed_at,
      'difference_total', v_closing.difference_total, 'is_balanced', v_closing.is_balanced,
      'expected_total', v_closing.expected_total, 'actual_total', v_closing.actual_total,
      'next_open_date', v_cdate + 1, 'today', v_today);
  end if;
  if p_date > v_today then
    perform private.raise_error('FUTURE_DATE', 'You cannot close a future day.', jsonb_build_object('today', v_today));
  end if;

  v_period_start := v_cdate + 1;

  select
    coalesce(sum(t.amount) filter (where t.kind = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'refund'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'expense' and t.is_salary), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'owner_deposit'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'owner_withdrawal'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'transfer_out'), 0),
    count(*) filter (where t.kind <> 'transfer_in')
  into v_income, v_refund, v_expense, v_salary, v_odep, v_owdr, v_transfer, v_count
  from public.financial_transactions t
  where t.business_id = p_business_id and t.branch_id = p_branch_id and t.status = 'posted'
    and t.business_date between v_period_start and p_date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'payment_method_id', x.id, 'name', x.name, 'type', x.type,
           'opening_amount', x.opening_amount, 'money_in', x.money_in, 'money_out', x.money_out,
           'expected_amount', x.expected_amount, 'has_activity', (x.money_in <> 0 or x.money_out <> 0))
           order by x.sort_order), '[]'::jsonb),
         coalesce(sum(x.opening_amount), 0), coalesce(sum(x.expected_amount), 0)
  into v_lines, v_opening, v_expected
  from (
    select pm.id, pm.name, pm.type, pm.sort_order,
      coalesce(l.actual_amount, 0) as opening_amount,
      coalesce(a.money_in, 0) as money_in,
      coalesce(a.money_out, 0) as money_out,
      coalesce(l.actual_amount, 0) + coalesce(a.money_in, 0) - coalesce(a.money_out, 0) as expected_amount
    from public.payment_methods pm
    left join public.daily_closing_lines l on l.closing_id = v_cid and l.payment_method_id = pm.id
    left join (
      select t.payment_method_id,
        sum(t.amount) filter (where t.kind in ('income','transfer_in','owner_deposit')) as money_in,
        sum(t.amount) filter (where t.kind in ('expense','refund','transfer_out','owner_withdrawal')) as money_out
      from public.financial_transactions t
      where t.business_id = p_business_id and t.branch_id = p_branch_id and t.status = 'posted'
        and t.business_date between v_period_start and p_date
      group by t.payment_method_id) a on a.payment_method_id = pm.id
    where pm.business_id = p_business_id
      and (pm.status = 'active' or l.id is not null or a.payment_method_id is not null)
  ) x;

  select md5(coalesce(count(*), 0)::text || ':' || coalesce(sum(t.amount), 0)::text || ':' ||
             coalesce(max(greatest(t.updated_at, t.created_at)), timestamptz 'epoch')::text || ':' || v_cid::text)
  into v_token
  from public.financial_transactions t
  where t.business_id = p_business_id and t.branch_id = p_branch_id
    and t.business_date between v_period_start and p_date;

  return jsonb_build_object(
    'status', 'open', 'business_date', p_date, 'period_start', v_period_start, 'today', v_today,
    'checkpoint_closing_id', v_cid, 'checkpoint_date', v_cdate,
    'days_in_period', (p_date - v_period_start) + 1,
    'opening_total', v_opening, 'income_total', v_income, 'refund_total', v_refund,
    'expense_total', v_expense, 'salary_total', v_salary,
    'owner_deposit_total', v_odep, 'owner_withdrawal_total', v_owdr, 'transfer_total', v_transfer,
    'money_in_total', v_income + v_odep, 'money_out_total', v_expense + v_refund + v_owdr,
    'expected_total', v_expected, 'transaction_count', v_count,
    'lines', v_lines, 'preview_token', v_token);
end $$;

create or replace function public.get_closing_preview(p_business_id uuid, p_business_date date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_branch uuid;
begin
  perform private.assert_permission(p_business_id, 'closings.view');
  v_branch := private.default_branch_id(p_business_id);
  return private.closing_state(p_business_id, v_branch,
    coalesce(p_business_date, private.current_business_date(p_business_id)));
end $$;

create or replace function public.set_opening_balances(
  p_business_id uuid, p_go_live_date date, p_balances jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid; v_closing uuid; v_total numeric := 0; v_item jsonb; v_old uuid;
begin
  if not private.is_owner(p_business_id) then
    perform private.raise_error('PERMISSION_DENIED', 'Only the owner can set opening balances.');
  end if;
  v_branch := private.default_branch_id(p_business_id);
  if exists (select 1 from public.daily_closings c
             where c.business_id = p_business_id and c.kind = 'daily') then
    perform private.raise_error('OPENING_LOCKED', 'Opening balances cannot change after the first Xisaab Xir.');
  end if;
  if exists (select 1 from public.financial_transactions t where t.business_id = p_business_id) then
    perform private.raise_error('OPENING_LOCKED', 'Opening balances cannot change after money has been recorded.');
  end if;

  select c.id into v_old from public.daily_closings c
  where c.business_id = p_business_id and c.kind = 'opening' and c.status = 'closed';
  if v_old is not null then
    delete from public.daily_closing_lines where closing_id = v_old;
    delete from public.daily_closings where id = v_old;
  end if;

  insert into public.daily_closings (business_id, branch_id, kind, period_start, business_date,
    opening_total, expected_total, actual_total, difference_total, transaction_count, lines_with_difference,
    notes, closed_by, idempotency_key)
  values (p_business_id, v_branch, 'opening', p_go_live_date - 1, p_go_live_date - 1,
    0, 0, 0, 0, 0, 0, 'Opening balances', (select auth.uid()), gen_random_uuid())
  returning id into v_closing;

  for v_item in select jsonb_array_elements(coalesce(p_balances, '[]'::jsonb)) loop
    insert into public.daily_closing_lines (business_id, closing_id, payment_method_id,
      opening_amount, money_in, money_out, expected_amount, actual_amount)
    values (p_business_id, v_closing, (v_item ->> 'payment_method_id')::uuid,
      0, 0, 0, 0, round(coalesce((v_item ->> 'amount')::numeric, 0), 2));
    v_total := v_total + round(coalesce((v_item ->> 'amount')::numeric, 0), 2);
  end loop;

  insert into public.daily_closing_lines (business_id, closing_id, payment_method_id,
    opening_amount, money_in, money_out, expected_amount, actual_amount)
  select p_business_id, v_closing, pm.id, 0, 0, 0, 0, 0
  from public.payment_methods pm
  where pm.business_id = p_business_id and pm.status = 'active'
    and not exists (select 1 from public.daily_closing_lines l
                    where l.closing_id = v_closing and l.payment_method_id = pm.id);

  update public.daily_closings set opening_total = v_total, expected_total = v_total, actual_total = v_total
  where id = v_closing;

  update public.businesses set go_live_date = p_go_live_date, onboarding_completed_at = now()
  where id = p_business_id;
  update public.business_settings
  set salary_tracking_start_month = date_trunc('month', p_go_live_date)::date, updated_by = (select auth.uid())
  where business_id = p_business_id;

  perform private.write_audit(p_business_id, 'closing.opening_set', 'closings', 'closing', v_closing,
    format('Opening balances set to %s from %s', private.fmt_money(p_business_id, v_total),
           to_char(p_go_live_date, 'DD Mon YYYY')),
    null, jsonb_build_object('go_live_date', p_go_live_date, 'total', v_total));

  return jsonb_build_object('closing_id', v_closing, 'go_live_date', p_go_live_date, 'total', v_total);
end $$;

create or replace function public.perform_closing(
  p_business_id uuid, p_business_date date, p_actuals jsonb, p_idempotency_key uuid,
  p_notes text default null, p_preview_token text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid; v_state jsonb; v_line jsonb; v_actual numeric; v_expected numeric;
  v_actual_total numeric := 0; v_diff_lines smallint := 0; v_difference numeric;
  v_decimals smallint; v_closing public.daily_closings; v_existing public.daily_closings;
begin
  perform private.assert_permission(p_business_id, 'closings.perform');
  v_branch := private.default_branch_id(p_business_id);

  select * into v_existing from public.daily_closings c
  where c.business_id = p_business_id and c.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('closing_id', v_existing.id, 'business_date', v_existing.business_date,
      'expected_total', v_existing.expected_total, 'actual_total', v_existing.actual_total,
      'difference_total', v_existing.difference_total, 'is_balanced', v_existing.is_balanced, 'replayed', true);
  end if;

  perform private.lock_business(p_business_id, true);
  v_state := private.closing_state(p_business_id, v_branch, p_business_date);
  if v_state ->> 'status' = 'closed' then
    perform private.raise_error('ALREADY_CLOSED',
      to_char(p_business_date, 'DD Mon YYYY') || ' is already closed.', v_state);
  end if;
  if p_preview_token is not null and p_preview_token <> (v_state ->> 'preview_token') then
    perform private.raise_error('CLOSING_STALE',
      'New activity was recorded while you were counting. Review the updated figures.', v_state);
  end if;

  select s.currency_decimals into v_decimals from public.business_settings s where s.business_id = p_business_id;

  insert into public.daily_closings (business_id, branch_id, kind, period_start, business_date,
    opening_total, income_total, refund_total, expense_total, salary_total,
    owner_deposit_total, owner_withdrawal_total, transfer_total, money_in_total, money_out_total,
    expected_total, actual_total, difference_total, transaction_count, lines_with_difference,
    notes, closed_by, idempotency_key)
  values (p_business_id, v_branch, 'daily',
    (v_state ->> 'period_start')::date, p_business_date,
    (v_state ->> 'opening_total')::numeric, (v_state ->> 'income_total')::numeric,
    (v_state ->> 'refund_total')::numeric, (v_state ->> 'expense_total')::numeric,
    (v_state ->> 'salary_total')::numeric, (v_state ->> 'owner_deposit_total')::numeric,
    (v_state ->> 'owner_withdrawal_total')::numeric, (v_state ->> 'transfer_total')::numeric,
    (v_state ->> 'money_in_total')::numeric, (v_state ->> 'money_out_total')::numeric,
    (v_state ->> 'expected_total')::numeric, 0, 0,
    (v_state ->> 'transaction_count')::integer, 0,
    nullif(btrim(coalesce(p_notes, '')), ''), (select auth.uid()), p_idempotency_key)
  returning * into v_closing;

  for v_line in select jsonb_array_elements(v_state -> 'lines') loop
    select round((a ->> 'actual_amount')::numeric, v_decimals) into v_actual
    from jsonb_array_elements(coalesce(p_actuals, '[]'::jsonb)) a
    where (a ->> 'payment_method_id') = (v_line ->> 'payment_method_id')
    limit 1;
    if v_actual is null then
      perform private.raise_error('ACTUALS_INCOMPLETE',
        format('Enter the counted amount for %s.', v_line ->> 'name'),
        jsonb_build_object('payment_method_id', v_line ->> 'payment_method_id'));
    end if;
    if v_actual < 0 then
      perform private.raise_error('INVALID_AMOUNT', 'Counted amounts cannot be negative.');
    end if;
    v_expected := (v_line ->> 'expected_amount')::numeric;
    insert into public.daily_closing_lines (business_id, closing_id, payment_method_id,
      opening_amount, money_in, money_out, expected_amount, actual_amount)
    values (p_business_id, v_closing.id, (v_line ->> 'payment_method_id')::uuid,
      (v_line ->> 'opening_amount')::numeric, (v_line ->> 'money_in')::numeric,
      (v_line ->> 'money_out')::numeric, v_expected, v_actual);
    v_actual_total := v_actual_total + v_actual;
    if v_actual <> v_expected then v_diff_lines := v_diff_lines + 1; end if;
  end loop;

  v_difference := v_actual_total - (v_state ->> 'expected_total')::numeric;
  if (v_difference <> 0 or v_diff_lines > 0) and char_length(btrim(coalesce(p_notes, ''))) < 5 then
    perform private.raise_error('NOTES_REQUIRED', 'Explain the difference before closing.');
  end if;

  update public.daily_closings
  set actual_total = v_actual_total, difference_total = v_difference, lines_with_difference = v_diff_lines
  where id = v_closing.id
  returning * into v_closing;

  perform private.write_audit(p_business_id, 'closing.completed', 'closings', 'closing', v_closing.id,
    format('Xisaab Xir for %s: expected %s, counted %s, difference %s',
      to_char(p_business_date, 'DD Mon YYYY'),
      private.fmt_money(p_business_id, v_closing.expected_total),
      private.fmt_money(p_business_id, v_closing.actual_total),
      private.fmt_money(p_business_id, v_closing.difference_total)),
    null, jsonb_build_object('is_balanced', v_closing.is_balanced, 'notes', v_closing.notes,
                             'lines_with_difference', v_diff_lines));

  return jsonb_build_object('closing_id', v_closing.id, 'business_date', v_closing.business_date,
    'period_start', v_closing.period_start, 'expected_total', v_closing.expected_total,
    'actual_total', v_closing.actual_total, 'difference_total', v_closing.difference_total,
    'is_balanced', v_closing.is_balanced, 'next_business_date', v_closing.business_date + 1);
end $$;

create or replace function public.reopen_closing(p_closing_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_c public.daily_closings; v_latest uuid;
begin
  select * into v_c from public.daily_closings c where c.id = p_closing_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That closing no longer exists.'); end if;
  perform private.assert_permission(v_c.business_id, 'closings.reopen');
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform private.raise_error('REASON_REQUIRED', 'Please give a reason (at least 5 characters).');
  end if;
  if v_c.kind <> 'daily' or v_c.status <> 'closed' then
    perform private.raise_error('NOT_LATEST_CLOSING', 'Only an active daily closing can be reopened.');
  end if;
  select closing_id into v_latest from private.last_checkpoint(v_c.business_id, v_c.branch_id);
  if v_latest <> v_c.id then
    perform private.raise_error('NOT_LATEST_CLOSING', 'Only the most recent closing can be reopened.');
  end if;

  update public.daily_closings
  set status = 'reopened', reopened_by = (select auth.uid()), reopened_at = now(), reopen_reason = btrim(p_reason)
  where id = v_c.id;

  perform private.write_audit(v_c.business_id, 'closing.reopened', 'closings', 'closing', v_c.id,
    format('Reopened %s - %s', to_char(v_c.business_date, 'DD Mon YYYY'), btrim(p_reason)),
    null, jsonb_build_object('reason', btrim(p_reason)));
  return jsonb_build_object('closing_id', v_c.id, 'business_date', v_c.business_date, 'status', 'reopened');
end $$;

create or replace function public.get_closing_detail(p_closing_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_c public.daily_closings; v_lines jsonb; v_tx jsonb; v_corr jsonb; v_recalc jsonb;
begin
  select * into v_c from public.daily_closings c where c.id = p_closing_id;
  if not found then perform private.raise_error('NOT_FOUND', 'That closing no longer exists.'); end if;
  perform private.assert_permission(v_c.business_id, 'closings.view');

  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_method_id', l.payment_method_id, 'name', pm.name, 'type', pm.type,
    'opening_amount', l.opening_amount, 'money_in', l.money_in, 'money_out', l.money_out,
    'expected_amount', l.expected_amount, 'actual_amount', l.actual_amount, 'difference', l.difference)
    order by pm.sort_order), '[]'::jsonb)
  into v_lines
  from public.daily_closing_lines l
  join public.payment_methods pm on pm.id = l.payment_method_id
  where l.closing_id = v_c.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'reference_no', t.reference_no, 'kind', t.kind, 'status', t.status,
    'amount', t.amount, 'signed_amount', t.signed_amount, 'description', t.description,
    'business_date', t.business_date, 'occurred_at', t.occurred_at,
    'category', c.name, 'payment_method', pm.name, 'is_salary', t.is_salary,
    'voided_at', t.voided_at, 'void_reason', t.void_reason)
    order by t.occurred_at desc), '[]'::jsonb)
  into v_tx
  from public.financial_transactions t
  left join public.categories c on c.id = t.category_id
  join public.payment_methods pm on pm.id = t.payment_method_id
  where t.business_id = v_c.business_id and t.branch_id = v_c.branch_id
    and t.business_date between v_c.period_start and v_c.business_date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'reference_no', t.reference_no, 'description', t.description, 'amount', t.amount,
    'kind', t.kind, 'voided_at', t.voided_at, 'void_reason', t.void_reason,
    'voided_by', p.full_name) order by t.voided_at), '[]'::jsonb)
  into v_corr
  from public.financial_transactions t
  left join public.profiles p on p.id = t.voided_by
  where t.business_id = v_c.business_id and t.branch_id = v_c.branch_id
    and t.business_date between v_c.period_start and v_c.business_date
    and t.status = 'voided' and t.voided_at > v_c.closed_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'payment_method_id', x.id, 'name', x.name,
    'expected_amount', x.expected_now, 'actual_amount', x.actual_amount,
    'difference', x.actual_amount - x.expected_now) order by x.sort_order), '[]'::jsonb)
  into v_recalc
  from (
    select pm.id, pm.name, pm.sort_order, l.actual_amount,
      l.opening_amount
        + coalesce(sum(t.amount) filter (where t.kind in ('income','transfer_in','owner_deposit')), 0)
        - coalesce(sum(t.amount) filter (where t.kind in ('expense','refund','transfer_out','owner_withdrawal')), 0)
        as expected_now
    from public.daily_closing_lines l
    join public.payment_methods pm on pm.id = l.payment_method_id
    left join public.financial_transactions t
      on t.business_id = v_c.business_id and t.branch_id = v_c.branch_id
     and t.payment_method_id = pm.id and t.status = 'posted'
     and t.business_date between v_c.period_start and v_c.business_date
    where l.closing_id = v_c.id
    group by pm.id, pm.name, pm.sort_order, l.actual_amount, l.opening_amount
  ) x;

  return jsonb_build_object(
    'closing', to_jsonb(v_c)
      || jsonb_build_object(
        'closed_by_name', (select full_name from public.profiles where id = v_c.closed_by),
        'reopened_by_name', (select full_name from public.profiles where id = v_c.reopened_by)),
    'lines', v_lines, 'transactions', v_tx, 'corrections', v_corr, 'recalculated', v_recalc,
    'has_corrections', jsonb_array_length(v_corr) > 0);
end $$;

grant execute on function public.get_closing_preview(uuid, date) to authenticated;
grant execute on function public.set_opening_balances(uuid, date, jsonb) to authenticated;
grant execute on function public.perform_closing(uuid, date, jsonb, uuid, text, text) to authenticated;
grant execute on function public.reopen_closing(uuid, text) to authenticated;
grant execute on function public.get_closing_detail(uuid) to authenticated;
revoke all on function public.get_closing_preview(uuid, date) from anon;
revoke all on function public.set_opening_balances(uuid, date, jsonb) from anon;
revoke all on function public.perform_closing(uuid, date, jsonb, uuid, text, text) from anon;
revoke all on function public.reopen_closing(uuid, text) from anon;
revoke all on function public.get_closing_detail(uuid) from anon;
revoke all on function private.closing_state(uuid, uuid, date) from public;
revoke all on function private.current_balances(uuid, uuid) from public;
