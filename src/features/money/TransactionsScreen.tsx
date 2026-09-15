import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BadgeDollarSign, Download, Plus, ReceiptText, Tag, Wallet,
} from 'lucide-react'
import { getTransactionTotals, listCategories, listPaymentMethods, listTransactions, exportTransactions, logExport } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { useQuickActions } from '@/app/AppShell'
import { Badge, Button, Card, Dot, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge } from '@/components/ui/primitives'
import { DataTable, Pagination, type Column } from '@/components/ui/table'
import { ActiveFilters, DateRangeFilter, FilterBar, FilterSelect, SearchInput } from '@/components/ui/filters'
import { TransactionDetail } from './TransactionDetail'
import { formatBusinessDate, formatBusinessTime, presetRange, type DatePreset } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { categoryColor, downloadCsv, toCsv } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import type { TransactionKind, TransactionRow } from '@/types/db'

export type ScreenMode = 'income' | 'expense' | 'all'

const MODE: Record<ScreenMode, { title: string; subtitle: string; kinds?: TransactionKind[] }> = {
  income: { title: 'Income', subtitle: 'Lacagta Soo Gasha · All money received by the gym', kinds: ['income', 'refund'] },
  expense: { title: 'Expenses', subtitle: 'Lacagta Baxda · All money spent by the gym', kinds: ['expense'] },
  all: { title: 'Transactions', subtitle: 'Dhaqdhaqaaqa Lacagta · Every money movement, including transfers' },
}

