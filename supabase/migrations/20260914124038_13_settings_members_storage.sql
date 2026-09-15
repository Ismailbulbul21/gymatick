-- GYMATICK 13: settings, master data, members, profile, storage and realtime
create or replace function public.update_business_profile(p_business_id uuid, p_patch jsonb)
returns public.businesses language plpgsql security definer set search_path = '' as $$
declare v_row public.businesses;
begin
  perform private.assert_permission(p_business_id, 'settings.manage');
  update public.businesses b set
    name = coalesce(nullif(btrim(coalesce(p_patch ->> 'name', '')), ''), b.name),
    legal_name = case when p_patch ? 'legal_name' then nullif(btrim(coalesce(p_patch ->> 'legal_name','')),'') else b.legal_name end,
    phone = case when p_patch ? 'phone' then nullif(btrim(coalesce(p_patch ->> 'phone','')),'') else b.phone end,
    email = case when p_patch ? 'email' then nullif(btrim(coalesce(p_patch ->> 'email','')),'') else b.email end,
    address = case when p_patch ? 'address' then nullif(btrim(coalesce(p_patch ->> 'address','')),'') else b.address end,
    city = case when p_patch ? 'city' then nullif(btrim(coalesce(p_patch ->> 'city','')),'') else b.city end,
    country = coalesce(nullif(btrim(coalesce(p_patch ->> 'country', '')), ''), b.country),
    logo_path = case when p_patch ? 'logo_path' then nullif(btrim(coalesce(p_patch ->> 'logo_path','')),'') else b.logo_path end
  where b.id = p_business_id returning * into v_row;
  perform private.write_audit(p_business_id, 'settings.profile_updated', 'settings', 'business', p_business_id,
    'Business profile updated', p_patch);
  return v_row;
end $$;

create or replace function public.update_business_settings(p_business_id uuid, p_patch jsonb)
returns public.business_settings language plpgsql security definer set search_path = '' as $$
declare v_old public.business_settings; v_row public.business_settings;
begin
  perform private.assert_permission(p_business_id, 'settings.manage');
  select * into v_old from public.business_settings s where s.business_id = p_business_id;
  if (p_patch ? 'currency_code' or p_patch ? 'currency_decimals')
     and exists (select 1 from public.financial_transactions t where t.business_id = p_business_id)
     and (coalesce(p_patch ->> 'currency_code', v_old.currency_code) <> v_old.currency_code
          or coalesce((p_patch ->> 'currency_decimals')::smallint, v_old.currency_decimals) <> v_old.currency_decimals) then
    perform private.raise_error('CURRENCY_LOCKED', 'Currency cannot change after transactions are recorded.');
  end if;
  update public.business_settings s set
    currency_code = coalesce(upper(nullif(btrim(coalesce(p_patch ->> 'currency_code','')),'')), s.currency_code),
    currency_symbol = coalesce(nullif(btrim(coalesce(p_patch ->> 'currency_symbol','')),''), s.currency_symbol),
    currency_decimals = coalesce((p_patch ->> 'currency_decimals')::smallint, s.currency_decimals),
    locale = coalesce(nullif(btrim(coalesce(p_patch ->> 'locale','')),''), s.locale),
    timezone = coalesce(nullif(btrim(coalesce(p_patch ->> 'timezone','')),''), s.timezone),
    day_cutoff = coalesce((p_patch ->> 'day_cutoff')::time, s.day_cutoff),
    week_starts_on = coalesce((p_patch ->> 'week_starts_on')::smallint, s.week_starts_on),
    invoice_prefix = coalesce(upper(nullif(btrim(coalesce(p_patch ->> 'invoice_prefix','')),'')), s.invoice_prefix),
    invoice_footer = case when p_patch ? 'invoice_footer' then nullif(btrim(coalesce(p_patch ->> 'invoice_footer','')),'') else s.invoice_footer end,
    invoice_default_due_days = case when p_patch ? 'invoice_default_due_days' then (p_patch ->> 'invoice_default_due_days')::smallint else s.invoice_default_due_days end,
    large_amount_threshold = coalesce((p_patch ->> 'large_amount_threshold')::numeric, s.large_amount_threshold),
    staff_edit_window_minutes = coalesce((p_patch ->> 'staff_edit_window_minutes')::smallint, s.staff_edit_window_minutes),
    idle_timeout_minutes = coalesce((p_patch ->> 'idle_timeout_minutes')::smallint, s.idle_timeout_minutes),
    updated_by = (select auth.uid())
  where s.business_id = p_business_id returning * into v_row;
  perform private.write_audit(p_business_id, 'settings.preferences_updated', 'settings', 'business', p_business_id,
    'Financial preferences updated', p_patch);
  return v_row;
