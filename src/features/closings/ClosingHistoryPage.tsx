import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Calculator, CircleCheck, Scale, TriangleAlert } from 'lucide-react'
import { listClosings } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge } from '@/components/ui/primitives'
import { DataTable, Pagination, type Column } from '@/components/ui/table'
import { DateRangeFilter, FilterBar } from '@/components/ui/filters'
import { formatBusinessDate, formatBusinessTime, presetRange, type DatePreset } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import type { ClosingRow } from '@/types/db'
import { tr } from '@/i18n'

export default function ClosingHistoryPage() {
  const business = useBusiness()
  const { currency, timezone } = useSession()
  const navigate = useNavigate()
  const [preset, setPreset] = useState<DatePreset>('this_month')
  const [range, setRange] = useState(() => presetRange('this_month', business.business_date, business.settings.week_starts_on))
  const [page, setPage] = useState(0)

  const list = useQuery({
    queryKey: queryKeys.closingList(business.business_id, { ...range, page }),
    queryFn: () => listClosings(business.business_id, { ...range, page, pageSize: 25 }),
    placeholderData: (previous) => previous,
  })

  const rows = list.data?.rows ?? []
  const closed = rows.filter((row) => row.status === 'closed')
  const balanced = closed.filter((row) => row.is_balanced).length
  const withDifference = closed.length - balanced
  const netDifference = closed.reduce((total, row) => total + money(row.difference_total, currency.decimals), 0)

  const columns: Column<ClosingRow>[] = [
    {
      key: 'date',
      header: tr("Date"),
      priority: 1,
      mobile: 'title',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink-900">{formatBusinessDate(row.business_date, 'EEE d MMM yyyy')}</span>
          {row.period_start !== row.business_date ? (
            <span className="text-xs text-ink-500">{tr("covers from")}{' '}{formatBusinessDate(row.period_start, 'd MMM')}</span>
          ) : row.status === 'reopened' ? (
            <span className="text-xs text-ink-500">{tr("replaced")}</span>
          ) : null}
        </div>
      ),
    },
    { key: 'opening', header: tr("Opening"), align: 'right', priority: 3, mobile: 'hide', cell: (row) => <span className="num">{formatMoney(money(row.opening_total, currency.decimals), currency)}</span> },
    { key: 'income', header: tr("Income"), align: 'right', priority: 2, mobile: 'meta', cell: (row) => <span className="num text-income-700">+{formatMoney(money(row.income_total, currency.decimals), currency)}</span> },
    { key: 'expenses', header: tr("Expenses"), align: 'right', priority: 2, mobile: 'meta', cell: (row) => <span className="num text-expense-600">−{formatMoney(money(row.expense_total, currency.decimals), currency)}</span> },
    { key: 'expected', header: tr("Expected"), align: 'right', priority: 1, mobile: 'hide', cell: (row) => <span className="num font-semibold text-ink-900">{formatMoney(money(row.expected_total, currency.decimals), currency)}</span> },
    { key: 'counted', header: tr("Counted"), align: 'right', priority: 2, mobile: 'hide', cell: (row) => <span className="num font-semibold text-ink-900">{formatMoney(money(row.actual_total, currency.decimals), currency)}</span> },
    {
      key: 'difference',
      header: tr("Difference"),
      align: 'right',
      priority: 1,
      mobile: 'value',
      cell: (row) => {
        const difference = money(row.difference_total, currency.decimals)
        return (
          <div className="flex flex-col items-end">
            <span className={`num font-bold ${difference === 0 ? (row.is_balanced ? 'text-income-700' : 'text-ink-600') : difference < 0 ? 'text-expense-600' : 'text-pending-700'}`}>
              {formatMoney(difference, currency, { sign: difference !== 0 })}
            </span>
            {difference === 0 && !row.is_balanced ? (
              <span className="text-xs font-semibold text-expense-600">{row.lines_with_difference}{' '}{tr("methods differ")}</span>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: tr("Status"),
      priority: 1,
      mobile: 'meta',
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.status === 'reopened' ? (
            <StatusBadge status="reopened" />
          ) : (
            <StatusBadge status={row.is_balanced ? 'balanced' : 'difference'} />
          )}
          {row.has_corrections ? <StatusBadge status="corrected" /> : null}
        </div>
      ),
    },
    {
      key: 'by',
      header: tr("Closed by"),
      priority: 3,
      mobile: 'hide',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="whitespace-nowrap text-ink-700">{row.closed_by_name ?? '—'}</span>
          <span className="num text-xs text-ink-500">{formatBusinessTime(row.closed_at, timezone)}</span>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={tr("Closing history")}
        subtitle={tr("Xisaab Xir · Every closed day, what was expected and what was counted")}
        actions={<Link to="/xisaab-xir"><Button variant="primary" icon={<Calculator className="size-4" />}>{tr("Go to Xisaab Xir")}</Button></Link>}
      />

      <FilterBar>
        <DateRangeFilter
          value={range}
          preset={preset}
          businessToday={business.business_date}
          weekStartsOn={business.settings.week_starts_on}
          onChange={(next, nextPreset) => {
            setRange(next)
            setPreset(nextPreset)
            setPage(0)
          }}
        />
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.isLoading && !list.data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[126px]" />)
        ) : (
          <>
            <StatCard label={tr("Days closed")} value={<span className="num">{closed.length}</span>} icon={<CalendarCheck className="size-5" />} tone="brand" caption={tr("In this period")} />
            <StatCard label={tr("Balanced days")} value={<span className="num text-income-700">{balanced}</span>} icon={<CircleCheck className="size-5" />} tone="income" caption={closed.length ? tr("{0}% of closings", { 0: Math.round((balanced / closed.length) * 100) }) : '—'} />
            <StatCard label={tr("Days with a difference")} value={<span className="num text-expense-600">{withDifference}</span>} icon={<TriangleAlert className="size-5" />} tone="expense" caption={tr("{0} corrected after closing", { 0: closed.filter((row) => row.has_corrections).length })} />
            <StatCard
              label={tr("Net of differences")}
              value={<span className={netDifference === 0 ? '' : netDifference < 0 ? 'text-expense-600' : 'text-pending-700'}>{formatMoney(netDifference, currency, { sign: netDifference !== 0 })}</span>}
              icon={<Scale className="size-5" />}
              tone="neutral"
              caption={tr("Short and over added together")}
            />
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message={tr("Could not load closing history")} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              keyOf={(row) => row.id}
              loading={list.isLoading && !list.data}
              onRowClick={(row) => navigate(`/xisaab-xir/${row.id}`)}
              rowClassName={(row) => (row.status === 'reopened' ? 'opacity-55' : undefined)}
              caption={tr("Closing history")}
              empty={
                <EmptyState
                  icon={<Calculator className="size-6" />}
                  title={tr("No closings in this period")}
                  description={tr("Close a day from Xisaab Xir and it appears here with what was expected and what was counted.")}
                  actions={<Link to="/xisaab-xir"><Button variant="primary">{tr("Go to Xisaab Xir")}</Button></Link>}
                />
              }
            />
            {(list.data?.count ?? 0) > 0 ? (
              <Pagination page={page} pageSize={25} total={list.data?.count ?? 0} onPageChange={setPage} label={tr("closings")} />
            ) : null}
          </>
        )}
      </Card>
    </>
  )
}
