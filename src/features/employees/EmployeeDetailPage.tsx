import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, BadgeDollarSign, CalendarCheck, Clock, SquarePen, TrendingUp, UserX, Wallet } from 'lucide-react'
import { changeEmployeeSalary, getEmployee, getSalaryOverview, listSalaryPayments, setEmployeeStatus, updateEmployee } from '@/lib/api'
import { invalidateMoney, queryClient, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Avatar, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge } from '@/components/ui/primitives'
import { DataTable } from '@/components/ui/table'
import { Modal, ConfirmDialog } from '@/components/ui/overlay'
import { Select, Field, Input, MoneyInput, Textarea, moneyError, moneyToParam, minorToInput } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate, formatMonth, monthStart, shiftMonth } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'

export default function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>()
  const business = useBusiness()
  const { currency, can } = useSession()
  const [editOpen, setEditOpen] = useState(false)
  const [salaryOpen, setSalaryOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const employee = useQuery({
    queryKey: queryKeys.employee(employeeId ?? ''),
    queryFn: () => getEmployee(employeeId!),
    enabled: Boolean(employeeId),
  })
  const payments = useQuery({
    queryKey: queryKeys.salaryPayments(business.business_id, { employeeId }),
    queryFn: () => listSalaryPayments(business.business_id, { employeeId, pageSize: 50 }),
    enabled: Boolean(employeeId) && can('salaries.view'),
  })
  const overview = useQuery({
    queryKey: queryKeys.salaryOverview(business.business_id, monthStart(business.business_date)),
    queryFn: () => getSalaryOverview(business.business_id, monthStart(business.business_date)),
    enabled: can('salaries.view'),
  })

  if (employee.isLoading) return <Skeleton className="h-64" />
  if (employee.isError || !employee.data) return <ErrorState message="Could not load this employee" onRetry={() => void employee.refetch()} />

  const row = employee.data
  const thisMonth = overview.data?.employees.find((item) => item.employee_id === row.id)
  const paidRows = payments.data?.rows ?? []
  const paidThisYear = paidRows
    .filter((payment) => payment.status === 'posted' && payment.period_month.slice(0, 4) === business.business_date.slice(0, 4))
    .reduce((total, payment) => total + money(payment.amount, currency.decimals), 0)
  const lastPayment = paidRows.find((payment) => payment.status === 'posted')

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {row.full_name} <StatusBadge status={row.status} />
          </span>
        }
        subtitle={`${row.position} · started ${formatBusinessDate(row.start_date)}${row.phone ? ` · ${row.phone}` : ''}`}
        actions={
          <>
            <Link to="/employees"><Button icon={<ArrowLeft className="size-4" />}>Employees</Button></Link>
            {can('employees.manage') ? <Button icon={<SquarePen className="size-4" />} onClick={() => setEditOpen(true)}>Edit</Button> : null}
            {can('employees.manage') && can('salaries.view') ? (
              <Button icon={<TrendingUp className="size-4" />} onClick={() => setSalaryOpen(true)}>Change salary</Button>
            ) : null}
            {can('salaries.pay') ? (
              <Link to="/salaries"><Button variant="primary" icon={<BadgeDollarSign className="size-4" />}>Pay salary</Button></Link>
            ) : null}
            {can('employees.manage') && row.status === 'active' ? (
              <Button variant="ghost" icon={<UserX className="size-4" />} onClick={() => setDeactivateOpen(true)}>Deactivate</Button>
            ) : null}
          </>
        }
      />

      <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar name={row.full_name} size="xl" />
        <div className="min-w-0">
          <p className="text-lg font-bold text-ink-900">{row.full_name}</p>
          <p className="text-sm text-ink-500">{row.notes ?? 'No notes for this employee.'}</p>
        </div>
      </div>

      {can('salaries.view') ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Current salary" value={formatMoney(money(row.current_monthly_salary, currency.decimals), currency)} icon={<Wallet className="size-5" />} tone="brand" caption="Per month" />
          <StatCard label={`Paid in ${business.business_date.slice(0, 4)}`} value={formatMoney(paidThisYear, currency)} icon={<CalendarCheck className="size-5" />} tone="income" caption={`${paidRows.filter((p) => p.status === 'posted').length} payments recorded`} />
          <StatCard
            label="Last payment"
            value={lastPayment ? formatMoney(money(lastPayment.amount, currency.decimals), currency) : '—'}
            icon={<BadgeDollarSign className="size-5" />}
            tone="neutral"
            caption={lastPayment ? `${formatBusinessDate(lastPayment.business_date)} · ${lastPayment.payment_method_name}` : 'Nothing paid yet'}
          />
          <StatCard
            label={formatMonth(monthStart(business.business_date))}
            value={thisMonth ? formatMoney(money(thisMonth.remaining, currency.decimals), currency) : '—'}
            icon={<Clock className="size-5" />}
            tone={thisMonth && thisMonth.remaining > 0 ? 'pending' : 'income'}
            caption={thisMonth ? (thisMonth.remaining > 0 ? 'Still to pay this month' : 'Fully paid this month') : ''}
          />
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader title="Salary payments" description="Every payment recorded for this employee" />
        <div className="mt-3">
          {!can('salaries.view') ? (
            <EmptyState title="Salary details are not shown for your account" description="Ask the owner if you need salary access." />
          ) : (
            <DataTable
              rows={paidRows}
              keyOf={(payment) => payment.id}
              loading={payments.isLoading}
              caption="Salary payments"
              columns={[
                { key: 'period', header: 'Period', priority: 1, mobile: 'title', cell: (payment) => <span className="font-semibold text-ink-900">{formatMonth(payment.period_month)}</span> },
                { key: 'type', header: 'Type', priority: 2, mobile: 'meta', cell: (payment) => <StatusBadge status={payment.payment_type} /> },
                { key: 'date', header: 'Paid on', priority: 1, mobile: 'meta', cell: (payment) => formatBusinessDate(payment.business_date) },
                { key: 'method', header: 'Method', priority: 3, mobile: 'hide', cell: (payment) => payment.payment_method_name },
                { key: 'ref', header: 'Reference', priority: 3, mobile: 'hide', cell: (payment) => <span className="num text-xs font-semibold text-ink-600">{payment.reference_label}</span> },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  priority: 1,
                  mobile: 'value',
                  cell: (payment) => (
                    <span className={`num font-semibold ${payment.status === 'voided' ? 'text-ink-400 line-through' : 'text-ink-900'}`}>
                      {formatMoney(money(payment.amount, currency.decimals), currency)}
                    </span>
                  ),
                },
                { key: 'status', header: 'Status', priority: 2, mobile: 'meta', cell: (payment) => <StatusBadge status={payment.status} /> },
              ]}
              empty={<EmptyState icon={<BadgeDollarSign className="size-6" />} title="No salary payments yet" description="Payments appear here once this employee is paid." />}
            />
          )}
        </div>
      </Card>

      <EditEmployeeModal employee={row} open={editOpen} onOpenChange={setEditOpen} />
      <ChangeSalaryModal employee={row} open={salaryOpen} onOpenChange={setSalaryOpen} />
      <DeactivateModal employee={row} open={deactivateOpen} onOpenChange={setDeactivateOpen} pending={thisMonth?.remaining ?? 0} />
    </>
  )
}