end $$;

create or replace function public.save_category(p_business_id uuid, p_data jsonb, p_category_id uuid default null)
returns public.categories language plpgsql security definer set search_path = '' as $$
declare v_row public.categories; v_old public.categories;
begin
  perform private.assert_permission(p_business_id, 'settings.manage');
  if p_category_id is null then
    insert into public.categories (business_id, kind, name, description, color, sort_order, created_by)
    values (p_business_id, (p_data ->> 'kind')::public.category_kind, btrim(p_data ->> 'name'),
      nullif(btrim(coalesce(p_data ->> 'description','')),''), coalesce(p_data ->> 'color', 'slate'),
      coalesce((p_data ->> 'sort_order')::smallint, 500), (select auth.uid()))
    returning * into v_row;
    perform private.write_audit(p_business_id, 'category.created', 'settings', 'category', v_row.id,
      format('Added %s category "%s"', v_row.kind, v_row.name));
  else
    select * into v_old from public.categories c where c.id = p_category_id and c.business_id = p_business_id;
    if not found then perform private.raise_error('NOT_FOUND', 'That category no longer exists.'); end if;
    if v_old.is_system and coalesce(nullif(btrim(coalesce(p_data ->> 'name','')),''), v_old.name) <> v_old.name then
      perform private.raise_error('SYSTEM_CATEGORY', 'System categories cannot be renamed.');
    end if;
    update public.categories c set
      name = coalesce(nullif(btrim(coalesce(p_data ->> 'name','')),''), c.name),
      description = case when p_data ? 'description' then nullif(btrim(coalesce(p_data ->> 'description','')),'') else c.description end,
      color = coalesce(p_data ->> 'color', c.color),
      sort_order = coalesce((p_data ->> 'sort_order')::smallint, c.sort_order)
    where c.id = p_category_id returning * into v_row;
    perform private.write_audit(p_business_id, 'category.updated', 'settings', 'category', v_row.id,
      format('Updated category "%s"', v_row.name), p_data);
  end if;
  return v_row;
end $$;

create or replace function public.set_category_status(p_category_id uuid, p_status public.record_status)
returns public.categories language plpgsql security definer set search_path = '' as $$
declare v_row public.categories;
begin
  select * into v_row from public.categories c where c.id = p_category_id;
  if not found then perform private.raise_error('NOT_FOUND', 'That category no longer exists.'); end if;
  perform private.assert_permission(v_row.business_id, 'settings.manage');
  if v_row.is_system and p_status = 'inactive' then
    perform private.raise_error('SYSTEM_CATEGORY', 'System categories cannot be deactivated.');
  end if;
  update public.categories set status = p_status where id = p_category_id returning * into v_row;
  perform private.write_audit(v_row.business_id, 'category.status_changed', 'settings', 'category', v_row.id,
    format('Category "%s" set to %s', v_row.name, p_status));
  return v_row;
end $$;

create or replace function public.save_payment_method(p_business_id uuid, p_data jsonb, p_method_id uuid default null)
returns public.payment_methods language plpgsql security definer set search_path = '' as $$
declare v_row public.payment_methods;
begin
  perform private.assert_permission(p_business_id, 'settings.manage');
  if p_method_id is null then
    insert into public.payment_methods (business_id, name, type, account_label, include_in_closing, sort_order, created_by)
    values (p_business_id, btrim(p_data ->> 'name'), (p_data ->> 'type')::public.payment_method_type,
      nullif(btrim(coalesce(p_data ->> 'account_label','')),''),
      coalesce((p_data ->> 'include_in_closing')::boolean, true),
      coalesce((p_data ->> 'sort_order')::smallint, 500), (select auth.uid()))
    returning * into v_row;
    perform private.write_audit(p_business_id, 'payment_method.created', 'settings', 'payment_method', v_row.id,
      format('Added payment method "%s"', v_row.name));
  else
    update public.payment_methods pm set
      name = coalesce(nullif(btrim(coalesce(p_data ->> 'name','')),''), pm.name),
      account_label = case when p_data ? 'account_label' then nullif(btrim(coalesce(p_data ->> 'account_label','')),'') else pm.account_label end,
      include_in_closing = coalesce((p_data ->> 'include_in_closing')::boolean, pm.include_in_closing),
      sort_order = coalesce((p_data ->> 'sort_order')::smallint, pm.sort_order)
    where pm.id = p_method_id and pm.business_id = p_business_id returning * into v_row;
    if not found then perform private.raise_error('NOT_FOUND', 'That payment method no longer exists.'); end if;
    perform private.write_audit(p_business_id, 'payment_method.updated', 'settings', 'payment_method', v_row.id,
      format('Updated payment method "%s"', v_row.name), p_data);
  end if;
  return v_row;