export function TransactionsScreen({ mode, extraActions, summary }: {
  mode: ScreenMode
  extraActions?: React.ReactNode
  /** Shown between the page title and the filters. */
  summary?: React.ReactNode
}) {
  const business = useBusiness()
  const { currency, timezone, can } = useSession()
  const quick = useQuickActions()
  const config = MODE[mode]

  const [preset, setPreset] = useState<DatePreset>('this_month')
  const [range, setRange] = useState(() => presetRange('this_month', business.business_date, business.settings.week_starts_on))
  const [categoryId, setCategoryId] = useState('')
  const [methodId, setMethodId] = useState('')
  const [status, setStatus] = useState<'posted' | 'voided' | 'all'>('posted')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<string | null>(null)

  const filters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      kinds: config.kinds,
      categoryId: categoryId || null,
      paymentMethodId: methodId || null,
      status,
      search,
      page,
      pageSize,
    }),
    [range, config.kinds, categoryId, methodId, status, search, page, pageSize],
  )

  const list = useQuery({
    queryKey: queryKeys.transactionList(business.business_id, filters),
    queryFn: () => listTransactions(business.business_id, filters),
    placeholderData: (previous) => previous,
  })
  const totals = useQuery({
    queryKey: [...queryKeys.transactions(business.business_id), 'totals', filters],
    queryFn: () => getTransactionTotals(business.business_id, filters),
    placeholderData: (previous) => previous,
  })
  const categories = useQuery({
    queryKey: queryKeys.categories(business.business_id),
    queryFn: () => listCategories(business.business_id),
  })
  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
  })

  const categoryOptions = (categories.data ?? [])
    .filter((category) => (mode === 'all' ? true : category.kind === (mode === 'income' ? 'income' : 'expense')))
    .map((category) => ({ value: category.id, label: category.name }))

  const activeFilters = [
    categoryId ? { label: `Category: ${categoryOptions.find((c) => c.value === categoryId)?.label ?? ''}`, onRemove: () => setCategoryId('') } : null,
    methodId ? { label: `Method: ${methods.data?.find((m) => m.id === methodId)?.name ?? ''}`, onRemove: () => setMethodId('') } : null,
    status !== 'posted' ? { label: `Status: ${status}`, onRemove: () => setStatus('posted') } : null,
    search ? { label: `Search: ${search}`, onRemove: () => setSearch('') } : null,
  ].filter(Boolean) as { label: string; onRemove: () => void }[]

  const kindIcon = (row: TransactionRow) => {
    if (row.kind === 'transfer_in' || row.kind === 'transfer_out') return <ArrowLeftRight className="size-4" />
    if (row.is_salary) return <BadgeDollarSign className="size-4" />
    return ['income', 'owner_deposit'].includes(row.kind) ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />
  }

  const columns: Column<TransactionRow>[] = [
    {
      key: 'date',
      header: 'Date & time',
      priority: 1,
      mobile: 'meta',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink-900">{formatBusinessDate(row.business_date, 'd MMM')}</span>
          <span className="num text-xs text-ink-500">{formatBusinessTime(row.occurred_at, timezone)}</span>
        </div>
      ),
    },
    { key: 'ref', header: 'Reference', priority: 3, mobile: 'hide', cell: (row) => <span className="num text-xs font-semibold text-ink-600">{row.reference_label}</span> },
    {
      key: 'description',
      header: 'Description',
      priority: 1,
      mobile: 'title',
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-[9px] ${
              ['income', 'transfer_in', 'owner_deposit'].includes(row.kind) ? 'bg-income-50 text-income-600' : 'bg-expense-50 text-expense-600'
            }`}
          >
            {kindIcon(row)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{row.description}</p>
            <p className="truncate text-xs text-ink-500">
              {row.customer_name ?? row.vendor ?? row.employee_name ?? 'Walk-in'}
              {row.invoice_number ? ` · ${row.invoice_number}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      priority: 2,
      mobile: 'meta',
      cell: (row) =>
        row.category_name ? (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Dot color={categoryColor(row.category_color)} />
            {row.category_name}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    { key: 'method', header: 'Method', priority: 2, mobile: 'meta', cell: (row) => <span className="whitespace-nowrap">{row.payment_method_name}</span> },
    {
      key: 'by',
      header: 'Recorded by',
      priority: 3,
      mobile: 'hide',
      cell: (row) => <span className="whitespace-nowrap text-ink-600">{row.created_by_name?.split(' ')[0] ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      priority: 3,
      mobile: 'hide',
      cell: (row) => (row.status === 'voided' ? <StatusBadge status="voided" /> : <span className="text-xs text-ink-500">Posted</span>),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      priority: 1,
      mobile: 'value',
      cell: (row) => {
        const incoming = ['income', 'transfer_in', 'owner_deposit'].includes(row.kind)
        const amount = money(row.amount, currency.decimals)
        if (row.kind === 'transfer_in' || row.kind === 'transfer_out') {
          return <span className="num whitespace-nowrap font-semibold text-ink-600">{formatMoney(amount, currency)}</span>
        }
        return (
          <span
            className={`num whitespace-nowrap font-semibold ${row.status === 'voided' ? 'text-ink-400 line-through' : incoming ? 'text-income-700' : 'text-expense-600'}`}
          >
            {incoming ? '+' : '−'}
            {formatMoney(amount, currency)}
          </span>
        )
      },
    },
  ]

  const exportCsv = async () => {
    try {
      const rows = await exportTransactions(business.business_id, range.from, range.to, status !== 'posted')
      const csv = toCsv(rows as Record<string, unknown>[], [
        { key: 'business_date', label: 'Business date' },
        { key: 'reference', label: 'Reference' },
        { key: 'kind', label: 'Kind' },
        { key: 'status', label: 'Status' },
        { key: 'description', label: 'Description' },
        { key: 'category', label: 'Category' },
        { key: 'payment_method', label: 'Payment method' },
        { key: 'customer', label: 'Customer' },
        { key: 'vendor', label: 'Paid to' },
        { key: 'invoice_number', label: 'Invoice' },
        { key: 'direction', label: 'Direction' },
        { key: 'amount', label: 'Amount', numeric: true },
        { key: 'recorded_by', label: 'Recorded by' },
        { key: 'notes', label: 'Notes' },
      ])
      downloadCsv(`gymatick-${mode}-${range.from}_${range.to}.csv`, csv)
      await logExport(business.business_id, range.from, range.to, rows.length)
      toast.success(`${rows.length} transactions exported`)
    } catch (error) {
      toast.error(error)
    }
  }

  const totalsData = totals.data

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <>
            {extraActions}
            {can('reports.export') ? <Button icon={<Download className="size-4" />} onClick={exportCsv}>Export</Button> : null}
            {mode === 'income' && can('income.create') ? (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={quick.addIncome}>Add income</Button>
            ) : null}
            {mode === 'expense' && can('expenses.create') ? (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={quick.addExpense}>Add expense</Button>
            ) : null}
          </>
        }
      />
      {summary}

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
        <FilterSelect
          label="Category"
          value={categoryId}
          onChange={(value) => { setCategoryId(value); setPage(0) }}
          options={[{ value: '', label: 'All' }, ...categoryOptions]}
        />
        <FilterSelect
          label="Method"
          value={methodId}
          onChange={(value) => { setMethodId(value); setPage(0) }}
          options={[{ value: '', label: 'All' }, ...(methods.data ?? []).map((m) => ({ value: m.id, label: m.name }))]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(value) => { setStatus(value as typeof status); setPage(0) }}
          options={[
            { value: 'posted', label: 'Posted' },
            { value: 'voided', label: 'Voided' },
            { value: 'all', label: 'All' },
          ]}
        />
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(0) }} placeholder="Search description, TX number, customer…" />
      </FilterBar>

      <ActiveFilters
        items={activeFilters}
        onClear={() => {
          setCategoryId('')
          setMethodId('')
          setStatus('posted')
          setSearch('')
          setPage(0)
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {totals.isLoading && !totalsData ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[126px]" />)
        ) : (
          <>
            <StatCard
              label={mode === 'expense' ? 'Expenses in this period' : mode === 'income' ? 'Income in this period' : 'Money in'}
              icon={mode === 'expense' ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
              tone={mode === 'expense' ? 'expense' : 'income'}
              value={
                <span className={mode === 'expense' ? 'text-expense-600' : 'text-income-700'}>
                  {formatMoney(
                    money(
                      mode === 'expense'
                        ? totalsData?.expenses ?? 0
                        : mode === 'income'
                          ? (totalsData?.income ?? 0) - (totalsData?.refunds ?? 0)
                          : totalsData?.money_in ?? 0,
                      currency.decimals,
                    ),
                    currency,
                  )}
                </span>
              }
              caption={
                mode === 'income' && (totalsData?.refunds ?? 0) > 0
                  ? `after ${formatMoney(money(totalsData!.refunds, currency.decimals), currency)} refunds`
                  : `${range.from} → ${range.to}`
              }
            />
            <StatCard
              label={mode === 'all' ? 'Money out' : 'Entries'}
              icon={mode === 'all' ? <ArrowUpRight className="size-5" /> : <ReceiptText className="size-5" />}
              tone={mode === 'all' ? 'expense' : 'brand'}
              value={
                mode === 'all' ? (
                  <span className="text-expense-600">{formatMoney(money(totalsData?.money_out ?? 0, currency.decimals), currency)}</span>
                ) : (
                  <span className="num">{totalsData?.count ?? 0}</span>
                )
              }
              caption={
                mode === 'income'
                  ? `Average ${formatMoney(money(totalsData?.average ?? 0, currency.decimals), currency)}`
                  : mode === 'expense'
                    ? 'Posted entries in this period'
                    : 'Expenses, refunds and owner money'
              }
            />
            <StatCard
              label={mode === 'all' ? 'Net' : 'Top category'}
              icon={<Tag className="size-5" />}
              tone="neutral"
              value={
                mode === 'all' ? (
                  <span className={money(totalsData?.net ?? 0, currency.decimals) >= 0 ? 'text-income-700' : 'text-expense-600'}>
                    {formatMoney(money(totalsData?.net ?? 0, currency.decimals), currency, { sign: true })}
                  </span>
                ) : (
                  <span className="text-lg">{totalsData?.top_category?.name ?? '—'}</span>
                )
              }
              caption={
                mode === 'all'
                  ? 'Income − expenses'
                  : totalsData?.top_category
                    ? `${formatMoney(money(totalsData.top_category.amount, currency.decimals), currency)} · ${totalsData.top_category.share ?? 0}%`
                    : 'No category yet'
              }
            />
            <StatCard
              label={mode === 'expense' ? 'Salaries included' : 'By payment method'}
              icon={mode === 'expense' ? <BadgeDollarSign className="size-5" /> : <Wallet className="size-5" />}
              tone={mode === 'expense' ? 'pending' : 'brand'}
              value={
                mode === 'expense' ? (
                  <span>{formatMoney(money(totalsData?.salaries ?? 0, currency.decimals), currency)}</span>
                ) : (
                  <span className="text-lg">{totalsData?.by_method?.[0]?.name ?? '—'}</span>
                )
              }
              caption={
                mode === 'expense'
                  ? 'Counted once, inside expenses'
                  : totalsData?.by_method?.length
                    ? totalsData.by_method
                        .slice(0, 3)
                        .map((method) => `${method.name} ${formatMoney(money(method.amount, currency.decimals), currency)}`)
                        .join(' · ')
                    : 'Nothing recorded yet'
              }
            />
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message="Could not load transactions" onRetry={() => void list.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.rows ?? []}
              keyOf={(row) => row.id}
              loading={list.isLoading && !list.data}
              onRowClick={(row) => setSelected(row.id)}
              rowClassName={(row) => (row.status === 'voided' ? 'opacity-60' : undefined)}
              caption={`${config.title} for ${range.from} to ${range.to}`}
              empty={
                activeFilters.length ? (
                  <EmptyState
                    title="Nothing matches these filters"
                    description="Try a different date range or clear the filters."
                    actions={
                      <Button
                        onClick={() => {
                          setCategoryId('')
                          setMethodId('')
                          setStatus('posted')
                          setSearch('')
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={mode === 'expense' ? <ArrowUpRight className="size-6" /> : <ArrowDownLeft className="size-6" />}
                    title={mode === 'expense' ? 'No expenses recorded yet' : mode === 'income' ? 'No income recorded yet' : 'No transactions yet'}
                    description={
                      mode === 'expense'
                        ? 'Record bills, supplies and repairs as you pay them. Salaries are paid from Salaries.'
                        : mode === 'income'
                          ? 'Every payment the gym receives — memberships, registrations, training — goes here.'
                          : 'Money movements appear here as soon as they are recorded.'
                    }
                    actions={
                      mode === 'expense' && can('expenses.create') ? (
                        <Button variant="primary" icon={<Plus className="size-4" />} onClick={quick.addExpense}>Add expense</Button>
                      ) : mode === 'income' && can('income.create') ? (
                        <Button variant="primary" icon={<Plus className="size-4" />} onClick={quick.addIncome}>Add income</Button>
                      ) : undefined
                    }
                  />
                )
              }
            />
            {(list.data?.count ?? 0) > 0 ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={list.data?.count ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(0)
                }}
                label={mode === 'income' ? 'payments' : 'entries'}
              />
            ) : null}
          </>
        )}
      </Card>

      {status !== 'posted' ? (
        <Badge tone="neutral">Voided entries are shown for history. They never count in totals.</Badge>
      ) : null}

      <TransactionDetail transactionId={selected} onClose={() => setSelected(null)} />
    </>
  )
}
