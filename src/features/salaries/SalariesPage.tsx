import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, BadgeDollarSign, Briefcase, CalendarClock, ChevronLeft, ChevronRight, CircleCheck, Clock,
} from 'lucide-react'
import { getSalaryOverview, listPaymentMethods, listSalaryPayments, paySalary } from '@/lib/api'
import { invalidateMoney, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import {
  Avatar, Button, Callout, Card, EmptyState, ErrorState, PageHeader, Progress, Segmented, Skeleton, StatCard, StatusBadge,
} from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/table'
import { Modal } from '@/components/ui/overlay'
import { Field, Input, MoneyInput, Select, Textarea, moneyError, moneyToParam, minorToInput } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate, formatMonth, monthStart, shiftMonth } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { newIdempotencyKey } from '@/lib/utils'
import type { SalaryOverviewEmployee } from '@/types/db'
import { tr } from '@/i18n'

export default function SalariesPage() {
  const business = useBusiness()
  const { currency, can } = useSession()
  const [period, setPeriod] = useState(() => monthStart(business.business_date))
  const [tab, setTab] = useState<'overview' | 'history'>('overview')
  const [payFor, setPayFor] = useState<SalaryOverviewEmployee | null>(null)

  const overview = useQuery({
    queryKey: queryKeys.salaryOverview(business.business_id, period),
    queryFn: () => getSalaryOverview(business.business_id, period),
  })

  const history = useQuery({
    queryKey: queryKeys.salaryPayments(business.business_id, { period, tab }),
    queryFn: () => listSalaryPayments(business.business_id, { pageSize: 50 }),
    enabled: tab === 'history',
  })

  const totals = overview.data?.totals
  const employees = overview.data?.employees ?? []
  const arrears = money(overview.data?.arrears.total ?? 0, currency.decimals)

  const columns: Column<SalaryOverviewEmployee>[] = [
    {
      key: 'employee',
      header: tr("Employee"),
      priority: 1,
      mobile: 'title',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{row.full_name}</p>
            <p className="truncate text-xs text-ink-500">{row.position}</p>
          </div>
        </div>
      ),
    },
    { key: 'salary', header: tr("Monthly salary"), align: 'right', priority: 2, mobile: 'meta', cell: (row) => <span className="num font-semibold text-ink-900">{formatMoney(money(row.monthly_salary, currency.decimals), currency)}</span> },
    { key: 'paid', header: tr("Paid"), align: 'right', priority: 2, mobile: 'meta', cell: (row) => <span className="num text-ink-600">{formatMoney(money(row.paid, currency.decimals), currency)}</span> },
    {
      key: 'remaining',
      header: tr("Remaining"),
      align: 'right',
      priority: 1,
      mobile: 'value',
      cell: (row) => {
        const remaining = money(row.remaining, currency.decimals)
        return <span className={`num font-bold ${remaining === 0 ? 'text-income-700' : 'text-ink-900'}`}>{formatMoney(remaining, currency)}</span>
      },
    },
    {
      key: 'progress',
      header: tr("Progress"),
      priority: 3,
      mobile: 'hide',
      width: '150px',
      cell: (row) => {
        const salary = money(row.monthly_salary, currency.decimals)
        const paid = money(row.paid, currency.decimals)
        const percent = salary > 0 ? Math.min((paid / salary) * 100, 100) : 0
        return (
          <div className="flex flex-col gap-1">
            <Progress value={percent} tone={percent >= 100 ? 'income' : 'brand'} />
            <span className="num text-xs text-ink-500">{Math.round(percent)}{tr("% paid")}</span>
          </div>
        )
      },
    },
    { key: 'state', header: tr("Status"), priority: 1, mobile: 'meta', cell: (row) => <StatusBadge status={row.state} /> },
    {
      key: 'last',
      header: tr("Last payment"),
      priority: 3,
      mobile: 'hide',
      cell: (row) =>
        row.last_payment_at ? (
          <span className="whitespace-nowrap text-ink-600">
            {formatBusinessDate(row.last_payment_at, 'd MMM')} · {row.last_payment_method}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      priority: 1,
      mobile: 'hide',
      cell: (row) =>
        can('salaries.pay') ? (
          row.state === 'paid' ? (
            <Button size="sm" disabled title={tr("Fully paid for {0} — record an adjustment to pay more", { 0: formatMonth(period) })}>
              {tr("Paid")}
            </Button>
          ) : (
            <Button size="sm" icon={<BadgeDollarSign className="size-4" />} onClick={() => setPayFor(row)}>
              {tr("Pay")}
            </Button>
          )
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title={tr("Salaries")}
        subtitle={tr("Mushahar · Monthly salary obligations and payments")}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-0.5">
              <Button variant="ghost" size="icon" aria-label={tr("Previous month")} onClick={() => setPeriod(shiftMonth(period, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 text-sm font-semibold text-ink-900">{formatMonth(period)}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tr("Next month")}
                disabled={period >= monthStart(business.business_date)}
                onClick={() => setPeriod(shiftMonth(period, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {can('salaries.pay') ? (
              <Button variant="primary" icon={<BadgeDollarSign className="size-4" />} onClick={() => setPayFor(employees.find((e) => e.remaining > 0) ?? employees[0] ?? null)}>
                {tr("Pay salary")}
              </Button>
            ) : null}
          </>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: tr("Overview") },
          { value: 'history', label: tr("Payment history") },
        ]}
      />

      {tab === 'overview' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overview.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[126px]" />)
            ) : (
              <>
                <StatCard
                  label={tr("Monthly obligations")}
                  value={formatMoney(money(totals?.obligations ?? 0, currency.decimals), currency)}
                  icon={<Briefcase className="size-5" />}
                  tone="brand"
                  caption={tr("{0} employees in {1}", { 0: totals?.employee_count ?? 0, 1: formatMonth(period) })}
                />
                <StatCard
                  label={tr("Paid so far")}
                  value={<span className="text-income-700">{formatMoney(money(totals?.paid ?? 0, currency.decimals), currency)}</span>}
                  icon={<CircleCheck className="size-5" />}
                  tone="income"
                  caption={
                    totals && totals.obligations > 0
                      ? tr("{0}% of this month", { 0: Math.round((totals.paid / totals.obligations) * 100) })
                      : tr("Nothing due yet")
                  }
                  footer={
                    totals && totals.obligations > 0 ? (
                      <Progress value={(totals.paid / totals.obligations) * 100} tone="income" />
                    ) : undefined
                  }
                />
                <StatCard
                  label={tr("Pending")}
                  value={formatMoney(money(totals?.pending ?? 0, currency.decimals), currency)}
                  icon={<Clock className="size-5" />}
                  tone="pending"
                  caption={tr("{0} employees not fully paid", { 0: totals?.unpaid_count ?? 0 })}
                />
                <StatCard
                  label={tr("Arrears")}
                  value={<span className={arrears > 0 ? 'text-pending-700' : ''}>{formatMoney(arrears, currency)}</span>}
                  icon={<CalendarClock className="size-5" />}
                  tone="neutral"
                  caption={arrears > 0 ? tr("Unpaid from earlier months") : tr("Earlier months are fully paid")}
                />
              </>
            )}
          </div>

          <Card className="overflow-hidden">
            {overview.isError ? (
              <ErrorState message={tr("Could not load salaries")} onRetry={() => void overview.refetch()} />
            ) : (
              <DataTable
                columns={columns}
                rows={employees}
                keyOf={(row) => row.employee_id}
                loading={overview.isLoading}
                caption={tr("Salaries for {0}", { 0: formatMonth(period) })}
                empty={
                  <EmptyState
                    icon={<Briefcase className="size-6" />}
                    title={tr("No employees for this month")}
                    description={tr("Add your trainers and staff to track their monthly salaries.")}
                    actions={<Link to="/employees"><Button variant="primary">{tr("Go to employees")}</Button></Link>}
                  />
                }
              />
            )}
          </Card>
        </>
      ) : (
        <Card className="overflow-hidden">
          {history.isLoading ? (
            <div className="flex flex-col gap-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <DataTable
              rows={history.data?.rows ?? []}
              keyOf={(row) => row.id}
              caption={tr("Salary payment history")}
              columns={[
                { key: 'date', header: tr("Paid on"), priority: 1, mobile: 'meta', cell: (row) => <span className="whitespace-nowrap">{formatBusinessDate(row.business_date)}</span> },
                {
                  key: 'employee',
                  header: tr("Employee"),
                  priority: 1,
                  mobile: 'title',
                  cell: (row) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.employee_name} size="sm" />
                      <span className="font-semibold text-ink-900">{row.employee_name}</span>
                    </div>
                  ),
                },
                { key: 'period', header: tr("Period"), priority: 2, mobile: 'meta', cell: (row) => formatMonth(row.period_month) },
                { key: 'type', header: tr("Type"), priority: 3, mobile: 'hide', cell: (row) => <StatusBadge status={row.payment_type} /> },
                { key: 'method', header: tr("Method"), priority: 3, mobile: 'hide', cell: (row) => row.payment_method_name },
                { key: 'ref', header: tr("Reference"), priority: 3, mobile: 'hide', cell: (row) => <span className="num text-xs font-semibold text-ink-600">{row.reference_label}</span> },
                {
                  key: 'amount',
                  header: tr("Amount"),
                  align: 'right',
                  priority: 1,
                  mobile: 'value',
                  cell: (row) => (
                    <span className={`num font-semibold ${row.status === 'voided' ? 'text-ink-400 line-through' : 'text-ink-900'}`}>
                      {formatMoney(money(row.amount, currency.decimals), currency)}
                    </span>
                  ),
                },
                { key: 'status', header: tr("Status"), priority: 2, mobile: 'meta', cell: (row) => <StatusBadge status={row.status} /> },
              ]}
              empty={<EmptyState icon={<BadgeDollarSign className="size-6" />} title={tr("No salary payments yet")} description={tr("Salary payments appear here once you pay someone.")} />}
            />
          )}
        </Card>
      )}

      <PaySalaryDialog employee={payFor} period={period} onClose={() => setPayFor(null)} employees={employees} />
    </>
  )
}

