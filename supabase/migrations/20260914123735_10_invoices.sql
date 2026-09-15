-- GYMATICK 10: invoices and their items; payments stay ledger rows
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null,
  invoice_number text not null,
  sequence_year integer not null,
  sequence_no integer not null,
  customer_id uuid,
  bill_to_name text check (bill_to_name is null or char_length(bill_to_name) <= 120),
  bill_to_phone text check (bill_to_phone is null or char_length(bill_to_phone) <= 30),
  income_category_id uuid not null,
  income_category_kind public.category_kind generated always as ('income'::public.category_kind) stored,
  issue_date date not null,
  due_date date,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  total numeric(14,2) generated always as (subtotal - discount_amount) stored,
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  status public.invoice_status not null default 'pending',
  notes text check (notes is null or char_length(notes) <= 1000),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text check (cancel_reason is null or char_length(btrim(cancel_reason)) between 5 and 500),
  idempotency_key uuid not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, invoice_number),
  unique (business_id, idempotency_key),
  constraint inv_branch_fk foreign key (business_id, branch_id) references public.branches (business_id, id),
  constraint inv_customer_fk foreign key (business_id, customer_id) references public.customers (business_id, id),
  constraint inv_category_fk foreign key (business_id, income_category_id, income_category_kind)
    references public.categories (business_id, id, kind),
  constraint inv_discount check (discount_amount <= subtotal),
  constraint inv_paid check (amount_paid <= subtotal - discount_amount),
  constraint inv_due check (due_date is null or due_date >= issue_date),
  constraint inv_cancel_fields check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null))
);
create index invoices_list_idx on public.invoices (business_id, issue_date desc);
create index invoices_status_idx on public.invoices (business_id, status, issue_date desc);
create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_category_idx on public.invoices (income_category_id);
create index invoices_branch_idx on public.invoices (branch_id);
create index invoices_number_idx on public.invoices using gin (invoice_number extensions.gin_trgm_ops);
create index invoices_billto_idx on public.invoices using gin (bill_to_name extensions.gin_trgm_ops);
create trigger invoices_updated before update on public.invoices for each row execute function private.set_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  invoice_id uuid not null,
  position smallint not null check (position between 1 and 50),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  unique (invoice_id, position),
  constraint item_invoice_fk foreign key (business_id, invoice_id) references public.invoices (business_id, id) on delete cascade
);
create index invoice_items_idx on public.invoice_items (invoice_id);

alter table public.financial_transactions
  add constraint ft_invoice_fk foreign key (business_id, invoice_id) references public.invoices (business_id, id);

-- derived invoice figures are maintained here and nowhere else
create or replace function private.sync_invoice_subtotal()
returns trigger language plpgsql set search_path = '' as $$
declare v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices i
  set subtotal = coalesce((select sum(it.line_total) from public.invoice_items it where it.invoice_id = v_invoice), 0)
  where i.id = v_invoice;
  return null;
end $$;
create trigger invoice_items_sync after insert or update or delete on public.invoice_items
for each row execute function private.sync_invoice_subtotal();

create or replace function private.sync_invoice_payments()
returns trigger language plpgsql set search_path = '' as $$
declare v_ids uuid[]; v_id uuid; v_paid numeric; v_total numeric; v_status public.invoice_status;
begin
  v_ids := array_remove(array[
    case when tg_op <> 'INSERT' then old.invoice_id end,
    case when tg_op <> 'DELETE' then new.invoice_id end], null);
  foreach v_id in array v_ids loop
    select coalesce(sum(case when t.kind = 'income' then t.amount else -t.amount end), 0)
    into v_paid
    from public.financial_transactions t
    where t.invoice_id = v_id and t.status = 'posted';
    select i.total, i.status into v_total, v_status from public.invoices i where i.id = v_id;
    update public.invoices i
    set amount_paid = greatest(v_paid, 0),
        status = case
          when i.status = 'cancelled' then 'cancelled'
          when v_paid >= i.total then 'paid'
          when v_paid > 0 then 'partially_paid'
          else 'pending' end
    where i.id = v_id;
  end loop;
  return null;
end $$;
create trigger financial_transactions_invoice_sync
after insert or update of status, invoice_id, amount on public.financial_transactions
for each row execute function private.sync_invoice_payments();