function EditEmployeeModal({ employee, open, onOpenChange }: { employee: { id: string; full_name: string; position: string; phone: string | null; notes: string | null }; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [fullName, setFullName] = useState(employee.full_name)
  const positionList = useBusiness().settings.employee_positions ?? []
  const positions = positionList.includes(employee.position) ? positionList : [employee.position, ...positionList]
  const [position, setPosition] = useState(employee.position)
  const [phone, setPhone] = useState(employee.phone ?? '')
  const [notes, setNotes] = useState(employee.notes ?? '')

  const mutation = useMutation({
    mutationFn: () => updateEmployee(employee.id, { full_name: fullName.trim(), position: position.trim(), phone: phone.trim(), notes: notes.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employee'] })
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee updated')
      onOpenChange(false)
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit employee"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>Save changes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Full name"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>
        <Field label="Position" hint="Edit this list in Settings → Financial preferences">
          <Select value={position} onChange={(event) => setPosition(event.target.value)}>
            {positions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Phone" optional><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Field label="Notes" optional><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function ChangeSalaryModal({ employee, open, onOpenChange }: { employee: { id: string; full_name: string; current_monthly_salary: string | number }; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currency, businessDate } = useSession()
  const [salary, setSalary] = useState(() => minorToInput(money(employee.current_monthly_salary, currency.decimals), currency))
  const [month, setMonth] = useState(() => shiftMonth(monthStart(businessDate), 1))
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => changeEmployeeSalary(employee.id, moneyToParam(salary, currency), month, reason.trim() || undefined),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['employee'] })
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      void queryClient.invalidateQueries({ queryKey: ['salary-overview'] })
      toast.success('Salary updated', {
        description: `${formatMoney(money(result.previous, currency.decimals), currency)} → ${formatMoney(money(result.monthly_salary, currency.decimals), currency)} from ${formatMonth(month)}`,
      })
      onOpenChange(false)
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Change salary"
      description={`${employee.full_name} · months already paid keep their old amount`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (moneyError(salary, currency, { allowZero: true })) {
                toast.info('Enter a valid monthly salary')
                return
              }
              mutation.mutate()
            }}
          >
            Save salary
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="New monthly salary" error={salary ? moneyError(salary, currency, { allowZero: true }) : undefined}>
          <MoneyInput currency={currency} value={salary} onChange={setSalary} />
        </Field>
        <Field label="Effective from" hint="The new amount applies from the first day of this month">
          <Input type="month" value={month.slice(0, 7)} onChange={(event) => setMonth(`${event.target.value}-01`)} />
        </Field>
        <Field label="Reason" optional><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Promoted to head trainer" /></Field>
      </div>
    </Modal>
  )
}

function DeactivateModal({ employee, open, onOpenChange, pending }: {
  employee: { id: string; full_name: string }
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: number
}) {
  const { currency, businessDate } = useSession()
  const [endDate, setEndDate] = useState(businessDate)
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => setEmployeeStatus(employee.id, 'inactive', endDate, reason.trim() || undefined),
    onSuccess: () => {
      invalidateMoney()
      toast.success(`${employee.full_name} deactivated`, { description: 'Their past salary payments stay in the records.' })
      onOpenChange(false)
    },
    onError: (error) => toast.error(error),
  })

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive
      title={`Deactivate ${employee.full_name}?`}
      description="They stop appearing in salary lists from the month after their last working day."
      confirmLabel="Deactivate employee"
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      consequences={[
        'All past salary payments stay in the records.',
        pending > 0 ? `${formatMoney(money(pending, currency.decimals), currency)} is still unpaid for this month.` : 'Nothing is unpaid for this month.',
        'You can reactivate them later.',
      ]}
    >
      <div className="flex flex-col gap-4">
        <Field label="Last working day"><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
        <Field label="Reason" optional><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      </div>
    </ConfirmDialog>
  )
}
