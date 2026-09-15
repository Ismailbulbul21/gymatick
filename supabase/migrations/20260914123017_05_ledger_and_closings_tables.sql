-- GYMATICK 05: document sequences, the ledger, daily closings and their guards
create table public.document_sequences (
  business_id uuid not null references public.businesses(id) on delete restrict,
  sequence_name text not null check (sequence_name in ('transaction','invoice')),
  period_key text not null,
  last_value bigint not null default 0,
  primary key (business_id, sequence_name, period_key)
);

create or replace function private.next_sequence_value(p_business_id uuid, p_name text, p_period text)
returns bigint language sql security definer set search_path = '' as $$
  insert into public.document_sequences as ds (business_id, sequence_name, period_key, last_value)
  values (p_business_id, p_name, p_period, 1)
  on conflict (business_id, sequence_name, period_key)
  do update set last_value = ds.last_value + 1
  returning ds.last_value
$$;

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null,
  reference_no bigint not null,
  kind public.transaction_kind not null,
  status public.transaction_status not null default 'posted',
  amount numeric(14,2) not null check (amount > 0 and amount <= 999999999999.99),
  signed_amount numeric(14,2) generated always as
    (case when kind in ('income','transfer_in','owner_deposit') then amount else -amount end) stored,
  category_id uuid,
  category_kind public.category_kind generated always as
    (case when kind in ('income','refund') then 'income'::public.category_kind
          when kind = 'expense' then 'expense'::public.category_kind end) stored,
  payment_method_id uuid not null,
  business_date date not null,
  occurred_at timestamptz not null default now(),
  is_backdated boolean not null default false,
  description text not null check (char_length(btrim(description)) between 1 and 300),
  notes text check (notes is null or char_length(notes) <= 2000),
  customer_id uuid,
  vendor text check (vendor is null or char_length(vendor) <= 120),
  invoice_id uuid,
  related_transaction_id uuid,
  transfer_group_id uuid,
  is_salary boolean not null default false,
  idempotency_key uuid not null,
  void_reason text check (void_reason is null or char_length(btrim(void_reason)) between 5 and 500),
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, reference_no),
  unique (business_id, idempotency_key),
  constraint ft_branch_fk foreign key (business_id, branch_id) references public.branches (business_id, id),
  constraint ft_method_fk foreign key (business_id, payment_method_id) references public.payment_methods (business_id, id),
  constraint ft_category_fk foreign key (business_id, category_id, category_kind) references public.categories (business_id, id, kind),
  constraint ft_customer_fk foreign key (business_id, customer_id) references public.customers (business_id, id),
  constraint ft_related_fk foreign key (business_id, related_transaction_id) references public.financial_transactions (business_id, id),
  constraint ft_category_required check ((kind in ('income','refund','expense')) = (category_id is not null)),
  constraint ft_customer_kind check (customer_id is null or kind in ('income','refund')),
  constraint ft_invoice_kind check (invoice_id is null or kind in ('income','refund')),
  constraint ft_vendor_kind check (vendor is null or kind = 'expense'),
  constraint ft_salary_kind check (not is_salary or kind = 'expense'),
  constraint ft_transfer_group check ((kind in ('transfer_in','transfer_out')) = (transfer_group_id is not null)),
  constraint ft_refund_link check (kind <> 'refund' or related_transaction_id is not null),
  constraint ft_void_fields check ((status = 'voided') = (voided_at is not null and voided_by is not null and void_reason is not null))
);

create index ft_list_idx on public.financial_transactions (business_id, business_date desc, created_at desc);
create index ft_posted_idx on public.financial_transactions (business_id, business_date desc, created_at desc) where status = 'posted';
create index ft_kind_idx on public.financial_transactions (business_id, kind, business_date) where status = 'posted';
create index ft_category_idx on public.financial_transactions (business_id, category_id, business_date) where status = 'posted';
create index ft_method_idx on public.financial_transactions (business_id, payment_method_id, business_date) where status = 'posted';
create index ft_invoice_idx on public.financial_transactions (invoice_id) where invoice_id is not null;
create index ft_customer_idx on public.financial_transactions (customer_id, business_date desc) where customer_id is not null;
create index ft_related_idx on public.financial_transactions (related_transaction_id) where related_transaction_id is not null;
create index ft_transfer_idx on public.financial_transactions (transfer_group_id) where transfer_group_id is not null;
create index ft_creator_idx on public.financial_transactions (business_id, created_by, created_at desc);
create index ft_branch_idx on public.financial_transactions (branch_id);
create index ft_voided_by_idx on public.financial_transactions (voided_by) where voided_by is not null;
create index ft_search_idx on public.financial_transactions using gin (description extensions.gin_trgm_ops);
create trigger financial_transactions_updated before update on public.financial_transactions for each row execute function private.set_updated_at();

