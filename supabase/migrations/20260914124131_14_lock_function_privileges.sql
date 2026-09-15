-- GYMATICK 14: no function in the API schema may be called without signing in
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- RLS helpers are called from inside policies, so signed-in users need EXECUTE on them
grant execute on function private.my_business_ids() to authenticated;
grant execute on function private.businesses_with_permission(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;
grant execute on function private.colleague_ids() to authenticated;
grant execute on function private.business_date_for(uuid, timestamptz) to authenticated;
grant execute on function private.current_business_date(uuid) to authenticated;
grant execute on function private.is_period_closed(uuid, uuid, date) to authenticated;
grant execute on function private.last_checkpoint(uuid, uuid) to authenticated;

-- future functions are private by default
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon;

-- document_sequences is internal: no role may touch it directly
comment on table public.document_sequences is
  'Internal numbering. No client access: RLS is enabled with no policies on purpose.';
