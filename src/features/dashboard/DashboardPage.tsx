import { FEATURES } from '@/lib/features'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeDollarSign, Calculator, CircleCheck, ChartColumn, List, Plus,
  Scale, TriangleAlert, Wallet,
} from 'lucide-react'
import { getCashflow, getDashboard, getSalaryOverview, listInvoices, listTransactions } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { useQuickActions } from '@/app/AppShell'
import {
  Avatar, Badge, Button, Card, CardHeader, Dot, EmptyState, ErrorState, Money, PageHeader, Progress, Segmented,
  Skeleton, StatCard, StatusBadge,
} from '@/components/ui/primitives'
import { CashflowChart } from '@/components/charts/CashflowChart'
import { formatBusinessDate, formatBusinessTime, formatLongDate, presetRange } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { categoryColor } from '@/lib/utils'
import type { DashboardSummary } from '@/types/db'
import { tr } from '@/i18n'

type Range = 'last_7' | 'last_30' | 'this_month'

export default function DashboardPage() {
  const business = useBusiness()
  const { currency, timezone, can, context } = useSession()
  const quick = useQuickActions()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('last_7')

  const summary = useQuery({
    queryKey: queryKeys.dashboard(business.business_id),
    queryFn: () => getDashboard(business.business_id),
  })

  const chartRange = useMemo(
    () => presetRange(range, business.business_date, business.settings.week_starts_on),
    [range, business.business_date, business.settings.week_starts_on],
  )

  const cashflow = useQuery({
    queryKey: queryKeys.cashflow(business.business_id, chartRange.from, chartRange.to),
    queryFn: () => getCashflow(business.business_id, chartRange.from, chartRange.to),
    enabled: can('income.view') && can('expenses.view'),
  })

  const recent = useQuery({
    queryKey: [...queryKeys.transactions(business.business_id), 'recent'],
    queryFn: () =>
      listTransactions(business.business_id, {
        from: presetRange('last_30', business.business_date).from,
        to: business.business_date,
        pageSize: 7,
      }),
    enabled: can('income.view') || can('expenses.view'),
  })

  const invoices = useQuery({
    queryKey: [...queryKeys.invoices(business.business_id), 'recent'],
    queryFn: () =>
      listInvoices(business.business_id, {
        from: presetRange('last_30', business.business_date).from,
        to: business.business_date,
        pageSize: 4,
      }),
    enabled: can('invoices.view'),
  })

  const salaries = useQuery({
    queryKey: queryKeys.salaryOverview(business.business_id, business.business_date.slice(0, 7) + '-01'),
    queryFn: () => getSalaryOverview(business.business_id, `${business.business_date.slice(0, 7)}-01`),
    enabled: can('salaries.view'),
  })

  if (summary.isError) {
    return <ErrorState message={tr("Could not load the dashboard")} detail={tr("GYMATICK could not reach the server.")} onRetry={() => void summary.refetch()} />
  }

  const data = summary.data
  const today = data?.today
  const closing = data?.closing_status
  const hour = new Date().getHours()
  const greeting = hour < 12 ? tr('Good morning') : hour < 18 ? tr('Good afternoon') : tr('Good evening')
  const firstName = (context?.user.full_name ?? '').split(' ')[0] ?? ''
  const nothingYet = (today?.transaction_count ?? 0) === 0 && !business.go_live_date

  return (
    <>
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{formatLongDate(business.business_date)}</span>
            {closing ? (
              closing.is_closed ? (
                <Badge tone={closing.is_balanced ? 'success' : 'danger'} icon={closing.is_balanced ? <CircleCheck className="size-3.5" /> : <TriangleAlert className="size-3.5" />}>
                  {tr("Closed")}{' '}{formatBusinessTime(closing.closed_at, timezone)}
                  {closing.is_balanced === false && closing.difference_total !== null
                    ? ` · ${formatMoney(money(closing.difference_total, currency.decimals), currency, { sign: true })}`
                    : tr(" · balanced")}
                </Badge>
              ) : (
                <Badge tone="info"><Dot color="currentColor" />{' '}{tr("Today is open · not closed yet")}</Badge>
              )
            ) : null}
            {closing && closing.unclosed_days_with_activity > 0 ? (
              <Badge tone="warning" icon={<TriangleAlert className="size-3.5" />}>
                {closing.unclosed_days_with_activity}{' '}{tr("earlier day")}{closing.unclosed_days_with_activity > 1 ? tr("s") : ''}{' '}{tr("not closed")}
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <>
            {can('income.create') ? <Button variant="primary" icon={<Plus className="size-4" />} onClick={quick.addIncome}>{tr("Add income")}</Button> : null}
            {can('expenses.create') ? <Button icon={<ArrowUpRight className="size-4" />} onClick={quick.addExpense}>{tr("Add expense")}</Button> : null}
            {can('closings.view') ? <Button icon={<Calculator className="size-4" />} onClick={() => navigate('/xisaab-xir')}>{tr("Xisaab Xir")}</Button> : null}
          </>
        }
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.5fr)]">
        {summary.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[150px]" />)
        ) : (
          <>
            <StatCard
              label={tr("Income today")}
              icon={<ArrowDownLeft className="size-5" />}
              tone="income"
              value={
                today?.income === null || today?.income === undefined ? (
                  <span className="text-base font-semibold text-ink-400">{tr("Not shown")}</span>
                ) : (
                  <span className="text-income-700">{formatMoney(money(today.income, currency.decimals), currency, { sign: true })}</span>
                )
              }
              caption={today?.income !== null && today?.income !== undefined ? tr("{0} entries today", { 0: today.transaction_count }) : tr("Ask the owner for access")}
              footer={
                data?.after_close ? (
                  <p className="text-xs text-ink-500">
                    +{formatMoney(money(data.after_close.income, currency.decimals), currency)}{' '}{tr("recorded for")}{' '}
                    {formatBusinessDate(data.after_close.business_date, 'd MMM')}
                  </p>
                ) : undefined
              }
            />
            <StatCard
              label={tr("Expenses today")}
              icon={<ArrowUpRight className="size-5" />}
              tone="expense"
              value={
                today?.expenses === null || today?.expenses === undefined ? (
                  <span className="text-base font-semibold text-ink-400">{tr("Not shown")}</span>
                ) : (
                  <span className="text-expense-600">{formatMoney(money(today.expenses, currency.decimals), currency)}</span>
                )
              }
              caption={
                today?.salaries !== null && today?.salaries !== undefined && today.salaries > 0
                  ? tr("incl. {0} salaries", { 0: formatMoney(money(today.salaries, currency.decimals), currency) })
                  : tr("Bills, supplies and salaries")
              }
            />
            <StatCard
              label={tr("Net today")}
              icon={<Scale className="size-5" />}
              tone="brand"
              value={
                today?.net === null || today?.net === undefined ? (
                  <span className="text-base font-semibold text-ink-400">{tr("Not shown")}</span>
                ) : (
                  <span className={money(today.net, currency.decimals) >= 0 ? 'text-income-700' : 'text-expense-600'}>
                    {formatMoney(money(today.net, currency.decimals), currency, { sign: true })}
                  </span>
                )
              }
              caption={tr("Income − expenses")}
            />
            <BalanceCard data={data} />
          </>
        )}
      </div>

      {/* Secondary strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink-100 text-ink-600"><List className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink-600">{tr("Transactions today")}</p>
            <p className="text-xs text-ink-500">{tr("Everything recorded for")}{' '}{formatBusinessDate(business.business_date, 'd MMM')}</p>
          </div>
          <span className="num text-xl font-bold text-ink-900">{today?.transaction_count ?? 0}</span>
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-pending-50 text-pending-600"><BadgeDollarSign className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink-600">{tr("Pending salaries")}</p>
            <p className="text-xs text-ink-500">
              {data?.pending_salaries
                ? tr("{0} of {1} employees", { 0: data.pending_salaries.unpaid_count, 1: data.pending_salaries.employee_count })
                : tr("Only staff with salary access see this")}
            </p>
          </div>
          {data?.pending_salaries ? (
            <Link to="/salaries" className="num text-xl font-bold text-ink-900 hover:text-brand-600">
              {formatMoney(money(data.pending_salaries.pending, currency.decimals), currency)}
            </Link>
          ) : (
            <span className="text-ink-400">—</span>
          )}
        </Card>

        <Card className="flex items-center gap-3.5 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600"><Calculator className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink-600">{tr("Today's Xisaab Xir")}</p>
            <p className="text-xs text-ink-500">{closing?.is_closed ? tr("Closed for today") : tr("Not closed yet")}</p>
          </div>
          {can('closings.perform') && !closing?.is_closed ? (
            <Button variant="primary" size="sm" onClick={() => navigate('/xisaab-xir')}>{tr("Close day")}</Button>
          ) : can('closings.view') ? (
            <Button size="sm" onClick={() => navigate('/xisaab-xir')}>{tr("Open")}</Button>
          ) : null}
        </Card>
      </div>

      {/* Chart + last closing */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={tr("Income vs expenses")}
            description={tr("Net result shown as a line")}
            action={
              <Segmented
                value={range}
                onChange={setRange}
                options={[
                  { value: 'last_7', label: tr("7 days") },
                  { value: 'last_30', label: tr("30 days") },
                  { value: 'this_month', label: tr("This month") },
                ]}
              />
            }
          />
          <div className="p-5 pt-4">
            {!can('income.view') || !can('expenses.view') ? (
              <EmptyState title={tr("Cash flow is not shown for your account")} description={tr("Ask the owner if you need to see income and expenses together.")} />
            ) : cashflow.isLoading ? (
              <Skeleton className="h-[300px]" />
            ) : cashflow.isError ? (
              <ErrorState message={tr("Could not load the chart")} onRetry={() => void cashflow.refetch()} />
            ) : (cashflow.data ?? []).every((point) => point.income === 0 && point.expenses === 0) ? (
              <EmptyState
                icon={<ChartColumn className="size-6" />}
                title={tr("No money recorded in this period")}
                description={tr("Record your first income or expense and the cash flow appears here.")}
                actions={
                  can('income.create') ? <Button variant="primary" icon={<Plus className="size-4" />} onClick={quick.addIncome}>{tr("Add income")}</Button> : undefined
                }
              />
            ) : (
              <CashflowChart
                currency={currency}
                data={(cashflow.data ?? []).map((point) => ({
                  day: point.day,
                  income: money(point.income, currency.decimals),
                  expenses: money(point.expenses, currency.decimals),
                  net: money(point.net, currency.decimals),
                }))}
              />
            )}
          </div>
        </Card>

        <LastClosingCard data={data} />
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title={tr("Recent transactions")}
            description={tr("The newest money movements")}
            action={
              <Link to={can('transactions.view_all') ? '/transactions' : '/income'} className="flex items-center gap-1 text-sm font-semibold text-brand-600">
                {tr("View all")}{' '}<ArrowRight className="size-4" />
              </Link>
            }
          />
          <div className="mt-3">
            {recent.isLoading ? (
              <div className="flex flex-col gap-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (recent.data?.rows.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Wallet className="size-6" />}
                title={tr("No money recorded yet")}
                description={tr("Record your first income or expense — it appears here straight away.")}
                actions={
                  <>
                    {can('income.create') ? <Button variant="primary" icon={<Plus className="size-4" />} onClick={quick.addIncome}>{tr("Add income")}</Button> : null}
                    {can('expenses.create') ? <Button icon={<ArrowUpRight className="size-4" />} onClick={quick.addExpense}>{tr("Add expense")}</Button> : null}
                  </>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {recent.data!.rows.map((row) => {
                  const incoming = ['income', 'transfer_in', 'owner_deposit'].includes(row.kind)
                  return (
                    <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-[9px] ${incoming ? 'bg-income-50 text-income-600' : 'bg-expense-50 text-expense-600'}`}>
                        {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">{row.description}</p>
                        <p className="truncate text-xs text-ink-500">
                          {row.customer_name ?? row.vendor ?? row.employee_name ?? (FEATURES.customers ? tr("Walk-in") : (row.category_name ?? ''))} ·{' '}
                          {formatBusinessDate(row.business_date, 'd MMM')} {formatBusinessTime(row.occurred_at, timezone)}
                        </p>
                      </div>
                      {row.category_name ? (
                        <span className="hidden items-center gap-1.5 text-xs text-ink-500 md:flex">
                          <Dot color={categoryColor(row.category_color)} />
                          {row.category_name}
                        </span>
                      ) : null}
                      <span className="hidden text-xs text-ink-500 lg:inline">{row.payment_method_name}</span>
                      <Money
                        value={money(row.amount, currency.decimals)}
                        currency={currency}
                        tone={incoming ? 'income' : 'expense'}
                        sign={false}
                        className="shrink-0 text-sm"
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        <PendingSalariesCard overview={salaries.data} loading={salaries.isLoading} canView={can('salaries.view')} />
      </div>

      {can('invoices.view') ? (
        <Card className="overflow-hidden">
          <CardHeader
            title={tr("Recent invoices")}
            description={
              data?.outstanding_invoices
                ? tr("Unpaid: {0} across {1} invoices", { 0: formatMoney(money(data.outstanding_invoices.total, currency.decimals), currency), 1: data.outstanding_invoices.count })
                : undefined
            }
            action={<Link to="/invoices" className="flex items-center gap-1 text-sm font-semibold text-brand-600">{tr("All invoices")}{' '}<ArrowRight className="size-4" /></Link>}
          />
          <div className="mt-3">
            {invoices.isLoading ? (
              <div className="flex flex-col gap-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (invoices.data?.rows.length ?? 0) === 0 ? (
              <EmptyState title={tr("No invoices yet")} description={tr("Create an invoice or receipt for a member — you can attach a payment you already recorded.")} />
            ) : (
              <ul className="divide-y divide-line">
                {invoices.data!.rows.map((invoice) => (
                  <li key={invoice.id}>
                    <Link to={`/invoices/${invoice.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                      <span className="num w-36 shrink-0 text-[13px] font-semibold text-ink-700">{invoice.invoice_number}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{invoice.customer_display_name ?? tr("Walk-in customer")}</span>
                      <span className="hidden text-xs text-ink-500 sm:inline">{formatBusinessDate(invoice.issue_date, 'd MMM')}</span>
                      <StatusBadge status={invoice.status} />
                      <span className="num w-24 shrink-0 text-right text-sm font-semibold text-ink-900">
                        {formatMoney(money(invoice.total, currency.decimals), currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {nothingYet ? (
        <Card className="p-6">
          <EmptyState
            icon={<Calculator className="size-6" />}
            title={tr("Finish setting up GYMATICK")}
            description={tr("Set your opening balances so the system knows how much money the gym holds right now.")}
            actions={<Button variant="primary" onClick={() => navigate('/onboarding')}>{tr("Set opening balances")}</Button>}
          />
        </Card>
      ) : null}
    </>
  )
}

function BalanceCard({ data }: { data: DashboardSummary | undefined }) {
  const { currency } = useSession()
  const methodColors = ['var(--color-method-1)', 'var(--color-method-2)', 'var(--color-method-3)', 'var(--color-method-4)', 'var(--color-method-5)']

  if (!data?.balance) {
    return (
      <Card className="flex flex-col justify-between gap-2.5 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-ink-600">{tr("Current balance")}</span>
          <span className="grid size-9 place-items-center rounded-[10px] bg-ink-100 text-ink-500"><Wallet className="size-5" /></span>
        </div>
        <p className="text-base font-semibold text-ink-400">{tr("Not shown for your account")}</p>
        <p className="text-xs text-ink-500">{tr("Ask the owner if you need to see the gym balance.")}</p>
      </Card>
    )
  }

  const total = money(data.balance.total, currency.decimals)
  const parts = data.balance.by_method.filter((method) => money(method.balance, currency.decimals) !== 0)
  const sum = parts.reduce((acc, method) => acc + Math.abs(money(method.balance, currency.decimals)), 0) || 1

  return (
    <Card className="flex flex-col gap-3 border-[#0f1b44] bg-[#0f1b44] p-5 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white/70">{tr("Current balance")}</span>
        <span className="grid size-9 place-items-center rounded-[10px] bg-white/10 text-brand-300"><Wallet className="size-5" /></span>
      </div>
      <p className="text-[28px] font-bold leading-9 tracking-tight">{formatMoney(total, currency)}</p>
      <p className="-mt-1 text-xs text-white/55">
        {data.balance.checkpoint_date
          ? tr("Counted {0} + movements since", { 0: formatBusinessDate(data.balance.checkpoint_date, 'd MMM') })
          : tr("From your opening balances")}
      </p>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {parts.map((method, index) => (
          <span
            key={method.payment_method_id}
            className="block h-full"
            style={{ width: `${(Math.abs(money(method.balance, currency.decimals)) / sum) * 100}%`, background: methodColors[index % 5] }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        {data.balance.by_method.map((method, index) => (
          <div key={method.payment_method_id} className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[11px] text-white/60">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: methodColors[index % 5] }} aria-hidden />
              {method.name}
            </p>
            <p className="num truncate text-[13px] font-semibold">{formatMoney(money(method.balance, currency.decimals), currency)}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function LastClosingCard({ data }: { data: DashboardSummary | undefined }) {
  const { currency, timezone, can } = useSession()
  const last = data?.last_closing

  if (!can('closings.view')) {
    return (
      <Card className="p-5">
        <CardHeader title={tr("Xisaab Xir")} description={tr("Daily closing")} className="p-0" />
        <p className="mt-4 text-sm text-ink-500">{tr("Closing figures are only shown to staff with Xisaab Xir access.")}</p>
      </Card>
    )
  }

  if (!last) {
    return (
      <Card>
        <CardHeader title={tr("Last Xisaab Xir")} description={tr("Daily closing")} />
        <EmptyState
          icon={<Calculator className="size-6" />}
          title={tr("No day closed yet")}
          description={tr("Close your first day from Xisaab Xir when the gym stops taking money.")}
          actions={<Link to="/xisaab-xir"><Button variant="primary">{tr("Go to Xisaab Xir")}</Button></Link>}
        />
      </Card>
    )
  }

  const difference = money(last.difference_total, currency.decimals)
  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? 'font-semibold text-ink-900' : 'text-ink-500'}>{label}</span>
      <span className={`num ${strong ? 'font-bold text-ink-900' : 'font-semibold text-ink-700'}`}>{value}</span>
    </div>
  )

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={tr("Last Xisaab Xir")}
        description={tr("{0} · closed {1}", { 0: formatBusinessDate(last.business_date, 'EEE, d MMM yyyy'), 1: formatBusinessTime(last.closed_at, timezone) })}
        action={<StatusBadge status={last.is_balanced ? 'balanced' : 'difference'} />}
      />
      <div className="flex flex-1 flex-col gap-2.5 p-5 pt-4">
        {row('Opening balance', formatMoney(money(last.opening_total, currency.decimals), currency))}
        {row('+ Money received', formatMoney(money(last.money_in_total, currency.decimals), currency))}
        {row('− Money used', formatMoney(money(last.money_out_total, currency.decimals), currency))}
        <div className="h-px bg-line" />
        {row('Expected', formatMoney(money(last.expected_total, currency.decimals), currency), true)}
        {row('Counted', formatMoney(money(last.actual_total, currency.decimals), currency), true)}
        <div className={`flex items-center justify-between rounded-[10px] px-3 py-2.5 ${difference === 0 ? 'bg-income-50' : 'bg-expense-50'}`}>
          <span className={`flex items-center gap-2 text-sm font-semibold ${difference === 0 ? 'text-income-700' : 'text-expense-600'}`}>
            {difference === 0 ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />}
            {tr("Difference")}
          </span>
          <span className={`num text-sm font-bold ${difference === 0 ? 'text-income-700' : 'text-expense-600'}`}>
            {formatMoney(difference, currency, { sign: difference !== 0 })}
          </span>
        </div>
        {last.notes ? (
          <div className="flex items-start gap-2 text-xs text-ink-500">
            <Avatar name={last.closed_by_name ?? 'User'} size="sm" />
            <span>“{last.notes}”</span>
          </div>
        ) : (
          <p className="text-xs text-ink-500">{tr("Closed by")}{' '}{last.closed_by_name ?? tr("a manager")}</p>
        )}
        <div className="mt-auto flex gap-2 pt-2">
          <Link to={`/xisaab-xir/${last.id}`} className="flex-1"><Button className="w-full">{tr("View closing")}</Button></Link>
          <Link to="/xisaab-xir/history"><Button variant="ghost">{tr("History")}</Button></Link>
        </div>
      </div>
    </Card>
  )
}

function PendingSalariesCard({ overview, loading, canView }: {
  overview: { employees: { employee_id: string; full_name: string; position: string; monthly_salary: number; paid: number; remaining: number }[]; totals: { pending: number } } | undefined
  loading: boolean
  canView: boolean
}) {
  const { currency } = useSession()
  const navigate = useNavigate()

  if (!canView) {
    return (
      <Card className="p-5">
        <CardHeader title={tr("Salaries")} description={tr("Mushahar")} className="p-0" />
        <p className="mt-4 text-sm text-ink-500">{tr("Salary information is only shown to staff with salary access.")}</p>
      </Card>
    )
  }

  const rows = (overview?.employees ?? []).filter((employee) => employee.remaining > 0).slice(0, 5)

  return (
    <Card className="flex flex-col">
      <CardHeader title={tr("Pending salaries")} description={tr("This month")} action={rows.length ? <StatusBadge status="pending" /> : undefined} />
      <div className="flex flex-1 flex-col gap-3.5 p-5 pt-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-10" />)
        ) : rows.length === 0 ? (
          <EmptyState icon={<CircleCheck className="size-6" />} title={tr("All salaries are paid")} description={tr("Nothing is owed to employees for this month.")} />
        ) : (
          rows.map((employee) => {
            const paid = money(employee.paid, currency.decimals)
            const total = money(employee.monthly_salary, currency.decimals)
            return (
              <div key={employee.employee_id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={employee.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{employee.full_name}</p>
                    <p className="num truncate text-xs text-ink-500">
                      {tr("Paid")}{' '}{formatMoney(paid, currency)}{' '}{tr("of")}{' '}{formatMoney(total, currency)}
                    </p>
                  </div>
                  <span className="num text-sm font-bold text-ink-900">{formatMoney(money(employee.remaining, currency.decimals), currency)}</span>
                </div>
                <Progress value={total > 0 ? (paid / total) * 100 : 0} />
              </div>
            )
          })
        )}
        {rows.length ? (
          <>
            <div className="mt-auto h-px bg-line" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">{tr("Total pending")}</span>
              <span className="num font-bold text-ink-900">{formatMoney(money(overview?.totals.pending ?? 0, currency.decimals), currency)}</span>
            </div>
            <Button icon={<BadgeDollarSign className="size-4" />} onClick={() => navigate('/salaries')} className="w-full">
              {tr("Open salaries")}
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  )
}