create table public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null,
  kind public.closing_kind not null default 'daily',
  period_start date not null,
  business_date date not null,
  status public.closing_status not null default 'closed',
  opening_total numeric(14,2) not null default 0,
  income_total numeric(14,2) not null default 0,
  refund_total numeric(14,2) not null default 0,
  expense_total numeric(14,2) not null default 0,
  salary_total numeric(14,2) not null default 0,
  owner_deposit_total numeric(14,2) not null default 0,
  owner_withdrawal_total numeric(14,2) not null default 0,
  transfer_total numeric(14,2) not null default 0,
  money_in_total numeric(14,2) not null default 0,
  money_out_total numeric(14,2) not null default 0,
  expected_total numeric(14,2) not null default 0,
  actual_total numeric(14,2) not null default 0,
  difference_total numeric(14,2) not null default 0,
  transaction_count integer not null default 0,
  lines_with_difference smallint not null default 0,
  is_balanced boolean generated always as (difference_total = 0 and lines_with_difference = 0) stored,
  notes text check (notes is null or char_length(notes) <= 1000),
  closed_by uuid not null references public.profiles(id),
  closed_at timestamptz not null default now(),
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  reopen_reason text check (reopen_reason is null or char_length(btrim(reopen_reason)) between 5 and 500),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, idempotency_key),
  constraint dc_branch_fk foreign key (business_id, branch_id) references public.branches (business_id, id),
  constraint dc_period check (period_start <= business_date),
  constraint dc_notes_required check (difference_total = 0 and lines_with_difference = 0 or char_length(btrim(coalesce(notes,''))) >= 5),
  constraint dc_reopen_fields check ((status = 'reopened') = (reopened_at is not null and reopened_by is not null and reopen_reason is not null))
);
create unique index dc_active_idx on public.daily_closings (business_id, branch_id, business_date) where status = 'closed';
create index dc_list_idx on public.daily_closings (business_id, business_date desc);
create index dc_closed_by_idx on public.daily_closings (closed_by);
create trigger daily_closings_updated before update on public.daily_closings for each row execute function private.set_updated_at();

create table public.daily_closing_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  closing_id uuid not null,
  payment_method_id uuid not null,
  opening_amount numeric(14,2) not null default 0,
  money_in numeric(14,2) not null default 0,
  money_out numeric(14,2) not null default 0,
  expected_amount numeric(14,2) not null default 0,
  actual_amount numeric(14,2) not null default 0 check (actual_amount >= 0),
  difference numeric(14,2) generated always as (actual_amount - expected_amount) stored,
  unique (closing_id, payment_method_id),
  constraint dcl_closing_fk foreign key (business_id, closing_id) references public.daily_closings (business_id, id) on delete cascade,
  constraint dcl_method_fk foreign key (business_id, payment_method_id) references public.payment_methods (business_id, id)
);
create index dcl_closing_idx on public.daily_closing_lines (closing_id);
create index dcl_method_idx on public.daily_closing_lines (payment_method_id);

-- period locking -------------------------------------------------------------
create or replace function private.last_checkpoint(p_business_id uuid, p_branch_id uuid)
returns table (closing_id uuid, checkpoint_date date) language sql stable security definer set search_path = '' as $$
  select c.id, c.business_date from public.daily_closings c
  where c.business_id = p_business_id and c.branch_id = p_branch_id and c.status = 'closed'
  order by c.business_date desc limit 1
$$;

create or replace function private.is_period_closed(p_business_id uuid, p_branch_id uuid, p_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.daily_closings c
    where c.business_id = p_business_id and c.branch_id = p_branch_id
      and c.status = 'closed' and c.business_date >= p_date)
