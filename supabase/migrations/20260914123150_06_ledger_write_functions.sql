-- GYMATICK 06: the only way money enters, changes or leaves the ledger
create or replace function private.fmt_money(p_business_id uuid, p_amount numeric)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(s.currency_symbol, '$') || to_char(coalesce(p_amount, 0), 'FM999,999,999,990.00')
  from public.business_settings s where s.business_id = p_business_id
$$;

create or replace function private.edit_permission_key(p_kind public.transaction_kind)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_kind in ('income','refund') then 'income.edit'
    when p_kind = 'expense' then 'expenses.edit'
    when p_kind in ('transfer_in','transfer_out') then 'money.transfer'
    else 'money.owner_movements' end
$$;

create or replace function private.create_transaction(
  p_business_id uuid,
  p_kind public.transaction_kind,
  p_amount numeric,
  p_payment_method_id uuid,
  p_idempotency_key uuid,
  p_category_id uuid default null,
  p_business_date date default null,
  p_description text default null,
  p_notes text default null,
  p_customer_id uuid default null,
  p_vendor text default null,
  p_invoice_id uuid default null,
  p_related_transaction_id uuid default null,
  p_transfer_group_id uuid default null,
  p_is_salary boolean default false,
  p_allow_system_category boolean default false)
returns public.financial_transactions language plpgsql security definer set search_path = '' as $$
declare
  v_row public.financial_transactions;
  v_decimals smallint;
  v_timezone text;
  v_branch uuid;
  v_today date;
  v_checkpoint date;
  v_min date;
  v_max date;
  v_date date;
  v_occurred timestamptz;
  v_backdated boolean;
  v_cat record;
  v_customer_name text;
  v_description text;
  v_reference bigint;