end $$;

create or replace function public.set_payment_method_status(p_method_id uuid, p_status public.record_status)
returns public.payment_methods language plpgsql security definer set search_path = '' as $$
declare v_row public.payment_methods; v_balance numeric; v_branch uuid;
begin
  select * into v_row from public.payment_methods pm where pm.id = p_method_id;
  if not found then perform private.raise_error('NOT_FOUND', 'That payment method no longer exists.'); end if;
  perform private.assert_permission(v_row.business_id, 'settings.manage');
  if p_status = 'inactive' then
    v_branch := private.default_branch_id(v_row.business_id);
    select (m ->> 'balance')::numeric into v_balance
    from jsonb_array_elements(private.current_balances(v_row.business_id, v_branch) -> 'by_method') m
    where (m ->> 'payment_method_id') = p_method_id::text;
    if coalesce(v_balance, 0) <> 0 then
      perform private.raise_error('METHOD_HAS_BALANCE',
        format('Move the %s in %s to another method first.',
          private.fmt_money(v_row.business_id, v_balance), v_row.name),
        jsonb_build_object('balance', v_balance));
    end if;
  end if;
  update public.payment_methods set status = p_status where id = p_method_id returning * into v_row;
  perform private.write_audit(v_row.business_id, 'payment_method.status_changed', 'settings', 'payment_method', v_row.id,
    format('Payment method "%s" set to %s', v_row.name, p_status));
  return v_row;
end $$;

create or replace function public.save_customer(p_business_id uuid, p_data jsonb, p_customer_id uuid default null)
returns public.customers language plpgsql security definer set search_path = '' as $$
declare v_row public.customers;
begin
  perform private.assert_permission(p_business_id, 'customers.manage');
  if p_customer_id is null then
    insert into public.customers (business_id, full_name, phone, email, member_code, notes, created_by)
    values (p_business_id, btrim(p_data ->> 'full_name'),
      nullif(btrim(coalesce(p_data ->> 'phone','')),''), nullif(btrim(coalesce(p_data ->> 'email','')),''),
      nullif(btrim(coalesce(p_data ->> 'member_code','')),''), nullif(btrim(coalesce(p_data ->> 'notes','')),''),
      (select auth.uid()))
    returning * into v_row;
    perform private.write_audit(p_business_id, 'customer.created', 'customers', 'customer', v_row.id,
      format('Added customer %s', v_row.full_name));
  else
    update public.customers c set
      full_name = coalesce(nullif(btrim(coalesce(p_data ->> 'full_name','')),''), c.full_name),
      phone = case when p_data ? 'phone' then nullif(btrim(coalesce(p_data ->> 'phone','')),'') else c.phone end,
      email = case when p_data ? 'email' then nullif(btrim(coalesce(p_data ->> 'email','')),'') else c.email end,
      member_code = case when p_data ? 'member_code' then nullif(btrim(coalesce(p_data ->> 'member_code','')),'') else c.member_code end,
      notes = case when p_data ? 'notes' then nullif(btrim(coalesce(p_data ->> 'notes','')),'') else c.notes end
    where c.id = p_customer_id and c.business_id = p_business_id returning * into v_row;
    if not found then perform private.raise_error('NOT_FOUND', 'That customer no longer exists.'); end if;
    perform private.write_audit(p_business_id, 'customer.updated', 'customers', 'customer', v_row.id,
      format('Updated customer %s', v_row.full_name), p_data);
  end if;
  return v_row;
end $$;

create or replace function public.set_customer_status(p_customer_id uuid, p_status public.record_status)
returns public.customers language plpgsql security definer set search_path = '' as $$
declare v_row public.customers;
begin
  select * into v_row from public.customers c where c.id = p_customer_id;
  if not found then perform private.raise_error('NOT_FOUND', 'That customer no longer exists.'); end if;
  perform private.assert_permission(v_row.business_id, 'customers.manage');
  update public.customers set status = p_status where id = p_customer_id returning * into v_row;
  perform private.write_audit(v_row.business_id, 'customer.deactivated', 'customers', 'customer', v_row.id,
    format('Customer %s set to %s', v_row.full_name, p_status));
  return v_row;
end $$;