$$;

create or replace function private.assert_period_open(p_business_id uuid, p_branch_id uuid, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_checkpoint date;
begin
  select checkpoint_date into v_checkpoint from private.last_checkpoint(p_business_id, p_branch_id);
  if v_checkpoint is null then
    perform private.raise_error('ONBOARDING_REQUIRED', 'Set the opening balances before recording money.');
  end if;
  if p_date <= v_checkpoint then
    perform private.raise_error('DAY_CLOSED',
      to_char(p_date, 'DD Mon YYYY') || ' is closed by Xisaab Xir.',
      jsonb_build_object('next_open_date', v_checkpoint + 1));
  end if;
end $$;

create or replace function private.guard_transaction_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.assert_period_open(new.business_id, new.branch_id, new.business_date);
    return new;
  end if;

  if new.business_id <> old.business_id or new.branch_id <> old.branch_id or new.kind <> old.kind
     or new.reference_no <> old.reference_no or new.idempotency_key <> old.idempotency_key
     or new.created_by <> old.created_by or new.created_at <> old.created_at
     or new.is_salary <> old.is_salary
     or new.transfer_group_id is distinct from old.transfer_group_id
     or new.related_transaction_id is distinct from old.related_transaction_id then
    perform private.raise_error('IMMUTABLE_FIELD', 'This part of a transaction can never change.');
  end if;

  if old.invoice_id is not null and new.invoice_id is distinct from old.invoice_id then
    perform private.raise_error('IMMUTABLE_FIELD', 'This payment already belongs to an invoice.');
  end if;

  if old.status = 'voided' and new.status = 'voided' then
    perform private.raise_error('ALREADY_VOIDED', 'This transaction is already voided.');
  end if;

  if new.status = 'posted' and old.status = 'voided' then
    perform private.raise_error('IMMUTABLE_FIELD', 'A voided transaction cannot be restored.');
  end if;

  -- financial fields may only change while the day is open
  if new.amount <> old.amount or new.business_date <> old.business_date
     or new.category_id is distinct from old.category_id
     or new.payment_method_id <> old.payment_method_id then
    perform private.assert_period_open(old.business_id, old.branch_id, old.business_date);
    perform private.assert_period_open(new.business_id, new.branch_id, new.business_date);
  end if;

  return new;
end $$;
create trigger financial_transactions_guard before insert or update on public.financial_transactions
for each row execute function private.guard_transaction_changes();

-- privileges and RLS ---------------------------------------------------------
revoke all on public.financial_transactions, public.daily_closings, public.daily_closing_lines,
  public.document_sequences from anon, authenticated;
grant select on public.financial_transactions, public.daily_closings, public.daily_closing_lines to authenticated;

alter table public.financial_transactions enable row level security;
alter table public.daily_closings enable row level security;
alter table public.daily_closing_lines enable row level security;
alter table public.document_sequences enable row level security;

create policy ft_select_money_in on public.financial_transactions for select to authenticated
  using (kind in ('income','refund') and business_id in (select private.businesses_with_permission('income.view')));
create policy ft_select_money_out on public.financial_transactions for select to authenticated
  using (kind = 'expense'
         and business_id in (select private.businesses_with_permission('expenses.view'))
         and (not is_salary or business_id in (select private.businesses_with_permission('salaries.view'))));
create policy ft_select_movements on public.financial_transactions for select to authenticated
  using (kind in ('transfer_in','transfer_out','owner_deposit','owner_withdrawal')
         and business_id in (select private.businesses_with_permission('transactions.view_all')));

create policy dc_select on public.daily_closings for select to authenticated
  using (business_id in (select private.businesses_with_permission('closings.view')));
create policy dcl_select on public.daily_closing_lines for select to authenticated
  using (business_id in (select private.businesses_with_permission('closings.view')));

revoke all on function private.next_sequence_value(uuid, text, text) from public;
revoke all on function private.assert_period_open(uuid, uuid, date) from public;
grant execute on function private.is_period_closed(uuid, uuid, date) to authenticated;
grant execute on function private.last_checkpoint(uuid, uuid) to authenticated;