begin
  if p_idempotency_key is null then
    perform private.raise_error('IDEMPOTENCY_REQUIRED', 'Missing request key.');
  end if;

  perform private.lock_business(p_business_id, false);

  select * into v_row from public.financial_transactions t
  where t.business_id = p_business_id and t.idempotency_key = p_idempotency_key;
  if found then
    if v_row.kind <> p_kind or v_row.amount <> p_amount
       or v_row.payment_method_id <> p_payment_method_id
       or v_row.category_id is distinct from p_category_id then
      perform private.raise_error('IDEMPOTENCY_MISMATCH',
        'This form was already submitted with different details. Reload and try again.');
    end if;
    return v_row;
  end if;

  select s.currency_decimals, s.timezone into v_decimals, v_timezone
  from public.business_settings s where s.business_id = p_business_id;
  if v_decimals is null then
    perform private.raise_error('SETUP_INCOMPLETE', 'This gym is not set up yet.');
  end if;

  if p_amount is null or p_amount <= 0 then
    perform private.raise_error('INVALID_AMOUNT', 'Enter an amount greater than 0.');
  end if;
  if p_amount <> round(p_amount, v_decimals) then
    perform private.raise_error('AMOUNT_PRECISION',
      format('Use at most %s decimal places.', v_decimals), jsonb_build_object('decimals', v_decimals));
  end if;

  v_branch := private.default_branch_id(p_business_id);
  if v_branch is null then
    perform private.raise_error('SETUP_INCOMPLETE', 'This gym has no branch yet.');
  end if;

  if p_category_id is not null then
    select c.name, c.kind, c.status, c.is_system into v_cat
    from public.categories c where c.business_id = p_business_id and c.id = p_category_id;
    if v_cat is null then
      perform private.raise_error('CATEGORY_INVALID', 'Choose a category from this gym.');
    end if;
    if (p_kind in ('income','refund') and v_cat.kind <> 'income')
       or (p_kind = 'expense' and v_cat.kind <> 'expense') then
      perform private.raise_error('CATEGORY_INVALID', 'That category cannot be used here.');
    end if;
    if v_cat.status <> 'active' then
      perform private.raise_error('CATEGORY_INACTIVE', 'This category is no longer active.');
    end if;
    if v_cat.is_system and not p_allow_system_category then
      perform private.raise_error('SYSTEM_CATEGORY', 'Salaries are paid from Salaries -> Pay salary.');
    end if;
  end if;

  if not exists (select 1 from public.payment_methods pm
                 where pm.business_id = p_business_id and pm.id = p_payment_method_id and pm.status = 'active') then
    perform private.raise_error('METHOD_INACTIVE', 'Choose an active payment method.');
  end if;

  if p_customer_id is not null then
    select c.full_name into v_customer_name from public.customers c
    where c.business_id = p_business_id and c.id = p_customer_id and c.status = 'active';
    if v_customer_name is null then
      perform private.raise_error('CUSTOMER_INVALID', 'Choose an active customer.');
    end if;
  end if;

  v_today := private.current_business_date(p_business_id);
  select checkpoint_date into v_checkpoint from private.last_checkpoint(p_business_id, v_branch);
  if v_checkpoint is null then
    perform private.raise_error('ONBOARDING_REQUIRED', 'Set the opening balances before recording money.');
  end if;
  v_min := v_checkpoint + 1;
  v_max := greatest(v_today, v_min);
  v_date := coalesce(p_business_date, v_max);
  if v_date > v_max then
    perform private.raise_error('FUTURE_DATE', 'You cannot record money for a future date.',
      jsonb_build_object('max_date', v_max));
  end if;
  if v_date < v_min then
    perform private.raise_error('DAY_CLOSED',
      to_char(v_date, 'DD Mon YYYY') || ' is closed by Xisaab Xir.',
      jsonb_build_object('next_open_date', v_min));
  end if;
  if v_date < v_today and not private.has_permission(p_business_id, 'transactions.backdate') then
    perform private.raise_error('BACKDATE_NOT_ALLOWED', 'You can only record transactions for today.',
      jsonb_build_object('today', v_today));
  end if;
  v_backdated := v_date < v_today;
  v_occurred := case when v_backdated
    then (v_date::timestamp + interval '12 hours') at time zone v_timezone
    else now() end;

  v_description := nullif(btrim(coalesce(p_description, '')), '');
  if v_description is null then
    v_description := case
      when p_kind in ('income','refund','expense') then v_cat.name
      when p_kind = 'transfer_out' then 'Transfer out'
      when p_kind = 'transfer_in' then 'Transfer in'
      when p_kind = 'owner_deposit' then 'Owner deposit'
      else 'Owner withdrawal' end;
    if v_customer_name is not null then
      v_description := v_description || ' - ' || v_customer_name;
    end if;
  end if;

  v_reference := private.next_sequence_value(p_business_id, 'transaction', 'all');

  insert into public.financial_transactions (
    business_id, branch_id, reference_no, kind, amount, category_id, payment_method_id,
    business_date, occurred_at, is_backdated, description, notes, customer_id, vendor,
    invoice_id, related_transaction_id, transfer_group_id, is_salary, idempotency_key, created_by)
  values (
    p_business_id, v_branch, v_reference, p_kind, p_amount, p_category_id, p_payment_method_id,
    v_date, v_occurred, v_backdated, left(v_description, 300), nullif(btrim(coalesce(p_notes, '')), ''),
    p_customer_id, nullif(btrim(coalesce(p_vendor, '')), ''), p_invoice_id, p_related_transaction_id,
    p_transfer_group_id, p_is_salary, p_idempotency_key, (select auth.uid()))
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    select * into v_row from public.financial_transactions t
    where t.business_id = p_business_id and t.idempotency_key = p_idempotency_key;
    if found then return v_row; end if;
    raise;
end $$;

create or replace function public.record_income(
  p_business_id uuid, p_amount numeric, p_category_id uuid, p_payment_method_id uuid,
  p_idempotency_key uuid, p_business_date date default null, p_customer_id uuid default null,
  p_description text default null, p_notes text default null)
returns public.financial_transactions language plpgsql security definer set search_path = '' as $$
declare v_row public.financial_transactions;
begin
  perform private.assert_permission(p_business_id, 'income.create');
  v_row := private.create_transaction(
    p_business_id => p_business_id, p_kind => 'income', p_amount => p_amount,
    p_payment_method_id => p_payment_method_id, p_idempotency_key => p_idempotency_key,
    p_category_id => p_category_id, p_business_date => p_business_date,
    p_description => p_description, p_notes => p_notes, p_customer_id => p_customer_id);
  perform private.write_audit(p_business_id, 'income.created', 'income', 'transaction', v_row.id,
    format('Recorded income %s (%s)', private.fmt_money(p_business_id, v_row.amount), v_row.description),
    null, jsonb_build_object('reference_no', v_row.reference_no, 'business_date', v_row.business_date));
  return v_row;