revoke all on public.invoices, public.invoice_items from anon, authenticated;
grant select on public.invoices, public.invoice_items to authenticated;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
create policy invoices_select on public.invoices for select to authenticated
  using (business_id in (select private.businesses_with_permission('invoices.view')));
create policy invoice_items_select on public.invoice_items for select to authenticated
  using (business_id in (select private.businesses_with_permission('invoices.view')));

create or replace function public.create_invoice(
  p_business_id uuid, p_items jsonb, p_income_category_id uuid, p_idempotency_key uuid,
  p_customer_id uuid default null, p_bill_to_name text default null, p_bill_to_phone text default null,
  p_issue_date date default null, p_due_date date default null, p_discount_amount numeric default 0,
  p_notes text default null, p_payment jsonb default null, p_link_transaction_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invoices; v_existing public.invoices; v_item jsonb; v_pos smallint := 0;
  v_subtotal numeric := 0; v_issue date; v_branch uuid; v_seq bigint; v_prefix text;
  v_number text; v_category uuid; v_customer uuid; v_link public.financial_transactions;
  v_tx public.financial_transactions; v_name text; v_phone text;
begin
  perform private.assert_permission(p_business_id, 'invoices.create');
  select * into v_existing from public.invoices i
  where i.business_id = p_business_id and i.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('invoice_id', v_existing.id, 'invoice_number', v_existing.invoice_number,
      'total', v_existing.total, 'amount_paid', v_existing.amount_paid, 'status', v_existing.status, 'replayed', true);
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    perform private.raise_error('INVALID_INPUT', 'Add at least one line to the invoice.');
  end if;
  if jsonb_array_length(p_items) > 50 then
    perform private.raise_error('INVALID_INPUT', 'An invoice can have at most 50 lines.');
  end if;
  if p_payment is not null and p_link_transaction_id is not null then
    perform private.raise_error('INVALID_INPUT', 'Choose either a new payment or an existing one.');
  end if;

  v_branch := private.default_branch_id(p_business_id);
  v_issue := coalesce(p_issue_date, private.current_business_date(p_business_id));
  v_category := p_income_category_id;
  v_customer := p_customer_id;
  v_name := nullif(btrim(coalesce(p_bill_to_name, '')), '');
  v_phone := nullif(btrim(coalesce(p_bill_to_phone, '')), '');

  if p_link_transaction_id is not null then
    perform private.assert_permission(p_business_id, 'invoices.record_payment');
    select * into v_link from public.financial_transactions t where t.id = p_link_transaction_id for update;
    if not found or v_link.business_id <> p_business_id then
      perform private.raise_error('NOT_FOUND', 'That payment no longer exists.');
    end if;
    if v_link.kind <> 'income' or v_link.status <> 'posted' then
      perform private.raise_error('INVALID_INPUT', 'Only a posted income can be attached.');
    end if;
    if v_link.invoice_id is not null then
      perform private.raise_error('TRANSACTION_ALREADY_LINKED', 'This payment already belongs to another invoice.');
    end if;
    v_category := v_link.category_id;
    v_customer := coalesce(v_customer, v_link.customer_id);
  end if;

  if not exists (select 1 from public.categories c
                 where c.business_id = p_business_id and c.id = v_category
                   and c.kind = 'income' and c.status = 'active') then
    perform private.raise_error('CATEGORY_INVALID', 'Choose an active income category.');
  end if;

  if v_customer is not null then
    select c.full_name, c.phone into v_name, v_phone from public.customers c
    where c.business_id = p_business_id and c.id = v_customer and c.status = 'active';
    if v_name is null then perform private.raise_error('CUSTOMER_INVALID', 'Choose an active customer.'); end if;
  end if;

  for v_item in select jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + round(coalesce((v_item ->> 'quantity')::numeric, 0)
                                     * coalesce((v_item ->> 'unit_price')::numeric, 0), 2);
  end loop;
  if coalesce(p_discount_amount, 0) < 0 or coalesce(p_discount_amount, 0) > v_subtotal then
    perform private.raise_error('INVALID_INPUT', 'The discount cannot be more than the subtotal.');
  end if;

  select s.invoice_prefix into v_prefix from public.business_settings s where s.business_id = p_business_id;
  v_seq := private.next_sequence_value(p_business_id, 'invoice', extract(year from v_issue)::text);
  v_number := format('%s-%s-%s', v_prefix, extract(year from v_issue)::text, lpad(v_seq::text, 5, '0'));

  insert into public.invoices (business_id, branch_id, invoice_number, sequence_year, sequence_no,
    customer_id, bill_to_name, bill_to_phone, income_category_id, issue_date, due_date,
    subtotal, discount_amount, notes, idempotency_key, created_by)
  values (p_business_id, v_branch, v_number, extract(year from v_issue)::int, v_seq,
    v_customer, v_name, v_phone, v_category, v_issue, p_due_date,
    v_subtotal, round(coalesce(p_discount_amount, 0), 2), nullif(btrim(coalesce(p_notes, '')), ''),
    p_idempotency_key, (select auth.uid()))
  returning * into v_inv;

  for v_item in select jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    insert into public.invoice_items (business_id, invoice_id, position, description, quantity, unit_price)
    values (p_business_id, v_inv.id, v_pos, btrim(v_item ->> 'description'),
      (v_item ->> 'quantity')::numeric, (v_item ->> 'unit_price')::numeric);
  end loop;

  if p_link_transaction_id is not null then
    if v_link.amount > v_inv.total then
      perform private.raise_error('OVERPAYMENT',
        format('That payment (%s) is more than the invoice total (%s).',
          private.fmt_money(p_business_id, v_link.amount), private.fmt_money(p_business_id, v_inv.total)));
    end if;
    update public.financial_transactions t set invoice_id = v_inv.id, updated_by = (select auth.uid())
    where t.id = v_link.id;
    perform private.write_audit(p_business_id, 'invoice.income_linked', 'invoices', 'invoice', v_inv.id,
      format('Invoice %s linked to existing payment %s', v_number, private.fmt_money(p_business_id, v_link.amount)),
      null, jsonb_build_object('transaction_id', v_link.id));
  elsif p_payment is not null then
    perform private.assert_permission(p_business_id, 'invoices.record_payment');
    if round(coalesce((p_payment ->> 'amount')::numeric, 0), 2) > v_inv.total then
      perform private.raise_error('OVERPAYMENT', 'The payment is more than the invoice total.');
    end if;
    v_tx := private.create_transaction(
      p_business_id => p_business_id, p_kind => 'income',
      p_amount => round((p_payment ->> 'amount')::numeric, 2),
      p_payment_method_id => (p_payment ->> 'payment_method_id')::uuid,
      p_idempotency_key => coalesce((p_payment ->> 'idempotency_key')::uuid, md5(p_idempotency_key::text || ':pay')::uuid),
      p_category_id => v_category, p_business_date => (p_payment ->> 'business_date')::date,
      p_description => format('Invoice %s%s', v_number, case when v_name is null then '' else ' - ' || v_name end),
      p_customer_id => v_customer, p_invoice_id => v_inv.id);
  end if;

  select * into v_inv from public.invoices i where i.id = v_inv.id;
  perform private.write_audit(p_business_id, 'invoice.created', 'invoices', 'invoice', v_inv.id,
    format('Created invoice %s for %s (%s)', v_number, coalesce(v_name, 'Walk-in customer'),
      private.fmt_money(p_business_id, v_inv.total)),
    null, jsonb_build_object('total', v_inv.total, 'status', v_inv.status));

  return jsonb_build_object('invoice_id', v_inv.id, 'invoice_number', v_inv.invoice_number,
    'total', v_inv.total, 'amount_paid', v_inv.amount_paid, 'status', v_inv.status,
    'transaction_id', v_tx.id);
end $$;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid, p_amount numeric, p_payment_method_id uuid, p_idempotency_key uuid,
  p_business_date date default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inv public.invoices; v_tx public.financial_transactions;
begin
  select * into v_inv from public.invoices i where i.id = p_invoice_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That invoice no longer exists.'); end if;
  perform private.assert_permission(v_inv.business_id, 'invoices.record_payment');
  if v_inv.status = 'cancelled' then
    perform private.raise_error('INVOICE_CANCELLED', 'This invoice is cancelled.');
  end if;
  if round(p_amount, 2) > v_inv.total - v_inv.amount_paid then
    perform private.raise_error('OVERPAYMENT',
      format('The payment is more than the balance due (%s).',
        private.fmt_money(v_inv.business_id, v_inv.total - v_inv.amount_paid)),
      jsonb_build_object('balance_due', v_inv.total - v_inv.amount_paid));
  end if;

  v_tx := private.create_transaction(
    p_business_id => v_inv.business_id, p_kind => 'income', p_amount => round(p_amount, 2),
    p_payment_method_id => p_payment_method_id, p_idempotency_key => p_idempotency_key,
    p_category_id => v_inv.income_category_id, p_business_date => p_business_date,
    p_description => format('Invoice %s%s', v_inv.invoice_number,
      case when v_inv.bill_to_name is null then '' else ' - ' || v_inv.bill_to_name end),
    p_notes => p_notes, p_customer_id => v_inv.customer_id, p_invoice_id => v_inv.id);

  select * into v_inv from public.invoices i where i.id = p_invoice_id;
  perform private.write_audit(v_inv.business_id, 'invoice.payment_recorded', 'invoices', 'invoice', v_inv.id,
    format('Payment of %s recorded for invoice %s',
      private.fmt_money(v_inv.business_id, p_amount), v_inv.invoice_number),
    null, jsonb_build_object('transaction_id', v_tx.id, 'status', v_inv.status));
  return jsonb_build_object('invoice_id', v_inv.id, 'transaction_id', v_tx.id,
    'amount_paid', v_inv.amount_paid, 'status', v_inv.status, 'balance_due', v_inv.total - v_inv.amount_paid);
end $$;

create or replace function public.link_income_to_invoice(p_invoice_id uuid, p_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inv public.invoices; v_tx public.financial_transactions;
begin
  select * into v_inv from public.invoices i where i.id = p_invoice_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That invoice no longer exists.'); end if;
  perform private.assert_permission(v_inv.business_id, 'invoices.record_payment');
  select * into v_tx from public.financial_transactions t where t.id = p_transaction_id for update;
  if not found or v_tx.business_id <> v_inv.business_id then
    perform private.raise_error('NOT_FOUND', 'That payment no longer exists.');
  end if;
  if v_tx.kind <> 'income' or v_tx.status <> 'posted' then
    perform private.raise_error('INVALID_INPUT', 'Only a posted income can be attached.');
  end if;
  if v_tx.invoice_id is not null then
    perform private.raise_error('TRANSACTION_ALREADY_LINKED', 'This payment already belongs to another invoice.');
  end if;
  if v_inv.status = 'cancelled' then
    perform private.raise_error('INVOICE_CANCELLED', 'This invoice is cancelled.');
  end if;
  if v_tx.amount > v_inv.total - v_inv.amount_paid then
    perform private.raise_error('OVERPAYMENT', 'That payment is more than the balance due.');
  end if;
  if v_inv.amount_paid = 0 and v_tx.category_id is distinct from v_inv.income_category_id then
    update public.invoices set income_category_id = v_tx.category_id where id = v_inv.id;
  elsif v_tx.category_id is distinct from v_inv.income_category_id then
    perform private.raise_error('CATEGORY_MISMATCH', 'This payment uses a different income category.');
  end if;

  update public.financial_transactions t set invoice_id = v_inv.id, updated_by = (select auth.uid())
  where t.id = v_tx.id;
  select * into v_inv from public.invoices i where i.id = p_invoice_id;
  perform private.write_audit(v_inv.business_id, 'invoice.income_linked', 'invoices', 'invoice', v_inv.id,
    format('Invoice %s linked to payment %s', v_inv.invoice_number,
      private.fmt_money(v_inv.business_id, v_tx.amount)),
    null, jsonb_build_object('transaction_id', v_tx.id));
  return jsonb_build_object('invoice_id', v_inv.id, 'amount_paid', v_inv.amount_paid, 'status', v_inv.status);
end $$;

create or replace function public.update_invoice(p_invoice_id uuid, p_patch jsonb)
returns public.invoices language plpgsql security definer set search_path = '' as $$
declare v_inv public.invoices; v_new public.invoices;
begin
  select * into v_inv from public.invoices i where i.id = p_invoice_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That invoice no longer exists.'); end if;
  perform private.assert_permission(v_inv.business_id, 'invoices.edit');
  if v_inv.status = 'cancelled' then
    perform private.raise_error('INVOICE_CANCELLED', 'This invoice is cancelled.');
  end if;
  if v_inv.amount_paid > 0 and (p_patch ? 'issue_date' or p_patch ? 'due_date'
      or p_patch ? 'discount_amount' or p_patch ? 'customer_id' or p_patch ? 'income_category_id') then
    perform private.raise_error('INVOICE_HAS_PAYMENTS', 'This invoice has payments. Only notes can change.');
  end if;
  update public.invoices i set
    issue_date = coalesce((p_patch ->> 'issue_date')::date, i.issue_date),
    due_date = case when p_patch ? 'due_date' then (p_patch ->> 'due_date')::date else i.due_date end,
    discount_amount = coalesce(round((p_patch ->> 'discount_amount')::numeric, 2), i.discount_amount),
    notes = case when p_patch ? 'notes' then nullif(btrim(coalesce(p_patch ->> 'notes', '')), '') else i.notes end,
    updated_by = (select auth.uid())
  where i.id = p_invoice_id returning * into v_new;
  perform private.write_audit(v_inv.business_id, 'invoice.updated', 'invoices', 'invoice', v_inv.id,
    format('Updated invoice %s', v_inv.invoice_number));
  return v_new;
end $$;

create or replace function public.cancel_invoice(
  p_invoice_id uuid, p_reason text, p_void_payments boolean default false)
returns public.invoices language plpgsql security definer set search_path = '' as $$
declare v_inv public.invoices; v_new public.invoices; v_tx record;
begin
  select * into v_inv from public.invoices i where i.id = p_invoice_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That invoice no longer exists.'); end if;
  perform private.assert_permission(v_inv.business_id, 'invoices.cancel');
  if v_inv.status = 'cancelled' then
    perform private.raise_error('INVOICE_CANCELLED', 'This invoice is already cancelled.');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform private.raise_error('REASON_REQUIRED', 'Please give a reason (at least 5 characters).');
  end if;
  if v_inv.amount_paid > 0 then
    if not p_void_payments then
      perform private.raise_error('INVOICE_HAS_PAYMENTS',
        'This invoice has payments. Void them first, or choose to void and cancel.');
    end if;
    for v_tx in select t.id from public.financial_transactions t
                where t.invoice_id = v_inv.id and t.status = 'posted' loop
      perform public.void_transaction(v_tx.id, 'Invoice cancelled: ' || btrim(p_reason));
    end loop;
  end if;
  update public.invoices i
  set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()),
      cancel_reason = btrim(p_reason), updated_by = (select auth.uid())
  where i.id = p_invoice_id returning * into v_new;
  perform private.write_audit(v_inv.business_id, 'invoice.cancelled', 'invoices', 'invoice', v_inv.id,
    format('Cancelled invoice %s - %s', v_inv.invoice_number, btrim(p_reason)),
    null, jsonb_build_object('reason', btrim(p_reason), 'voided_payments', p_void_payments));
  return v_new;
end $$;

grant execute on function public.create_invoice(uuid, jsonb, uuid, uuid, uuid, text, text, date, date, numeric, text, jsonb, uuid) to authenticated;
grant execute on function public.record_invoice_payment(uuid, numeric, uuid, uuid, date, text) to authenticated;
grant execute on function public.link_income_to_invoice(uuid, uuid) to authenticated;
grant execute on function public.update_invoice(uuid, jsonb) to authenticated;
grant execute on function public.cancel_invoice(uuid, text, boolean) to authenticated;
revoke all on function public.create_invoice(uuid, jsonb, uuid, uuid, uuid, text, text, date, date, numeric, text, jsonb, uuid) from anon;
revoke all on function public.record_invoice_payment(uuid, numeric, uuid, uuid, date, text) from anon;
revoke all on function public.link_income_to_invoice(uuid, uuid) from anon;
revoke all on function public.update_invoice(uuid, jsonb) from anon;
revoke all on function public.cancel_invoice(uuid, text, boolean) from anon;
