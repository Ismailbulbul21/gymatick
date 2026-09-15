import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CircleCheck, Printer, RotateCcw, TriangleAlert } from 'lucide-react'
import { getClosingDetail } from '@/lib/api'
import { queryKeys } from '@/lib/query-client'
import { useSession } from '@/app/providers/SessionProvider'
import { Avatar, Button, Callout, Card, CardHeader, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { formatBusinessDate, formatBusinessDateTime, formatBusinessTime } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { tr } from '@/i18n'

export default function ClosingDetailPage() {
  const { closingId } = useParams<{ closingId: string }>()
  const { currency, timezone } = useSession()

  const query = useQuery({
    queryKey: queryKeys.closing(closingId ?? ''),
    queryFn: () => getClosingDetail(closingId!),
    enabled: Boolean(closingId),
  })

  if (query.isLoading) {
    return (
      <>
        <PageHeader title={tr("Xisaab Xir")} subtitle={tr("Loading closing…")} />
        <Skeleton className="h-[420px]" />
      </>
    )
  }
  if (query.isError || !query.data) {
    return <ErrorState message={tr("Could not load this closing")} onRetry={() => void query.refetch()} />
  }

  const { closing, lines, transactions, corrections, recalculated, has_corrections: hasCorrections } = query.data
  const difference = money(closing.difference_total, currency.decimals)

  return (
    <>
      <PageHeader
        title={tr("Xisaab Xir · {0}", { 0: formatBusinessDate(closing.business_date, 'EEEE, d MMM yyyy') })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={closing.status === 'reopened' ? 'reopened' : closing.is_balanced ? 'balanced' : 'difference'} />
            {hasCorrections ? <StatusBadge status="corrected" /> : null}
            <span>
              {tr("Closed by")}{' '}{closing.closed_by_name ?? tr("a manager")} · {formatBusinessTime(closing.closed_at, timezone)} · {timezone}
            </span>
          </span>
        }
        actions={
          <>
            <Link to="/xisaab-xir/history"><Button icon={<ArrowLeft className="size-4" />}>{tr("History")}</Button></Link>
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>{tr("Print")}</Button>
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={tr("At closing time")} description={tr("Snapshot saved when the day was closed — it never changes")} />
            <div className="p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: tr("Opening"), value: money(closing.opening_total, currency.decimals), tone: '' },
                  { label: tr("Money received"), value: money(closing.money_in_total, currency.decimals), tone: 'income' },
                  { label: tr("Money used"), value: money(closing.money_out_total, currency.decimals), tone: 'expense' },
                  { label: tr("Expected"), value: money(closing.expected_total, currency.decimals), tone: '' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 p-3.5">
                    <span className="text-xs text-ink-500">{item.label}</span>
                    <span className={`num font-bold ${item.tone === 'income' ? 'text-income-700' : item.tone === 'expense' ? 'text-expense-600' : 'text-ink-900'}`}>
                      {item.tone === 'income' ? '+' : item.tone === 'expense' ? '−' : ''}
                      {formatMoney(item.value, currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${closing.is_balanced ? 'border-income-100 bg-income-50' : 'border-expense-100 bg-expense-50'}`}>
                {closing.is_balanced ? <CircleCheck className="size-5 text-income-600" /> : <TriangleAlert className="size-5 text-expense-600" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">
                    {tr("Counted")}{' '}{formatMoney(money(closing.actual_total, currency.decimals), currency)}{' '}{tr("· difference")}{' '}
                    {formatMoney(difference, currency, { sign: difference !== 0 })}
                  </p>
                  {!closing.is_balanced ? (
                    <p className="text-sm text-ink-600">
                      {closing.lines_with_difference}{' '}{tr("payment method")}{closing.lines_with_difference === 1 ? '' : tr("s")}{' '}{tr("did not match.")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border-t border-line">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Method', 'Opening', 'In', 'Out', 'Expected', 'Counted', 'Difference'].map((header, index) => (
                      <th key={header} className={`h-10 whitespace-nowrap bg-surface-2 px-4 text-xs font-semibold text-ink-500 ${index === 0 ? 'text-left' : 'text-right'}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const lineDifference = money(line.difference ?? 0, currency.decimals)
                    return (
                      <tr key={line.payment_method_id} className="border-t border-line">
                        <td className="px-4 py-3 font-semibold text-ink-900">{line.name}</td>
                        <td className="num px-4 text-right text-ink-600">{formatMoney(money(line.opening_amount, currency.decimals), currency)}</td>
                        <td className="num px-4 text-right text-income-700">+{formatMoney(money(line.money_in, currency.decimals), currency)}</td>
                        <td className="num px-4 text-right text-expense-600">−{formatMoney(money(line.money_out, currency.decimals), currency)}</td>
                        <td className="num px-4 text-right font-semibold text-ink-900">{formatMoney(money(line.expected_amount, currency.decimals), currency)}</td>
                        <td className="num px-4 text-right font-semibold text-ink-900">{formatMoney(money(line.actual_amount ?? 0, currency.decimals), currency)}</td>
                        <td className={`num px-4 text-right font-bold ${lineDifference === 0 ? 'text-income-700' : lineDifference < 0 ? 'text-expense-600' : 'text-pending-700'}`}>
                          {formatMoney(lineDifference, currency, { sign: lineDifference !== 0 })}
                          {lineDifference !== 0 ? <span className="ml-1 text-xs">{lineDifference < 0 ? tr("short") : tr("over")}</span> : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {closing.notes ? (
              <div className="border-t border-line p-5">
                <p className="text-[13px] font-semibold text-ink-900">{tr("Note from")}{' '}{closing.closed_by_name ?? tr("the person who closed")}</p>
                <p className="mt-1.5 text-ink-600">{closing.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title={tr("Transactions in this period")}
              description={tr("{0} entries between {1} and {2}", { 0: transactions.length, 1: formatBusinessDate(closing.period_start, 'd MMM'), 2: formatBusinessDate(closing.business_date, 'd MMM') })}
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Time', 'Reference', 'Description', 'Category', 'Method', 'Status', 'Amount'].map((header, index) => (
                      <th key={header} className={`h-10 whitespace-nowrap border-b border-line bg-surface-2 px-4 text-xs font-semibold text-ink-500 ${index === 6 ? 'text-right' : 'text-left'}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const incoming = ['income', 'transfer_in', 'owner_deposit'].includes(transaction.kind)
                    const voided = transaction.status === 'voided'
                    return (
                      <tr key={transaction.id} className={`border-b border-line last:border-b-0 ${voided ? 'opacity-60' : ''}`}>
                        <td className="num px-4 py-3 text-ink-600">{formatBusinessTime(transaction.occurred_at, timezone)}</td>
                        <td className="num px-4 text-xs font-semibold text-ink-600">{tr("TX-")}{String(transaction.reference_no).padStart(6, '0')}</td>
                        <td className="px-4 font-medium text-ink-900">{transaction.description}</td>
                        <td className="px-4 text-ink-600">{transaction.category ?? '—'}</td>
                        <td className="px-4 text-ink-600">{transaction.payment_method}</td>
                        <td className="px-4">{voided ? <StatusBadge status="voided" /> : <span className="text-xs text-ink-500">{tr("Posted")}</span>}</td>
                        <td className={`num px-4 text-right font-semibold ${voided ? 'text-ink-400 line-through' : incoming ? 'text-income-700' : 'text-expense-600'}`}>
                          {incoming ? '+' : '−'}
                          {formatMoney(money(transaction.amount, currency.decimals), currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {hasCorrections ? (
            <Card className="border-brand-100">
              <CardHeader
                title={<span className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600"><RotateCcw className="size-4" /></span>{' '}{tr("Changed after closing")}</span>}
              />
              <div className="flex flex-col gap-4 p-5 pt-4">
                {corrections.map((correction) => (
                  <div key={correction.id} className="flex items-start gap-2.5">
                    <Avatar name={correction.voided_by ?? 'User'} size="sm" />
                    <div className="min-w-0 text-sm">
                      <p className="text-ink-900">
                        <span className="font-semibold">{correction.voided_by ?? tr("Someone")}</span>{' '}{tr("voided")}{' '}
                        <span className="num font-semibold">{tr("TX-")}{String(correction.reference_no).padStart(6, '0')}</span> (
                        {formatMoney(money(correction.amount, currency.decimals), currency)})
                      </p>
                      <p className="text-xs text-ink-500">{formatBusinessDateTime(correction.voided_at, timezone)}</p>
                      <p className="mt-1 text-ink-600">“{correction.void_reason}”</p>
                    </div>
                  </div>
                ))}
                <div className="h-px bg-line" />
                <p className="text-[13px] font-semibold text-ink-900">{tr("Recalculated with the correction")}</p>
                {recalculated.map((line) => (
                  <div key={line.payment_method_id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-500">{line.name}</span>
                    <span className={`num font-semibold ${money(line.difference, currency.decimals) === 0 ? 'text-income-700' : 'text-expense-600'}`}>
                      {formatMoney(money(line.expected_amount, currency.decimals), currency)} ·{' '}
                      {formatMoney(money(line.difference, currency.decimals), currency, { sign: money(line.difference, currency.decimals) !== 0 })}
                    </span>
                  </div>
                ))}
                <Callout tone="info">
                  {tr("The snapshot on the left keeps what was known on the night. Reports always use the corrected ledger.")}
                </Callout>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={tr("Timeline")} />
            <div className="flex flex-col gap-4 p-5 pt-4">
              <TimelineItem
                title={tr("Closed")}
                detail={`${closing.closed_by_name ?? 'A manager'} · ${formatBusinessDateTime(closing.closed_at, timezone)}`}
              />
              {closing.reopened_at ? (
                <TimelineItem
                  title={tr("Reopened")}
                  detail={`${closing.reopened_by_name ?? 'The owner'} · ${formatBusinessDateTime(closing.reopened_at, timezone)}`}
                  note={closing.reopen_reason}
                />
              ) : null}
              {hasCorrections ? <TimelineItem title={tr("Corrected after closing")} detail={tr("{0} transaction(s) voided", { 0: corrections.length })} /> : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function TimelineItem({ title, detail, note }: { title: string; detail: string; note?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-ink-500">{detail}</p>
        {note ? <p className="mt-1 text-sm text-ink-600">“{note}”</p> : null}
      </div>
    </div>
  )
}
