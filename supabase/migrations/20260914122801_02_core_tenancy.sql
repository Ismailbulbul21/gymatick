-- GYMATICK 02: businesses, settings, branches, profiles, members, permissions
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  legal_name text check (legal_name is null or char_length(legal_name) <= 160),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 160),
  address text check (address is null or char_length(address) <= 300),
  city text check (city is null or char_length(city) <= 80),
  country text not null default 'Somalia' check (char_length(country) <= 80),
  logo_path text check (logo_path is null or char_length(logo_path) <= 300),
  go_live_date date,
  onboarding_completed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  avatar_path text,
  preferred_language text not null default 'en' check (preferred_language in ('en','so')),
  theme_preference text not null default 'system' check (theme_preference in ('system','light','dark')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete restrict,
  currency_code char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol text not null default '$' check (char_length(currency_symbol) between 1 and 5),
  currency_decimals smallint not null default 2 check (currency_decimals in (0,2)),
  locale text not null default 'en-US' check (char_length(locale) <= 20),
  timezone text not null default 'Africa/Mogadishu' check (char_length(timezone) <= 60),
  day_cutoff time not null default '00:00' check (day_cutoff <= time '06:00'),
  week_starts_on smallint not null default 6 check (week_starts_on between 0 and 6),
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Z0-9]{2,8}$'),
  invoice_footer text check (invoice_footer is null or char_length(invoice_footer) <= 500),
  invoice_default_due_days smallint check (invoice_default_due_days between 0 and 365),
  large_amount_threshold numeric(14,2) not null default 1000 check (large_amount_threshold > 0),
  staff_edit_window_minutes smallint not null default 10 check (staff_edit_window_minutes between 0 and 120),
  idle_timeout_minutes smallint not null default 30 check (idle_timeout_minutes between 5 and 480),
  salary_tracking_start_month date check (salary_tracking_start_month is null or extract(day from salary_tracking_start_month) = 1),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_default boolean not null default false,
  status public.record_status not null default 'active',
  address text check (address is null or char_length(address) <= 300),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);
create unique index branches_default_idx on public.branches (business_id) where is_default;
create unique index branches_name_idx on public.branches (business_id, lower(name));

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role public.member_role not null,
  status public.record_status not null default 'active',
  title text check (title is null or char_length(title) <= 60),
  invited_by uuid references public.profiles(id),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  unique (business_id, id)
);
create index business_members_user_idx on public.business_members (user_id, status);

create table public.permissions (
  key text primary key,
  module text not null,
  label text not null,
  description text not null,
  owner_only boolean not null default false,
  front_desk_default boolean not null default false,
  manager_preset boolean not null default false,
  sort_order smallint not null
);

create table public.member_permissions (
  member_id uuid not null references public.business_members(id) on delete cascade,
  permission_key text not null references public.permissions(key),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (member_id, permission_key)
);
create index member_permissions_key_idx on public.member_permissions (permission_key);

-- updated_at triggers
create trigger businesses_updated before update on public.businesses for each row execute function private.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function private.set_updated_at();
create trigger business_settings_updated before update on public.business_settings for each row execute function private.set_updated_at();
create trigger branches_updated before update on public.branches for each row execute function private.set_updated_at();
create trigger business_members_updated before update on public.business_members for each row execute function private.set_updated_at();

-- timezone must be real
create or replace function private.validate_timezone()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = new.timezone) then
    perform private.raise_error('INVALID_TIMEZONE', 'Unknown timezone: ' || new.timezone);
  end if;
  return new;
end $$;
create trigger business_settings_timezone before insert or update of timezone on public.business_settings
for each row execute function private.validate_timezone();

-- a business always keeps at least one active owner
create or replace function private.guard_last_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active')
     and not exists (
       select 1 from public.business_members m
       where m.business_id = old.business_id and m.id <> old.id
         and m.role = 'owner' and m.status = 'active') then
    perform private.raise_error('LAST_OWNER', 'GYMATICK needs at least one active owner.');
  end if;
  return new;
