-- GYMATICK 07: controlled edits and voids (never deletes)
create or replace function private.can_self_correct(p_row public.financial_transactions)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_window smallint;
begin
  if p_row.created_by is distinct from (select auth.uid()) then return false; end if;
  select s.staff_edit_window_minutes into v_window
  from public.business_settings s where s.business_id = p_row.business_id;
  return coalesce(v_window, 0) > 0 and now() - p_row.created_at <= make_interval(mins => v_window);
end $$;

create or replace function public.update_transaction(
  p_transaction_id uuid, p_patch jsonb, p_reason text default null)
returns public.financial_transactions language plpgsql security definer set search_path = '' as $$
declare
  v_row public.financial_transactions;
  v_new public.financial_transactions;
  v_perm text;
  v_may_edit boolean;
  v_financial boolean;
  v_changes jsonb := '{}'::jsonb;
  v_amount numeric;
  v_date date;
  v_category uuid;
  v_method uuid;
  v_today date;
  v_checkpoint date;
  v_decimals smallint;
  v_cat record;
begin
  select * into v_row from public.financial_transactions t where t.id = p_transaction_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That transaction no longer exists.'); end if;
  perform private.assert_member(v_row.business_id);
  if v_row.status = 'voided' then
    perform private.raise_error('ALREADY_VOIDED', 'A voided transaction cannot be edited.');
  end if;

  v_perm := private.edit_permission_key(v_row.kind);
  v_may_edit := private.has_permission(v_row.business_id, v_perm) or private.can_self_correct(v_row);
  if not v_may_edit then
    perform private.raise_error('PERMISSION_DENIED', 'You cannot change this entry. Ask the owner.',
      jsonb_build_object('permission', v_perm));
  end if;

  v_amount := coalesce((p_patch ->> 'amount')::numeric, v_row.amount);
  v_date := coalesce((p_patch ->> 'business_date')::date, v_row.business_date);
  v_category := coalesce((p_patch ->> 'category_id')::uuid, v_row.category_id);
  v_method := coalesce((p_patch ->> 'payment_method_id')::uuid, v_row.payment_method_id);
  v_financial := v_amount <> v_row.amount or v_date <> v_row.business_date
                 or v_category is distinct from v_row.category_id or v_method <> v_row.payment_method_id;

  if v_financial then
    if v_row.invoice_id is not null or v_row.is_salary or v_row.transfer_group_id is not null
       or v_row.kind = 'refund'
       or exists (select 1 from public.financial_transactions r
                  where r.related_transaction_id = v_row.id and r.status = 'posted') then
      perform private.raise_error('LINKED_TRANSACTION_LOCKED',
        'Change this through its invoice, salary or transfer instead.');
    end if;
    if char_length(btrim(coalesce(p_reason, ''))) < 5 then
      perform private.raise_error('REASON_REQUIRED', 'Please give a reason (at least 5 characters).');
    end if;

    select s.currency_decimals into v_decimals from public.business_settings s where s.business_id = v_row.business_id;
    if v_amount is null or v_amount <= 0 then
      perform private.raise_error('INVALID_AMOUNT', 'Enter an amount greater than 0.');
    end if;
    if v_amount <> round(v_amount, v_decimals) then
      perform private.raise_error('AMOUNT_PRECISION', format('Use at most %s decimal places.', v_decimals));
    end if;

    if v_category is distinct from v_row.category_id and v_category is not null then
      select c.name, c.kind, c.status, c.is_system into v_cat
      from public.categories c where c.business_id = v_row.business_id and c.id = v_category;
      if v_cat is null or v_cat.kind <> v_row.category_kind then
        perform private.raise_error('CATEGORY_INVALID', 'That category cannot be used here.');
      end if;
      if v_cat.status <> 'active' then
        perform private.raise_error('CATEGORY_INACTIVE', 'This category is no longer active.');
      end if;
      if v_cat.is_system then
        perform private.raise_error('SYSTEM_CATEGORY', 'Salary entries are managed in Salaries.');
      end if;
    end if;

    if v_method <> v_row.payment_method_id
       and not exists (select 1 from public.payment_methods pm
                       where pm.business_id = v_row.business_id and pm.id = v_method and pm.status = 'active') then
      perform private.raise_error('METHOD_INACTIVE', 'Choose an active payment method.');
    end if;

    if v_date <> v_row.business_date then
      v_today := private.current_business_date(v_row.business_id);
      select checkpoint_date into v_checkpoint from private.last_checkpoint(v_row.business_id, v_row.branch_id);
      if v_date > greatest(v_today, v_checkpoint + 1) then
        perform private.raise_error('FUTURE_DATE', 'You cannot move money to a future date.');
      end if;
      if v_date <= v_checkpoint then
        perform private.raise_error('DAY_CLOSED', to_char(v_date, 'DD Mon YYYY') || ' is closed by Xisaab Xir.',
          jsonb_build_object('next_open_date', v_checkpoint + 1));
      end if;
      if v_date < v_today and not private.has_permission(v_row.business_id, 'transactions.backdate') then
        perform private.raise_error('BACKDATE_NOT_ALLOWED', 'You cannot move this to an earlier day.');
      end if;
    end if;
  end if;

  update public.financial_transactions t set
    amount = v_amount,
    business_date = v_date,
    category_id = v_category,
    payment_method_id = v_method,
    description = coalesce(nullif(btrim(coalesce(p_patch ->> 'description', '')), ''), t.description),
    notes = case when p_patch ? 'notes' then nullif(btrim(coalesce(p_patch ->> 'notes', '')), '') else t.notes end,
    customer_id = case when p_patch ? 'customer_id' and t.kind in ('income','refund')
                       then (p_patch ->> 'customer_id')::uuid else t.customer_id end,
    vendor = case when p_patch ? 'vendor' and t.kind = 'expense'
                  then nullif(btrim(coalesce(p_patch ->> 'vendor', '')), '') else t.vendor end,
    updated_by = (select auth.uid())
  where t.id = v_row.id
  returning * into v_new;

  if v_new.amount <> v_row.amount then
    v_changes := v_changes || jsonb_build_object('amount', jsonb_build_object('from', v_row.amount, 'to', v_new.amount)); end if;
  if v_new.business_date <> v_row.business_date then
    v_changes := v_changes || jsonb_build_object('business_date', jsonb_build_object('from', v_row.business_date, 'to', v_new.business_date)); end if;
  if v_new.category_id is distinct from v_row.category_id then
    v_changes := v_changes || jsonb_build_object('category_id', jsonb_build_object('from', v_row.category_id, 'to', v_new.category_id)); end if;
  if v_new.payment_method_id <> v_row.payment_method_id then
    v_changes := v_changes || jsonb_build_object('payment_method_id', jsonb_build_object('from', v_row.payment_method_id, 'to', v_new.payment_method_id)); end if;
  if v_new.description <> v_row.description then
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('from', v_row.description, 'to', v_new.description)); end if;
  if v_new.notes is distinct from v_row.notes then
    v_changes := v_changes || jsonb_build_object('notes', jsonb_build_object('from', v_row.notes, 'to', v_new.notes)); end if;
  if v_new.customer_id is distinct from v_row.customer_id then
    v_changes := v_changes || jsonb_build_object('customer_id', jsonb_build_object('from', v_row.customer_id, 'to', v_new.customer_id)); end if;
  if v_new.vendor is distinct from v_row.vendor then
    v_changes := v_changes || jsonb_build_object('vendor', jsonb_build_object('from', v_row.vendor, 'to', v_new.vendor)); end if;

  if v_changes <> '{}'::jsonb then
    perform private.write_audit(v_row.business_id,
      case when v_row.kind = 'expense' then 'expense.updated' else 'income.updated' end,
      case when v_row.kind = 'expense' then 'expenses' else 'income' end,
      'transaction', v_row.id,
      format('Edited %s (%s)', v_row.description, private.fmt_money(v_row.business_id, v_new.amount)),
      v_changes, jsonb_build_object('reason', p_reason, 'reference_no', v_row.reference_no));
  end if;
  return v_new;
end $$;

create or replace function public.void_transaction(p_transaction_id uuid, p_reason text)
returns setof public.financial_transactions language plpgsql security definer set search_path = '' as $$
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
  elsif not (private.has_permission(v_row.business_id, 'transactions.void') or private.can_self_correct(v_row)) then
    perform private.raise_error('PERMISSION_DENIED', 'You cannot void this entry. Ask the owner.',
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

grant execute on function public.update_transaction(uuid, jsonb, text) to authenticated;
grant execute on function public.void_transaction(uuid, text) to authenticated;
revoke all on function public.update_transaction(uuid, jsonb, text) from anon;
revoke all on function public.void_transaction(uuid, text) from anon;
revoke all on function private.can_self_correct(public.financial_transactions) from public;
revoke all on function private.edit_permission_key(public.transaction_kind) from public;