create or replace function public.update_member(
  p_member_id uuid, p_role public.member_role default null, p_title text default null,
  p_permission_keys text[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_m public.business_members; v_name text; v_key text;
begin
  select * into v_m from public.business_members m where m.id = p_member_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That user no longer exists.'); end if;
  perform private.assert_permission(v_m.business_id, 'users.manage');
  if v_m.user_id = (select auth.uid()) then
    perform private.raise_error('SELF_CHANGE_NOT_ALLOWED', 'You cannot change your own access.');
  end if;
  select p.full_name into v_name from public.profiles p where p.id = v_m.user_id;

  update public.business_members m
  set role = coalesce(p_role, m.role),
      title = case when p_title is null then m.title else nullif(btrim(p_title), '') end
  where m.id = p_member_id;

  if p_permission_keys is not null then
    delete from public.member_permissions mp where mp.member_id = p_member_id;
    if coalesce(p_role, v_m.role) = 'staff' then
      foreach v_key in array p_permission_keys loop
        insert into public.member_permissions (member_id, permission_key, granted_by)
        values (p_member_id, v_key, (select auth.uid()))
        on conflict do nothing;
      end loop;
    end if;
  end if;

  perform private.write_audit(v_m.business_id, 'member.access_updated', 'users', 'member', p_member_id,
    format('Updated access for %s', coalesce(v_name, 'user')),
    jsonb_build_object('role', jsonb_build_object('from', v_m.role, 'to', coalesce(p_role, v_m.role))),
    jsonb_build_object('permissions', to_jsonb(p_permission_keys)));
  return jsonb_build_object('member_id', p_member_id, 'role', coalesce(p_role, v_m.role));
end $$;

create or replace function public.update_my_profile(p_patch jsonb)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare v_row public.profiles;
begin
  if (select auth.uid()) is null then
    perform private.raise_error('PERMISSION_DENIED', 'You must be signed in.');
  end if;
  update public.profiles p set
    full_name = coalesce(nullif(btrim(coalesce(p_patch ->> 'full_name','')),''), p.full_name),
    phone = case when p_patch ? 'phone' then nullif(btrim(coalesce(p_patch ->> 'phone','')),'') else p.phone end,
    preferred_language = coalesce(p_patch ->> 'preferred_language', p.preferred_language),
    theme_preference = coalesce(p_patch ->> 'theme_preference', p.theme_preference)
  where p.id = (select auth.uid()) returning * into v_row;
  return v_row;
end $$;

grant execute on function public.update_business_profile(uuid, jsonb) to authenticated;
grant execute on function public.update_business_settings(uuid, jsonb) to authenticated;
grant execute on function public.save_category(uuid, jsonb, uuid) to authenticated;
grant execute on function public.set_category_status(uuid, public.record_status) to authenticated;
grant execute on function public.save_payment_method(uuid, jsonb, uuid) to authenticated;
grant execute on function public.set_payment_method_status(uuid, public.record_status) to authenticated;
grant execute on function public.save_customer(uuid, jsonb, uuid) to authenticated;
grant execute on function public.set_customer_status(uuid, public.record_status) to authenticated;
grant execute on function public.update_member(uuid, public.member_role, text, text[]) to authenticated;
grant execute on function public.update_my_profile(jsonb) to authenticated;
revoke all on function public.update_business_profile(uuid, jsonb) from anon;
revoke all on function public.update_business_settings(uuid, jsonb) from anon;
revoke all on function public.save_category(uuid, jsonb, uuid) from anon;
revoke all on function public.set_category_status(uuid, public.record_status) from anon;
revoke all on function public.save_payment_method(uuid, jsonb, uuid) from anon;
revoke all on function public.set_payment_method_status(uuid, public.record_status) from anon;
revoke all on function public.save_customer(uuid, jsonb, uuid) from anon;
revoke all on function public.set_customer_status(uuid, public.record_status) from anon;
revoke all on function public.update_member(uuid, public.member_role, text, text[]) from anon;
revoke all on function public.update_my_profile(jsonb) from anon;

-- brand assets bucket (logos are public to print on invoices, writes are restricted)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "brand assets readable" on storage.objects for select to public
  using (bucket_id = 'brand-assets');
create policy "brand assets writable by settings managers" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets'
    and (storage.foldername(name))[1]::uuid in (select private.businesses_with_permission('settings.manage')));
create policy "brand assets updatable by settings managers" on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets'
    and (storage.foldername(name))[1]::uuid in (select private.businesses_with_permission('settings.manage')));
create policy "brand assets deletable by settings managers" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets'
    and (storage.foldername(name))[1]::uuid in (select private.businesses_with_permission('settings.manage')));

-- realtime: the app only listens for change signals, never trusts payloads
alter publication supabase_realtime add table public.financial_transactions;
alter publication supabase_realtime add table public.daily_closings;
