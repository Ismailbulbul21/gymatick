-- GYMATICK 01: extensions, private schema, enum types, shared helpers
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.member_role as enum ('owner','staff');
create type public.record_status as enum ('active','inactive');
create type public.category_kind as enum ('income','expense');
create type public.payment_method_type as enum ('cash','mobile_money','bank','other');
create type public.transaction_kind as enum ('income','refund','expense','transfer_in','transfer_out','owner_deposit','owner_withdrawal');
create type public.transaction_status as enum ('posted','voided');
create type public.invoice_status as enum ('pending','partially_paid','paid','cancelled');
create type public.closing_kind as enum ('opening','daily');
create type public.closing_status as enum ('closed','reopened');
create type public.salary_payment_type as enum ('salary','advance','adjustment');

-- updated_at maintenance
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- coded errors: message = code, detail = human sentence, hint = json payload
create or replace function private.raise_error(p_code text, p_detail text default null, p_hint jsonb default null)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using
    errcode = 'P0001',
    message = p_code,
    detail  = coalesce(p_detail, p_code),
    hint    = coalesce(p_hint::text, '{}');
end $$;

-- per-business advisory lock (shared for ledger writes, exclusive for closings)
create or replace function private.lock_business(p_business_id uuid, p_exclusive boolean default false)
returns void language plpgsql set search_path = '' as $$
declare
  v_key bigint := ('x' || substr(md5(p_business_id::text), 1, 15))::bit(60)::bigint;
begin
  if p_exclusive then
    perform pg_catalog.pg_advisory_xact_lock(v_key);
  else
    perform pg_catalog.pg_advisory_xact_lock_shared(v_key);
  end if;
end $$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.raise_error(text, text, jsonb) from public;
revoke all on function private.lock_business(uuid, boolean) from public;
