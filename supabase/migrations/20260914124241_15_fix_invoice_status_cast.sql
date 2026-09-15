create or replace function private.sync_invoice_payments()
returns trigger language plpgsql set search_path = '' as $$
declare v_ids uuid[]; v_id uuid; v_paid numeric;
begin
  v_ids := array_remove(array[
    case when tg_op <> 'INSERT' then old.invoice_id end,
    case when tg_op <> 'DELETE' then new.invoice_id end], null);
  foreach v_id in array v_ids loop
    select coalesce(sum(case when t.kind = 'income' then t.amount else -t.amount end), 0)
    into v_paid
    from public.financial_transactions t
    where t.invoice_id = v_id and t.status = 'posted';
    update public.invoices i
    set amount_paid = greatest(v_paid, 0),
        status = (case
          when i.status = 'cancelled' then 'cancelled'
          when v_paid >= i.total then 'paid'
          when v_paid > 0 then 'partially_paid'
          else 'pending' end)::public.invoice_status
    where i.id = v_id;
  end loop;
  return null;
end $$;
