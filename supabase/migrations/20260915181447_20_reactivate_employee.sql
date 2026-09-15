-- Reactivate an employee without charging salary for the months they were away.
-- The months between the last working day and the return get a salary rate of 0, and the salary they
-- had before leaving applies again from the month they come back (rate history is kept).
create or replace function public.reactivate_employee(p_employee_id uuid, p_return_date date, p_reason text default null)
returns public.employees
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp public.employees;
  v_new public.employees;
  v_return_month date;
  v_gap_month date;
  v_salary numeric;
begin
  select * into v_emp from public.employees e where e.id = p_employee_id for update;
  if not found then perform private.raise_error('NOT_FOUND', 'That employee no longer exists.'); end if;
  perform private.assert_permission(v_emp.business_id, 'employees.manage');
  if v_emp.status = 'active' then
    perform private.raise_error('INVALID_INPUT', 'This employee is already active.');
  end if;
  if p_return_date is null then
    perform private.raise_error('INVALID_INPUT', 'Choose the day they come back to work.');
  end if;
  if v_emp.end_date is not null and p_return_date <= v_emp.end_date then
    perform private.raise_error('INVALID_INPUT', 'The return day must be after their last working day.');
  end if;

  v_return_month := date_trunc('month', p_return_date)::date;
  v_salary := private.salary_obligation(p_employee_id,
    coalesce(date_trunc('month', v_emp.end_date)::date, v_return_month));

  if v_emp.end_date is not null then
    v_gap_month := (date_trunc('month', v_emp.end_date) + interval '1 month')::date;
    if v_gap_month < v_return_month then
      insert into public.employee_salary_rates (business_id, employee_id, monthly_salary, effective_month, reason, created_by)
      values (v_emp.business_id, p_employee_id, 0, v_gap_month, 'Away from work', (select auth.uid()))
      on conflict (employee_id, effective_month)
      do update set monthly_salary = 0, reason = excluded.reason, created_by = excluded.created_by;
    end if;
  end if;

  insert into public.employee_salary_rates (business_id, employee_id, monthly_salary, effective_month, reason, created_by)
  values (v_emp.business_id, p_employee_id, v_salary, v_return_month, 'Back at work', (select auth.uid()))
  on conflict (employee_id, effective_month)
  do update set monthly_salary = excluded.monthly_salary, reason = excluded.reason, created_by = excluded.created_by;

  update public.employees e
  set status = 'active', end_date = null, updated_by = (select auth.uid())
  where e.id = p_employee_id
  returning * into v_new;

  perform private.write_audit(v_emp.business_id, 'employee.reactivated', 'employees', 'employee', p_employee_id,
    format('%s reactivated from %s', v_emp.full_name, to_char(p_return_date, 'DD Mon YYYY')),
    null, jsonb_build_object('return_date', p_return_date, 'previous_end_date', v_emp.end_date,
                             'monthly_salary', v_salary, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
  return v_new;
end $$;

revoke all on function public.reactivate_employee(uuid, date, text) from public, anon;
grant execute on function public.reactivate_employee(uuid, date, text) to authenticated;