function PaySalaryDialog({ employee, employees, period, onClose }: {
  employee: SalaryOverviewEmployee | null
  employees: SalaryOverviewEmployee[]
  period: string
  onClose: () => void
}) {
  const business = useBusiness()
  const { currency, businessDate } = useSession()
  const [step, setStep] = useState<'details' | 'review'>('details')
  const [employeeId, setEmployeeId] = useState(employee?.employee_id ?? '')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [type, setType] = useState<'salary' | 'advance' | 'adjustment'>('salary')
  const [date, setDate] = useState(businessDate)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(newIdempotencyKey)

  const selected = useMemo(
    () => employees.find((item) => item.employee_id === (employeeId || employee?.employee_id)) ?? employee ?? null,
    [employees, employeeId, employee],
  )
  const remaining = money(selected?.remaining ?? 0, currency.decimals)

  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
    enabled: Boolean(employee),
  })

  const mutation = useMutation({
    mutationFn: () =>
      paySalary({
        employeeId: employeeId || employee!.employee_id,
        periodMonth: period,
        amount: moneyToParam(amount, currency),
        paymentMethodId: methodId,
        idempotencyKey: key,
        paymentType: type,
        businessDate: date,
        notes: notes.trim() || null,
        reason: reason.trim() || null,
      }),
    onSuccess: (result) => {
      invalidateMoney(business.business_id)
      toast.success(tr("Salary of {0} paid", { 0: formatMoney(money(result.amount, currency.decimals), currency) }), {
        description: tr("Recorded as one expense · TX-{0}", { 0: String(result.reference_no).padStart(6, '0') }),
      })
      setKey(newIdempotencyKey())
      setAmount('')
      setStep('details')
      onClose()
    },
    onError: (error) => {
      toast.error(error)
      setStep('details')
    },
  })

  const openFor = Boolean(employee)
  const activeMethods = useMemo(() => (methods.data ?? []).filter((method) => method.status === 'active'), [methods.data])

  // Pre-fill with what is still owed when the dialog opens.
  useEffect(() => {
    if (!openFor || !employee) return
    setEmployeeId(employee.employee_id)
    setAmount(employee.remaining > 0 ? minorToInput(money(employee.remaining, currency.decimals), currency) : '')
    setStep('details')
  }, [openFor, employee, currency])

  useEffect(() => {
    if (!methodId && activeMethods.length) setMethodId(activeMethods[0]!.id)
  }, [activeMethods, methodId])

  return (
    <Modal
      open={openFor}
      onOpenChange={(next) => !next && onClose()}
      title={step === 'details' ? tr("Pay salary") : tr("Review salary payment")}
      description={step === 'details' ? tr("Mushahar · {0}", { 0: formatMonth(period) }) : tr("Check the details before the money is recorded")}
      icon={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><BadgeDollarSign className="size-5" /></span>}
      footer={
        step === 'details' ? (
          <>
            <Button onClick={onClose}>{tr("Cancel")}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!employeeId || moneyError(amount, currency) || !methodId) {
                  toast.info(tr("Check the payment details"), tr("Employee, amount and payment method are required."))
                  return
                }
                if (type === 'adjustment' && reason.trim().length < 5) {
                  toast.info(tr("Give a reason for the adjustment"), tr("At least 5 characters."))
                  return
                }
                setStep('review')
              }}
            >
              {tr("Review")}
            </Button>
          </>
        ) : (
          <>
            <Button icon={<ArrowLeft className="size-4" />} onClick={() => setStep('details')}>{tr("Back")}</Button>
            <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>{tr("Confirm payment")}</Button>
          </>
        )
      }
    >
      {step === 'details' ? (
        <div className="flex flex-col gap-4">
          <Field label={tr("Employee")}>
            <Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              {employees.map((item) => (
                <option key={item.employee_id} value={item.employee_id}>
                  {item.full_name} — {formatMoney(money(item.remaining, currency.decimals), currency)}{' '}{tr("left")}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("Payment type")}>
              <Select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                <option value="salary">{tr("Salary")}</option>
                <option value="advance">{tr("Advance")}</option>
                <option value="adjustment">{tr("Adjustment (extra)")}</option>
              </Select>
            </Field>
            <Field label={tr("Amount")} error={amount ? moneyError(amount, currency) : undefined} hint={tr("Remaining for {0}: {1}", { 0: formatMonth(period), 1: formatMoney(remaining, currency) })}>
              <MoneyInput currency={currency} value={amount} onChange={setAmount} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("Paid from")}>
              <Select value={methodId} onChange={(event) => setMethodId(event.target.value)}>
                {activeMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={tr("Payment date")}>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
          </div>
          {type === 'adjustment' ? (
            <Field label={tr("Reason for the adjustment")}>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tr("e.g. Bonus for covering extra shifts")} />
            </Field>
          ) : null}
          <Field label={tr("Note")} optional>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface-2 p-4">
            <Avatar name={selected?.full_name ?? 'Employee'} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">{selected?.full_name}</p>
              <p className="text-sm text-ink-500">
                {selected?.position}{' '}{tr("· monthly salary")}{' '}{formatMoney(money(selected?.monthly_salary ?? 0, currency.decimals), currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-500">{tr("Paying")}</p>
              <p className="num text-2xl font-bold text-ink-900">{amount}</p>
            </div>
          </div>
          <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-y-2.5 text-sm">
            <dt className="text-ink-500">{tr("Salary period")}</dt><dd className="font-medium">{formatMonth(period)}</dd>
            <dt className="text-ink-500">{tr("Payment type")}</dt><dd className="font-medium capitalize">{type}</dd>
            <dt className="text-ink-500">{tr("Paid from")}</dt><dd className="font-medium">{activeMethods.find((m) => m.id === methodId)?.name}</dd>
            <dt className="text-ink-500">{tr("Payment date")}</dt><dd className="font-medium">{formatBusinessDate(date)}</dd>
          </dl>
          <Callout tone="info">
            {tr("This records")}{' '}<strong>{tr("one expense")}</strong>{' '}{tr("in the")}{' '}<strong>{tr("Salary")}</strong>{' '}{tr("category, dated")}{' '}{formatBusinessDate(date)}{tr(". It is counted once — in Expenses, Salaries and Reports.")}
          </Callout>
        </div>
      )}
    </Modal>
  )
}