end $$;
create trigger business_members_last_owner before update on public.business_members
for each row execute function private.guard_last_owner();

-- owner-only permissions can never be granted to staff
create or replace function private.guard_owner_only_permission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.permissions p where p.key = new.permission_key and p.owner_only) then
    perform private.raise_error('OWNER_ONLY_PERMISSION', 'This permission is available to owners only.');
  end if;
  return new;
end $$;
create trigger member_permissions_owner_only before insert or update on public.member_permissions
for each row execute function private.guard_owner_only_permission();

-- auth.users -> profiles
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'user@local'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.handle_password_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set must_change_password = false where id = new.id and must_change_password;
  end if;
  return new;
end $$;
create trigger on_auth_password_changed after update of encrypted_password on auth.users
for each row execute function private.handle_password_change();

-- permission catalog
insert into public.permissions (key, module, label, description, owner_only, front_desk_default, manager_preset, sort_order) values
('dashboard.financials','dashboard','See financial overview','Current balance, pending salaries and closing results on the dashboard',false,false,true,10),
('income.view','income','View income','See income and refunds',false,true,true,20),
('income.create','income','Record income','Add money received',false,true,true,21),
('income.edit','income','Edit income','Change any income entry',false,false,true,22),
('expenses.view','expenses','View expenses','See expenses',false,true,true,30),
('expenses.create','expenses','Record expenses','Add money spent',false,true,true,31),
('expenses.edit','expenses','Edit expenses','Change any expense entry',false,false,true,32),
('transactions.view_all','transactions','Open the ledger','See every movement, including transfers and owner money',false,false,true,40),
('transactions.void','transactions','Void transactions','Cancel entries recorded by mistake (open days)',false,false,true,41),
('transactions.backdate','transactions','Record for earlier days','Use a date before today on open days',false,false,true,42),
('transactions.refund','transactions','Record refunds','Return money to a customer',false,false,true,43),
('money.transfer','transactions','Transfer between methods','Move money between cash, mobile money and bank',false,false,true,44),
('money.owner_movements','transactions','Owner deposits and withdrawals','Record owner money in or out',false,false,false,45),
('invoices.view','invoices','View invoices','See invoices and receipts',false,true,true,50),
('invoices.create','invoices','Create invoices','Issue invoices and receipts',false,true,true,51),
('invoices.record_payment','invoices','Record invoice payments','Collect payment or link an existing income',false,true,true,52),
('invoices.edit','invoices','Edit invoices','Change unpaid invoices',false,false,true,53),
('invoices.cancel','invoices','Cancel invoices','Cancel an invoice',false,false,true,54),
('customers.view','customers','View customers','See the customer list',false,true,true,60),
('customers.manage','customers','Manage customers','Add and edit customers',false,true,true,61),
('closings.view','closings','View Xisaab Xir','See closing previews, history and details',false,false,true,70),
('closings.perform','closings','Complete Xisaab Xir','Close the business day',false,false,true,71),
('closings.reopen','closings','Reopen a closed day','Reopen the most recent closing',true,false,false,72),
('closings.correct','closings','Correct closed days','Void transactions on a closed day',true,false,false,73),
('employees.view','employees','View employees','See employees',false,false,true,80),
('employees.manage','employees','Manage employees','Add, edit and deactivate employees',false,false,false,81),
('salaries.view','salaries','View salaries','See salary amounts, obligations and salary expenses',false,false,false,90),
('salaries.pay','salaries','Pay salaries','Record salary payments and advances',false,false,false,91),
('salaries.adjust','salaries','Adjust salaries','Pay more than the monthly obligation',false,false,false,92),
('reports.view','reports','View reports','Open reports and analytics',false,false,true,100),
('reports.export','reports','Export reports','Download CSV and print reports',false,false,false,101),
('audit.view','audit','View activity log','See who did what',false,false,false,110),
('settings.manage','settings','Manage settings','Business profile, preferences, categories, payment methods',false,false,false,120),
('users.manage','users','Manage users','Create users, set roles and permissions',true,false,false,130);
