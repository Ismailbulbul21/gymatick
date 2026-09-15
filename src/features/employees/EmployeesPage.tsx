import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Users, UserPlus } from 'lucide-react'
import { createEmployee, listEmployees } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Avatar, Button, Callout, Card, EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/table'
import { FilterBar, FilterSelect, SearchInput } from '@/components/ui/filters'
import { Drawer } from '@/components/ui/overlay'
import { Select, Field, Input, MoneyInput, Textarea, moneyError, moneyToParam } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate, monthStart } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { queryClient } from '@/lib/query-client'
import type { EmployeeRow } from '@/types/db'
import { tr } from '@/i18n'

export default function EmployeesPage() {
  const business = useBusiness()
  const { currency, can } = useSession()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const list = useQuery({
    queryKey: queryKeys.employeeList(business.business_id, { status, search }),
    queryFn: () => listEmployees(business.business_id, { status, search }),
    placeholderData: (previous) => previous,
  })

  const canSeeSalary = can('salaries.view')

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'name',
      header: tr("Employee"),
      priority: 1,
      mobile: 'title',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{row.full_name}</p>
            <p className="num truncate text-xs text-ink-500">{row.phone ?? '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'position', header: tr("Position"), priority: 1, mobile: 'meta', cell: (row) => row.position },
    ...(canSeeSalary
      ? [{
          key: 'salary',
          header: tr("Monthly salary"),
          align: 'right' as const,
          priority: 1 as const,
          mobile: 'value' as const,
          cell: (row: EmployeeRow) => (
            <span className="num font-semibold text-ink-900">{formatMoney(money(row.current_monthly_salary, currency.decimals), currency)}</span>
          ),
        }]
      : []),
    { key: 'start', header: tr("Started"), priority: 3, mobile: 'hide', cell: (row) => formatBusinessDate(row.start_date) },
    {
      key: 'status',
      header: tr("Status"),
      priority: 2,
      mobile: 'meta',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} />
          {row.end_date ? <span className="text-xs text-ink-500">{tr("Ended")}{' '}{formatBusinessDate(row.end_date)}</span> : null}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={tr("Employees")}
        subtitle={tr("Shaqaalaha · Trainers and staff who work at the gym")}
        actions={
          can('employees.manage') && canSeeSalary ? (
            <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAddOpen(true)}>{tr("Add employee")}</Button>
          ) : null
        }
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder={tr("Search name or position…")} />
        <FilterSelect
          label={tr("Status")}
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          options={[
            { value: 'active', label: tr("Active") },
            { value: 'inactive', label: tr("Inactive") },
            { value: 'all', label: tr("All") },
          ]}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message={tr("Could not load employees")} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={list.data?.rows ?? []}
            keyOf={(row) => row.id}
            loading={list.isLoading && !list.data}
            onRowClick={(row) => navigate(`/employees/${row.id}`)}
            rowClassName={(row) => (row.status === 'inactive' ? 'opacity-60' : undefined)}
            caption={tr("Employees")}
            empty={
              <EmptyState
                icon={<Users className="size-6" />}
                title={tr("No employees yet")}
                description={tr("Add your trainers and staff to track their monthly salaries.")}
                actions={
                  can('employees.manage') && canSeeSalary ? (
                    <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAddOpen(true)}>{tr("Add employee")}</Button>
                  ) : undefined
                }
              />
            }
          />
        )}
      </Card>

      <Callout tone="info">
        {tr("Employees with salary history are never deleted. Deactivate them instead — their payments stay in the records.")}
      </Callout>

      <AddEmployeeDrawer open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}

function AddEmployeeDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const business = useBusiness()
  const { currency, businessDate } = useSession()
  const [fullName, setFullName] = useState('')
  const positions = business.settings.employee_positions ?? []
  const [position, setPosition] = useState(positions[0] ?? '')
  const [phone, setPhone] = useState('')
  const [salary, setSalary] = useState('')
  const [startDate, setStartDate] = useState(monthStart(businessDate))
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createEmployee({
        businessId: business.business_id,
        fullName: fullName.trim(),
        position: position.trim(),
        startDate,
        monthlySalary: moneyToParam(salary, currency),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: (employee) => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      void queryClient.invalidateQueries({ queryKey: ['salary-overview'] })
      toast.success(tr("{0} added", { 0: employee.full_name }), { description: tr("Their monthly salary is now tracked.") })
      setFullName('')
      setPosition(positions[0] ?? '')
      setPhone('')
      setSalary('')
      setNotes('')
      onOpenChange(false)
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={tr("Add employee")}
      description={tr("Shaqaale cusub · someone who works at the gym")}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{tr("Cancel")}</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!fullName.trim() || !position.trim() || moneyError(salary, currency, { allowZero: true })) {
                toast.info(tr("Check the details"), tr("Name, position and monthly salary are required."))
                return
              }
              mutation.mutate()
            }}
          >
            {tr("Add employee")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={tr("Full name")}><Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus /></Field>
        <Field label={tr("Position")} hint={tr("Edit this list in Settings → Financial preferences")}>
          <Select value={position} onChange={(event) => setPosition(event.target.value)}>
            {positions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Select>
        </Field>
        <Field label={tr("Phone")} optional><Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></Field>
        <Field label={tr("Monthly salary")} error={salary ? moneyError(salary, currency, { allowZero: true }) : undefined}>
          <MoneyInput currency={currency} value={salary} onChange={setSalary} />
        </Field>
        <Field label={tr("Start date")} hint={tr("Salary tracking starts from this month")}>
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label={tr("Notes")} optional><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      </div>
    </Drawer>
  )
}