end $$;

create or replace function public.record_expense(
  p_business_id uuid, p_amount numeric, p_category_id uuid, p_payment_method_id uuid,
  p_idempotency_key uuid, p_business_date date default null, p_vendor text default null,
  p_description text default null, p_notes text default null)
returns public.financial_transactions language plpgsql security definer set search_path = '' as $$
declare v_row public.financial_transactions;
begin
  perform private.assert_permission(p_business_id, 'expenses.create');
  v_row := private.create_transaction(
    p_business_id => p_business_id, p_kind => 'expense', p_amount => p_amount,
    p_payment_method_id => p_payment_method_id, p_idempotency_key => p_idempotency_key,
    p_category_id => p_category_id, p_business_date => p_business_date,
    p_description => p_description, p_notes => p_notes, p_vendor => p_vendor);
  perform private.write_audit(p_business_id, 'expense.created', 'expenses', 'transaction', v_row.id,
    format('Recorded expense %s (%s)', private.fmt_money(p_business_id, v_row.amount), v_row.description),
    null, jsonb_build_object('reference_no', v_row.reference_no, 'business_date', v_row.business_date));
  return v_row;
end $$;

create or replace function public.record_refund(
  p_transaction_id uuid, p_amount numeric, p_payment_method_id uuid, p_reason text,
  p_idempotency_key uuid, p_business_date date default null)
returns public.financial_transactions language plpgsql security definer set search_path = '' as $$
declare v_orig public.financial_transactions; v_refunded numeric; v_row public.financial_transactions;
begin
  select * into v_orig from public.financial_transactions t where t.id = p_transaction_id;
  if not found then perform private.raise_error('NOT_FOUND', 'That payment no longer exists.'); end if;
  perform private.assert_permission(v_orig.business_id, 'transactions.refund');
  if v_orig.kind <> 'income' or v_orig.status <> 'posted' then
    perform private.raise_error('REFUND_NOT_ALLOWED', 'Only a posted income can be refunded.');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform private.raise_error('REASON_REQUIRED', 'Please give a reason (at least 5 characters).');
  end if;
  select coalesce(sum(r.amount), 0) into v_refunded from public.financial_transactions r
  where r.related_transaction_id = v_orig.id and r.kind = 'refund' and r.status = 'posted';
  if p_amount > v_orig.amount - v_refunded then
    perform private.raise_error('REFUND_EXCEEDS_ORIGINAL',
      format('You can refund at most %s.', private.fmt_money(v_orig.business_id, v_orig.amount - v_refunded)),
      jsonb_build_object('max_amount', v_orig.amount - v_refunded));
  end if;
  v_row := private.create_transaction(
    p_business_id => v_orig.business_id, p_kind => 'refund', p_amount => p_amount,
    p_payment_method_id => p_payment_method_id, p_idempotency_key => p_idempotency_key,
    p_category_id => v_orig.category_id, p_business_date => p_business_date,
    p_description => 'Refund - ' || v_orig.description, p_notes => p_reason,
    p_customer_id => v_orig.customer_id, p_invoice_id => v_orig.invoice_id,
    p_related_transaction_id => v_orig.id);
  perform private.write_audit(v_orig.business_id, 'refund.created', 'income', 'transaction', v_row.id,
    format('Refunded %s of %s', private.fmt_money(v_orig.business_id, p_amount), v_orig.description),
    null, jsonb_build_object('original_id', v_orig.id, 'reason', p_reason));
  return v_row;
end $$;

