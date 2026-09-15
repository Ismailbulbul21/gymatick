-- GYMATICK 04: categories, payment methods, customers, business bootstrap
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  kind public.category_kind not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  color text not null default 'slate' check (color in ('blue','orange','aqua','yellow','magenta','violet','slate','sky')),
  icon text check (icon is null or char_length(icon) <= 40),
  is_system boolean not null default false,
  system_code text check (system_code is null or system_code in ('salary')),
  status public.record_status not null default 'active',
  sort_order smallint not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, id, kind)
);
create unique index categories_name_idx on public.categories (business_id, kind, lower(name));
create unique index categories_system_idx on public.categories (business_id, system_code) where system_code is not null;
create index categories_list_idx on public.categories (business_id, kind, status, sort_order);
create trigger categories_updated before update on public.categories for each row execute function private.set_updated_at();

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  type public.payment_method_type not null,
  account_label text check (account_label is null or char_length(account_label) <= 60),
  include_in_closing boolean not null default true,
  status public.record_status not null default 'active',
  sort_order smallint not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);
create unique index payment_methods_name_idx on public.payment_methods (business_id, lower(name));
create index payment_methods_list_idx on public.payment_methods (business_id, status, sort_order);
create trigger payment_methods_updated before update on public.payment_methods for each row execute function private.set_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 160),
  member_code text check (member_code is null or char_length(member_code) <= 30),
  notes text check (notes is null or char_length(notes) <= 1000),
  status public.record_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);
create unique index customers_member_code_idx on public.customers (business_id, member_code) where member_code is not null;
create index customers_name_idx on public.customers using gin (full_name extensions.gin_trgm_ops);
create index customers_phone_idx on public.customers (business_id, phone);
create index customers_list_idx on public.customers (business_id, status, full_name);
create trigger customers_updated before update on public.customers for each row execute function private.set_updated_at();

revoke all on public.categories, public.payment_methods, public.customers from anon, authenticated;
grant select on public.categories, public.payment_methods, public.customers to authenticated;

alter table public.categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.customers enable row level security;

create policy categories_select on public.categories for select to authenticated
  using (business_id in (select private.my_business_ids()));
create policy payment_methods_select on public.payment_methods for select to authenticated
  using (business_id in (select private.my_business_ids()));
create policy customers_select on public.customers for select to authenticated
  using (business_id in (select private.businesses_with_permission('customers.view')));

-- default categories and payment methods for a new gym
create or replace function private.seed_business_defaults(p_business_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.categories (business_id, kind, name, color, sort_order, is_system, system_code) values
    (p_business_id,'income','Membership','blue',10,false,null),
    (p_business_id,'income','Registration','orange',20,false,null),
    (p_business_id,'income','Personal Training','violet',30,false,null),
    (p_business_id,'income','Gym Services','aqua',40,false,null),
    (p_business_id,'income','Products','yellow',50,false,null),
    (p_business_id,'income','Other Income','slate',60,false,null),
    (p_business_id,'expense','Rent','blue',10,false,null),
    (p_business_id,'expense','Electricity','yellow',20,false,null),
    (p_business_id,'expense','Water','sky',30,false,null),
    (p_business_id,'expense','Internet','slate',40,false,null),
    (p_business_id,'expense','Cleaning','aqua',50,false,null),
    (p_business_id,'expense','Equipment','magenta',60,false,null),
    (p_business_id,'expense','Maintenance','orange',70,false,null),
    (p_business_id,'expense','Salary','violet',80,true,'salary'),
    (p_business_id,'expense','Transportation','sky',90,false,null),
    (p_business_id,'expense','Supplies','aqua',100,false,null),
    (p_business_id,'expense','Marketing','slate',110,false,null),
    (p_business_id,'expense','Other','slate',120,false,null);

  insert into public.payment_methods (business_id, name, type, sort_order) values
    (p_business_id,'Cash','cash',10),
    (p_business_id,'EVC Plus','mobile_money',20),
    (p_business_id,'ZAAD','mobile_money',30),
    (p_business_id,'SAHAL','mobile_money',40),
    (p_business_id,'Bank','bank',50);
end $$;

-- one-time setup: creates the gym, its settings, default branch and the owner membership.
-- Service role only (run from the SQL editor or an admin script).
create or replace function private.bootstrap_business(
  p_owner_user_id uuid,
  p_name text,
  p_currency char(3) default 'USD',
  p_timezone text default 'Africa/Mogadishu')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_business uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = p_owner_user_id) then
    perform private.raise_error('USER_NOT_FOUND', 'Create the owner in Supabase Auth first.');
  end if;

  insert into public.businesses (name) values (btrim(p_name)) returning id into v_business;
  insert into public.business_settings (business_id, currency_code, timezone) values (v_business, p_currency, p_timezone);
  insert into public.branches (business_id, name, is_default) values (v_business, 'Main branch', true);
  insert into public.business_members (business_id, user_id, role, title)
    values (v_business, p_owner_user_id, 'owner', 'Owner');
  perform private.seed_business_defaults(v_business);
  perform private.write_audit(v_business, 'business.created', 'settings', 'business', v_business,
    'GYMATICK business created', null, jsonb_build_object('owner_user_id', p_owner_user_id));
  return v_business;
end $$;

revoke all on function private.seed_business_defaults(uuid) from public;
revoke all on function private.bootstrap_business(uuid, text, char, text) from public;
