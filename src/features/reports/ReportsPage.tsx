import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, BadgeDollarSign, Download, Printer, ReceiptText, Scale, Calculator, List } from 'lucide-react'
import { exportTransactions, getReport, logExport } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Button, Card, CardHeader, Delta, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '@/components/ui/primitives'
import { DateRangeFilter, FilterBar } from '@/components/ui/filters'
import { CashflowChart } from '@/components/charts/CashflowChart'
import { BreakdownBars } from '@/components/charts/BreakdownBars'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate, presetRange, type DatePreset } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { percentChange } from '@/lib/finance'
import { downloadCsv, toCsv } from '@/lib/utils'

export default function ReportsPage() {
  const business = useBusiness()
  const { currency, can } = useSession()
  const [preset, setPreset] = useState<DatePreset>('this_month')
  const [range, setRange] = useState(() => presetRange('this_month', business.business_date, business.settings.week_starts_on))

  const report = useQuery({
    queryKey: queryKeys.report(business.business_id, range.from, range.to),
    queryFn: () => getReport(business.business_id, range.from, range.to),
    placeholderData: (previous) => previous,
  })

  const data = report.data
  const totals = data?.totals
  const previous = data?.previous

  const exportCsv = async () => {
    try {
      const rows = await exportTransactions(business.business_id, range.from, range.to)
      downloadCsv(
        `gymatick-report-${range.from}_${range.to}.csv`,
        toCsv(rows as Record<string, unknown>[], [
          { key: 'business_date', label: 'Business date' },
          { key: 'reference', label: 'Reference' },
          { key: 'kind', label: 'Kind' },
          { key: 'description', label: 'Description' },
          { key: 'category', label: 'Category' },
          { key: 'payment_method', label: 'Payment method' },
          { key: 'customer', label: 'Customer' },
          { key: 'vendor', label: 'Paid to' },
          { key: 'direction', label: 'Direction' },
          { key: 'amount', label: 'Amount', numeric: true },
          { key: 'recorded_by', label: 'Recorded by' },
        ]),
      )
      await logExport(business.business_id, range.from, range.to, rows.length)
      toast.success(`${rows.length} transactions exported`)
    } catch (error) {
      toast.error(error)
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Warbixinno · How the business is performing"
        actions={
          <>
            {can('reports.export') ? <Button icon={<Download className="size-4" />} onClick={exportCsv}>Export CSV</Button> : null}
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()} className="no-print">Print</Button>
          </>
        }
      />

      <FilterBar className="no-print">
        <DateRangeFilter
          value={range}
          preset={preset}
          businessToday={business.business_date}
          weekStartsOn={business.settings.week_starts_on}
          onChange={(next, nextPreset) => {
            setRange(next)
            setPreset(nextPreset)
          }}
        />
        {data ? (
          <span className="text-xs text-ink-500">
            compared with {formatBusinessDate(data.range.previous_from, 'd MMM')} – {formatBusinessDate(data.range.previous_to, 'd MMM')}
          </span>
        ) : null}
      </FilterBar>

      {report.isError ? (
        <ErrorState message="Could not load the report" onRetry={() => void report.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {report.isLoading && !data ? (
              Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[126px]" />)
            ) : (
              <>
                <StatCard
                  label="Income"
                  value={<span className="text-income-700">{formatMoney(money(totals?.income ?? 0, currency.decimals), currency)}</span>}
                  icon={<ArrowDownLeft className="size-5" />}
                  tone="income"
                  delta={<Delta value={percentChange(money(totals?.income ?? 0, currency.decimals), money(previous?.income ?? 0, currency.decimals))} />}
                  caption="vs previous period"
                />
                <StatCard
                  label="Expenses"
                  value={<span className="text-expense-600">{formatMoney(money(totals?.expenses ?? 0, currency.decimals), currency)}</span>}
                  icon={<ArrowUpRight className="size-5" />}
                  tone="expense"
                  delta={<Delta value={percentChange(money(totals?.expenses ?? 0, currency.decimals), money(previous?.expenses ?? 0, currency.decimals))} goodWhenUp={false} />}
                  caption="vs previous period"
                />
                <StatCard
                  label="Salaries"
                  value={formatMoney(money(totals?.salaries ?? 0, currency.decimals), currency)}
                  icon={<BadgeDollarSign className="size-5" />}
                  tone="pending"
                  caption={
                    totals && totals.expenses > 0
                      ? `${Math.round((totals.salaries / totals.expenses) * 100)}% of expenses (already included)`
                      : 'Included in expenses'
                  }
                />
                <StatCard
                  label="Net result"
                  value={
                    <span className={money(totals?.net ?? 0, currency.decimals) >= 0 ? 'text-income-700' : 'text-expense-600'}>
                      {formatMoney(money(totals?.net ?? 0, currency.decimals), currency, { sign: true })}
                    </span>
                  }
                  icon={<Scale className="size-5" />}
                  tone="brand"
                  delta={<Delta value={percentChange(money(totals?.net ?? 0, currency.decimals), money(previous?.net ?? 0, currency.decimals))} />}
                  caption="Income − expenses"
                />
                <StatCard label="Transactions" value={<span className="num">{totals?.transaction_count ?? 0}</span>} icon={<List className="size-5" />} tone="neutral" caption="Posted entries" />
                <StatCard
                  label="Average daily income"
                  value={formatMoney(money(totals?.average_daily_income ?? 0, currency.decimals), currency)}
                  icon={<ArrowDownLeft className="size-5" />}
                  tone="neutral"
                  caption="Over the days so far"
                />
                <StatCard
                  label="Outstanding invoices"
                  value={formatMoney(money(data?.invoices.outstanding ?? 0, currency.decimals), currency)}
                  icon={<ReceiptText className="size-5" />}
                  tone="pending"
                  caption={`${data?.invoices.outstanding_count ?? 0} invoices not fully paid`}
                />
                <StatCard
                  label="Closing differences"
                  value={
                    <span className={money(data?.closings?.difference_total ?? 0, currency.decimals) === 0 ? '' : 'text-expense-600'}>
                      {formatMoney(money(data?.closings?.difference_total ?? 0, currency.decimals), currency, {
                        sign: money(data?.closings?.difference_total ?? 0, currency.decimals) !== 0,
                      })}
                    </span>
                  }
                  icon={<Calculator className="size-5" />}
                  tone="neutral"
                  caption={data?.closings ? `${data.closings.days_with_difference} of ${data.closings.days_closed} days differed` : 'No closing access'}
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader title="Income vs expenses" description={`Grouped by ${data?.granularity ?? 'day'}`} />
            <div className="p-5 pt-4">
              {report.isLoading && !data ? (
                <Skeleton className="h-[300px]" />
              ) : (data?.series ?? []).every((point) => point.income === 0 && point.expenses === 0) ? (
                <EmptyState title="No activity in this period" description="Choose a different date range to see the numbers." />
              ) : (
                <CashflowChart
                  currency={currency}
                  height={320}
                  data={(data?.series ?? []).map((point) => ({
                    day: point.bucket,
                    income: money(point.income, currency.decimals),
                    expenses: money(point.expenses, currency.decimals),
                    net: money(point.net, currency.decimals),
                  }))}
                />
              )}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Where the money came from" description="Income by category" />
              <div className="p-5 pt-4">
                <BreakdownBars
                  tone="income"
                  currency={currency}
                  emptyText="No income in this period"
                  rows={(data?.income_categories ?? []).map((row) => ({
                    label: row.name,
                    amount: money(row.amount ?? 0, currency.decimals),
                    share: row.share ?? 0,
                  }))}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Where the money went" description="Expenses by category (salaries included)" />
              <div className="p-5 pt-4">
                <BreakdownBars
                  tone="expense"
                  currency={currency}
                  emptyText="No expenses in this period"
                  rows={(data?.expense_categories ?? []).map((row) => ({
                    label: row.name,
                    amount: money(row.amount ?? 0, currency.decimals),
                    share: row.share ?? 0,
                  }))}
                />
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Payment methods" description="Money in and out by method (transfers excluded)" />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Method', 'Money in', 'Money out', 'Net'].map((header, index) => (
                      <th key={header} className={`h-10 border-b border-line bg-surface-2 px-4 text-xs font-semibold text-ink-500 ${index === 0 ? 'text-left' : 'text-right'}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.payment_methods ?? []).map((method) => (
                    <tr key={method.payment_method_id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 font-semibold text-ink-900">{method.name}</td>
                      <td className="num px-4 text-right text-income-700">{formatMoney(money(method.money_in ?? 0, currency.decimals), currency)}</td>
                      <td className="num px-4 text-right text-expense-600">{formatMoney(money(method.money_out ?? 0, currency.decimals), currency)}</td>
                      <td className="num px-4 text-right font-semibold text-ink-900">
                        {formatMoney(money(method.net ?? 0, currency.decimals), currency, { sign: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totals && (totals.owner_deposits > 0 || totals.owner_withdrawals > 0 || totals.transfers > 0) ? (
            <Card>
              <CardHeader title="Other money movements" description="Not part of the net result" />
              <div className="grid gap-4 p-5 pt-4 sm:grid-cols-3">
                <Figure label="Owner deposits" value={formatMoney(money(totals.owner_deposits, currency.decimals), currency)} />
                <Figure label="Owner withdrawals" value={formatMoney(money(totals.owner_withdrawals, currency.decimals), currency)} />
                <Figure label="Transfers between methods" value={formatMoney(money(totals.transfers, currency.decimals), currency)} />
              </div>
            </Card>
          ) : null}

          <p className="text-xs text-ink-500">
            Figures use posted transactions by business date ({business.settings.timezone}). Voided entries are excluded. Salaries are
            included in expenses.
          </p>
        </>
      )}
    </>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 p-4">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="num text-lg font-bold text-ink-900">{value}</span>
    </div>
  )
}