create or replace function public.record_transfer(
  p_business_id uuid, p_from_method_id uuid, p_to_method_id uuid, p_amount numeric,
  p_idempotency_key uuid, p_business_date date default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_out public.financial_transactions; v_in public.financial_transactions;
  v_from text; v_to text; v_key_in uuid;
begin
  perform private.assert_permission(p_business_id, 'money.transfer');
  if p_from_method_id = p_to_method_id then
    perform private.raise_error('SAME_METHOD_TRANSFER', 'Choose two different payment methods.');
  end if;
  select name into v_from from public.payment_methods where business_id = p_business_id and id = p_from_method_id;
  select name into v_to from public.payment_methods where business_id = p_business_id and id = p_to_method_id;
  if v_from is null or v_to is null then
    perform private.raise_error('METHOD_INACTIVE', 'Choose payment methods from this gym.');
  end if;
  v_key_in := md5(p_idempotency_key::text || ':in')::uuid;
  select * into v_out from public.financial_transactions t
  where t.business_id = p_business_id and t.idempotency_key = p_idempotency_key;
  v_group := coalesce(v_out.transfer_group_id, gen_random_uuid());

  v_out := private.create_transaction(
    p_business_id => p_business_id, p_kind => 'transfer_out', p_amount => p_amount,
    p_payment_method_id => p_from_method_id, p_idempotency_key => p_idempotency_key,
    p_business_date => p_business_date, p_description => format('Transfer %s to %s', v_from, v_to),
    p_notes => p_notes, p_transfer_group_id => v_group);
  v_in := private.create_transaction(
    p_business_id => p_business_id, p_kind => 'transfer_in', p_amount => p_amount,
    p_payment_method_id => p_to_method_id, p_idempotency_key => v_key_in,
    p_business_date => v_out.business_date, p_description => format('Transfer from %s to %s', v_from, v_to),
    p_notes => p_notes, p_transfer_group_id => v_out.transfer_group_id);

  perform private.write_audit(p_business_id, 'transfer.created', 'transactions', 'transaction', v_out.id,
    format('Transferred %s from %s to %s', private.fmt_money(p_business_id, p_amount), v_from, v_to),
    null, jsonb_build_object('transfer_group_id', v_out.transfer_group_id));
  return jsonb_build_object('transfer_group_id', v_out.transfer_group_id,
    'out_id', v_out.id, 'in_id', v_in.id, 'business_date', v_out.business_date);
end $$;

create or replace function public.record_owner_movement(
  p_business_id uuid, p_direction text, p_amount numeric, p_payment_method_id uuid,
  p_idempotency_key uuid, p_business_date date default null, p_notes text default null)
returns public.financial_transactions language plpgsql security definer set search_path = '' as $$
declare v_row public.financial_transactions; v_kind public.transaction_kind;
begin
  perform private.assert_permission(p_business_id, 'money.owner_movements');
  if p_direction not in ('deposit','withdrawal') then
    perform private.raise_error('INVALID_INPUT', 'Choose deposit or withdrawal.');
  end if;
  v_kind := case when p_direction = 'deposit' then 'owner_deposit' else 'owner_withdrawal' end;
  v_row := private.create_transaction(
    p_business_id => p_business_id, p_kind => v_kind, p_amount => p_amount,
    p_payment_method_id => p_payment_method_id, p_idempotency_key => p_idempotency_key,
    p_business_date => p_business_date, p_notes => p_notes);
  perform private.write_audit(p_business_id, 'owner_movement.created', 'transactions', 'transaction', v_row.id,
    format('Owner %s of %s', p_direction, private.fmt_money(p_business_id, p_amount)),
    null, jsonb_build_object('direction', p_direction));
  return v_row;
end $$;

grant execute on function public.record_income(uuid, numeric, uuid, uuid, uuid, date, uuid, text, text) to authenticated;
grant execute on function public.record_expense(uuid, numeric, uuid, uuid, uuid, date, text, text, text) to authenticated;
grant execute on function public.record_refund(uuid, numeric, uuid, text, uuid, date) to authenticated;
grant execute on function public.record_transfer(uuid, uuid, uuid, numeric, uuid, date, text) to authenticated;
grant execute on function public.record_owner_movement(uuid, text, numeric, uuid, uuid, date, text) to authenticated;
revoke all on function public.record_income(uuid, numeric, uuid, uuid, uuid, date, uuid, text, text) from anon;
revoke all on function public.record_expense(uuid, numeric, uuid, uuid, uuid, date, text, text, text) from anon;
revoke all on function public.record_refund(uuid, numeric, uuid, text, uuid, date) from anon;
revoke all on function public.record_transfer(uuid, uuid, uuid, numeric, uuid, date, text) from anon;
revoke all on function public.record_owner_movement(uuid, text, numeric, uuid, uuid, date, text) from anon;
revoke all on function private.create_transaction(uuid, public.transaction_kind, numeric, uuid, uuid, uuid, date, text, text, uuid, text, uuid, uuid, uuid, boolean, boolean) from public;
revoke all on function private.fmt_money(uuid, numeric) from public;
