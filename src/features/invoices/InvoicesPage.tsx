import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Clock, Plus, ReceiptText, TriangleAlert } from 'lucide-react'
import { listInvoices } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Button, Card, EmptyState, ErrorState, PageHeader, Segmented, Skeleton, StatCard, StatusBadge } from '@/components/ui/primitives'
import { DataTable, Pagination, type Column } from '@/components/ui/table'
import { DateRangeFilter, FilterBar, SearchInput } from '@/components/ui/filters'
import { formatBusinessDate, presetRange, type DatePreset } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import type { InvoiceRow } from '@/types/db'

export default function InvoicesPage() {
  const business = useBusiness()
  const { currency, can, businessDate } = useSession()
  const navigate = useNavigate()
  const [preset, setPreset] = useState<DatePreset>('this_month')
  const [range, setRange] = useState(() => presetRange('this_month', business.business_date, business.settings.week_starts_on))
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const list = useQuery({
    queryKey: queryKeys.invoiceList(business.business_id, { ...range, status, search, page }),
    queryFn: () => listInvoices(business.business_id, { ...range, status, search, page, pageSize: 25 }),
    placeholderData: (previous) => previous,
  })

  const rows = list.data?.rows ?? []
  const invoiced = rows.filter((row) => row.status !== 'cancelled').reduce((total, row) => total + money(row.total, currency.decimals), 0)
  const collected = rows.reduce((total, row) => total + money(row.amount_paid, currency.decimals), 0)
  const outstanding = rows
    .filter((row) => row.status === 'pending' || row.status === 'partially_paid')
    .reduce((total, row) => total + money(row.balance_due, currency.decimals), 0)
  const overdue = rows.filter((row) => row.due_date && row.due_date < businessDate && money(row.balance_due, currency.decimals) > 0)

  const columns: Column<InvoiceRow>[] = [
    { key: 'number', header: 'Invoice', priority: 1, mobile: 'title', cell: (row) => <span className="num font-semibold text-ink-900">{row.invoice_number}</span> },
    { key: 'customer', header: 'Customer', priority: 1, mobile: 'meta', cell: (row) => row.customer_display_name ?? 'Walk-in customer' },
    { key: 'issued', header: 'Issued', priority: 2, mobile: 'meta', cell: (row) => formatBusinessDate(row.issue_date) },
    {
      key: 'due',
      header: 'Due',
      priority: 3,
      mobile: 'hide',
      cell: (row) => {
        if (!row.due_date) return <span className="text-ink-400">—</span>
        const isOverdue = row.due_date < businessDate && money(row.balance_due, currency.decimals) > 0
        return <span className={isOverdue ? 'font-semibold text-expense-600' : ''}>{formatBusinessDate(row.due_date)}{isOverdue ? ' · overdue' : ''}</span>
      },
    },
    { key: 'total', header: 'Total', align: 'right', priority: 1, mobile: 'value', cell: (row) => <span className="num font-semibold text-ink-900">{formatMoney(money(row.total, currency.decimals), currency)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', priority: 3, mobile: 'hide', cell: (row) => <span className="num text-ink-600">{formatMoney(money(row.amount_paid, currency.decimals), currency)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', priority: 2, mobile: 'hide', cell: (row) => <span className="num font-semibold">{formatMoney(money(row.balance_due, currency.decimals), currency)}</span> },
    { key: 'status', header: 'Status', priority: 1, mobile: 'meta', cell: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Qaansheeg · Bills and receipts for members"
        actions={
          can('invoices.create') ? (
            <Link to="/invoices/new"><Button variant="primary" icon={<Plus className="size-4" />}>New invoice</Button></Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.isLoading && !list.data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[126px]" />)
        ) : (
          <>
            <StatCard label="Invoiced" value={formatMoney(invoiced, currency)} icon={<ReceiptText className="size-5" />} tone="brand" caption={`${rows.length} invoices in this period`} />
            <StatCard label="Collected" value={<span className="text-income-700">{formatMoney(collected, currency)}</span>} icon={<CircleCheck className="size-5" />} tone="income" caption="Payments linked to invoices" />
            <StatCard label="Outstanding" value={formatMoney(outstanding, currency)} icon={<Clock className="size-5" />} tone="pending" caption="Still to collect" />
            <StatCard
              label="Overdue"
              value={<span className={overdue.length ? 'text-expense-600' : ''}>{formatMoney(overdue.reduce((total, row) => total + money(row.balance_due, currency.decimals), 0), currency)}</span>}
              icon={<TriangleAlert className="size-5" />}
              tone="expense"
              caption={`${overdue.length} invoice${overdue.length === 1 ? '' : 's'} past the due date`}
            />
          </>
        )}
      </div>

      <FilterBar>
        <Segmented
          value={status}
          onChange={(value) => { setStatus(value); setPage(0) }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'partially_paid', label: 'Partial' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <DateRangeFilter
          value={range}
          preset={preset}
          businessToday={business.business_date}
          weekStartsOn={business.settings.week_starts_on}
          onChange={(next, nextPreset) => { setRange(next); setPreset(nextPreset); setPage(0) }}
        />
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(0) }} placeholder="Search invoice number or customer…" />
      </FilterBar>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message="Could not load invoices" onRetry={() => void list.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              keyOf={(row) => row.id}
              loading={list.isLoading && !list.data}
              onRowClick={(row) => navigate(`/invoices/${row.id}`)}
              rowClassName={(row) => (row.status === 'cancelled' ? 'opacity-60' : undefined)}
              caption="Invoices"
              empty={
                <EmptyState
                  icon={<ReceiptText className="size-6" />}
                  title="No invoices yet"
                  description="Create an invoice or receipt for a member. You can attach a payment you already recorded."
                  actions={can('invoices.create') ? <Link to="/invoices/new"><Button variant="primary">New invoice</Button></Link> : undefined}
                />
              }
            />
            {(list.data?.count ?? 0) > 0 ? (
              <Pagination page={page} pageSize={25} total={list.data?.count ?? 0} onPageChange={setPage} label="invoices" />
            ) : null}
          </>
        )}
      </Card>
    </>
  )
}
