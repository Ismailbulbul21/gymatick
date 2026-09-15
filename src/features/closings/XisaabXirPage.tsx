import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Banknote, CalendarCheck, CalendarDays, CircleCheck, Copy, History, Landmark, Lock, RotateCcw, ShieldCheck,
  Smartphone, TriangleAlert, Wallet,
} from 'lucide-react'
import { getClosingPreview, performClosing, reopenClosing } from '@/lib/api'
import { invalidateMoney, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import {
  Avatar, Button, Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge,
} from '@/components/ui/primitives'
import { Field, MoneyInput, Textarea, moneyToParam } from '@/components/ui/form'
import { ConfirmDialog } from '@/components/ui/overlay'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate, formatBusinessTime } from '@/lib/dates'
import { formatMoney, minorToDecimalString, money, parseMoneyInput, type Minor } from '@/lib/money'
import { closingOutcome } from '@/lib/finance'
import { newIdempotencyKey } from '@/lib/utils'

const methodIcon = (type: string) =>
  type === 'cash' ? <Banknote className="size-4" /> : type === 'bank' ? <Landmark className="size-4" /> : <Smartphone className="size-4" />

export default function XisaabXirPage() {
  const business = useBusiness()
  const { currency, timezone, can, context } = useSession()
  const navigate = useNavigate()
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const userName = context?.user.full_name ?? 'you'

  const preview = useQuery({
    queryKey: queryKeys.closingPreview(business.business_id),
    queryFn: () => getClosingPreview(business.business_id),
  })

  const data = preview.data
  const lines = useMemo(() => data?.lines ?? [], [data])

  // Methods with no money and no activity start at zero so nobody has to type it.
  useEffect(() => {
    if (!lines.length) return
    setCounted((current) => {
      const next = { ...current }
      for (const line of lines) {
        if (next[line.payment_method_id] !== undefined) continue
        const opening = money(line.opening_amount, currency.decimals)
        const inAmount = money(line.money_in, currency.decimals)
        const outAmount = money(line.money_out, currency.decimals)
        if (opening === 0 && inAmount === 0 && outAmount === 0) next[line.payment_method_id] = minorToDecimalString(0, currency.decimals)
      }
      return next
    })
  }, [lines, currency.decimals])

  const closeMutation = useMutation({
    mutationFn: () =>
      performClosing({
        businessId: business.business_id,
        businessDate: data!.business_date,
        actuals: lines.map((line) => ({
          payment_method_id: line.payment_method_id,
          actual_amount: moneyToParam(counted[line.payment_method_id] ?? '0', currency),
        })),
        idempotencyKey,
        notes: notes.trim() || null,
        previewToken: data?.preview_token ?? null,
      }),
    onSuccess: (result) => {
      invalidateMoney(business.business_id)
      setConfirmOpen(false)
      setIdempotencyKey(newIdempotencyKey())
      toast.success(`${formatBusinessDate(result.business_date)} is closed`, {
        description: result.is_balanced
          ? 'Counted money matches the records.'
          : `Difference ${formatMoney(money(result.difference_total, currency.decimals), currency, { sign: true })}`,
      })
    },
    onError: (error) => {
      const parsed = toast.error(error)
      if (parsed.code === 'CLOSING_STALE') void preview.refetch()
      setConfirmOpen(false)
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => reopenClosing(data!.closing_id!, reopenReason.trim()),
    onSuccess: () => {
      invalidateMoney(business.business_id)
      setReopenOpen(false)
      setReopenReason('')
      toast.success('Day reopened', { description: 'You can record and correct entries for this day again.' })
    },
    onError: (error) => toast.error(error),
  })

  if (preview.isLoading) {
    return (
      <>
        <PageHeader title="Xisaab Xir" subtitle="Daily closing" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[240px]" />
        </div>
      </>
    )
  }

  if (preview.isError) {
    const message = (preview.error as { message?: string })?.message
    if (message === 'ONBOARDING_REQUIRED') {
      return (
        <Card className="p-6">
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="Set your opening balances first"
            description="GYMATICK needs to know how much money the gym holds before it can close a day."
            actions={<Button variant="primary" onClick={() => navigate('/onboarding')}>Set opening balances</Button>}
          />
        </Card>
      )
    }
    return <ErrorState message="Could not load Xisaab Xir" onRetry={() => void preview.refetch()} />
  }

  /* Already closed -------------------------------------------------------- */
  if (data?.status === 'closed') {
    const difference = money(data.difference_total ?? 0, currency.decimals)
    return (
      <>
        <PageHeader
          title="Xisaab Xir"
          subtitle={`Daily closing · ${formatBusinessDate(data.business_date, 'EEEE, d MMMM yyyy')}`}
          actions={<Link to="/xisaab-xir/history"><Button icon={<History className="size-4" />}>History</Button></Link>}
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="p-8">
            <div className="flex items-start gap-5">
              <span className="grid size-16 shrink-0 place-items-center rounded-[20px] bg-brand-600 text-white shadow-lg">
                <Lock className="size-7" />
              </span>
              <div>
                <h2 className="text-2xl font-bold text-ink-900">{formatBusinessDate(data.business_date, 'd MMM')} is closed</h2>
                <p className="mt-1 text-ink-500">
                  Closed at {formatBusinessTime(data.closed_at ?? null, timezone)} · {business.settings.timezone}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={data.is_balanced ? 'balanced' : 'difference'} />
                  {!data.is_balanced ? (
                    <span className="num inline-flex h-6 items-center rounded-full border border-line-strong px-2.5 text-xs font-semibold text-ink-700">
                      {formatMoney(difference, currency, { sign: true })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Expected', value: money(data.expected_total ?? 0, currency.decimals), tone: '' },
                { label: 'Counted', value: money(data.actual_total ?? 0, currency.decimals), tone: '' },
                { label: 'Difference', value: difference, tone: difference === 0 ? 'income' : 'expense' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex flex-col gap-1 rounded-xl border p-4 ${
                    item.tone === 'expense' ? 'border-expense-100 bg-expense-50' : item.tone === 'income' ? 'border-income-100 bg-income-50' : 'border-line bg-surface-2'
                  }`}
                >
                  <span className="text-sm text-ink-500">{item.label}</span>
                  <span
                    className={`num text-[22px] font-bold ${
                      item.tone === 'expense' ? 'text-expense-600' : item.tone === 'income' ? 'text-income-700' : 'text-ink-900'
                    }`}
                  >
                    {formatMoney(item.value, currency, { sign: item.label === 'Difference' && item.value !== 0 })}
                  </span>
                </div>
              ))}
            </div>

            <Callout tone="info" className="mt-6">
              <strong className="num">Tomorrow opens with {formatMoney(money(data.actual_total ?? 0, currency.decimals), currency)}</strong> — the money you
              counted. Anything recorded from now on goes to <strong>{formatBusinessDate(data.next_open_date ?? data.business_date, 'd MMM')}</strong>.
            </Callout>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link to={`/xisaab-xir/${data.closing_id}`}>
                <Button variant="primary" icon={<CalendarCheck className="size-4" />}>View closing</Button>
              </Link>
              <Link to="/xisaab-xir/history"><Button icon={<History className="size-4" />}>All closings</Button></Link>
              <div className="flex-1" />
              {can('closings.reopen') ? (
                <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setReopenOpen(true)}>
                  Reopen day
                </Button>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="What happens now" />
            <div className="flex flex-col gap-3 p-5 pt-4 text-sm text-ink-600">
              <p className="flex gap-2.5"><Lock className="size-4 shrink-0 text-ink-500" /> Transactions dated this day are locked.</p>
              <p className="flex gap-2.5"><CalendarDays className="size-4 shrink-0 text-ink-500" /> New entries go to the next day.</p>
              <p className="flex gap-2.5"><Wallet className="size-4 shrink-0 text-ink-500" /> Tomorrow starts from the money you counted.</p>
              <p className="flex gap-2.5"><ShieldCheck className="size-4 shrink-0 text-ink-500" /> Only the owner can reopen the day, with a reason.</p>
            </div>
          </Card>
        </div>

        <ConfirmDialog
          open={reopenOpen}
          onOpenChange={setReopenOpen}
          destructive
          title="Reopen this day?"
          description="Only do this if something must be corrected for this day."
          confirmLabel="Reopen day"
          loading={reopenMutation.isPending}
          onConfirm={() => {
            if (reopenReason.trim().length < 5) {
              toast.info('Please give a reason', 'At least 5 characters.')
              return
            }
            reopenMutation.mutate()
          }}
          consequences={[
            'The closing is kept in the history, marked as reopened.',
            'The day becomes editable again and must be closed once more.',
            'Everyone with access can see who reopened it and why.',
          ]}
        >
          <Field label="Reason for reopening">
            <Textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="e.g. A cash payment was missed" />
          </Field>
        </ConfirmDialog>
      </>
    )
  }

  /* Open day: count and close ---------------------------------------------- */
  const opening = money(data?.opening_total ?? 0, currency.decimals)
  const moneyIn = money(data?.money_in_total ?? 0, currency.decimals)
  const moneyOut = money(data?.money_out_total ?? 0, currency.decimals)
  const expected = money(data?.expected_total ?? 0, currency.decimals)

  const countedLines = lines.map((line) => {
    const parsed = parseMoneyInput(counted[line.payment_method_id] ?? '', currency.decimals, { allowZero: true })
    return {
      line,
      entered: counted[line.payment_method_id] ?? '',
      valid: parsed.ok,
      actual: parsed.ok ? parsed.minor : 0,
      expectedAmount: money(line.expected_amount, currency.decimals),
    }
  })
  const allEntered = countedLines.every((item) => item.valid)
  const outcome = closingOutcome(countedLines.map((item) => ({ expected: item.expectedAmount, actual: item.actual })))
  const actualTotal = countedLines.reduce((total, item) => total + item.actual, 0)
  const needsNote = !outcome.balanced && notes.trim().length < 5
  const canClose = can('closings.perform') && allEntered && !needsNote

  const calcRow = (sign: string, label: string, detail: string, value: Minor, tone?: 'income' | 'expense', big = false) => (
    <div className="flex items-center gap-4 py-3">
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-lg text-base font-extrabold ${
          sign === '=' ? 'bg-brand-600 text-white' : sign === '+' ? 'bg-income-50 text-income-700' : sign === '−' ? 'bg-expense-50 text-expense-600' : 'bg-ink-100 text-ink-600'
        }`}
      >
        {sign}
      </span>
      <div className="min-w-0 flex-1">
        <p className={big ? 'font-bold text-ink-900' : 'font-semibold text-ink-900'}>{label}</p>
        <p className="text-xs text-ink-500">{detail}</p>
      </div>
      <span
        className={`num shrink-0 font-bold tracking-tight ${big ? 'text-[26px]' : 'text-lg'} ${
          tone === 'income' ? 'text-income-700' : tone === 'expense' ? 'text-expense-600' : 'text-ink-900'
        }`}
      >
        {formatMoney(value, currency)}
      </span>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Xisaab Xir"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>Daily closing · {formatBusinessDate(data?.business_date ?? business.business_date, 'EEEE, d MMMM yyyy')}</span>
            {data?.period_start && data.period_start !== data.business_date ? (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-pending-50 px-2.5 text-xs font-semibold text-pending-700">
                <CalendarDays className="size-3.5" /> Covers {formatBusinessDate(data.period_start, 'd MMM')} – {formatBusinessDate(data.business_date, 'd MMM')}
              </span>
            ) : null}
          </span>
        }
        actions={<Link to="/xisaab-xir/history"><Button icon={<History className="size-4" />}>History</Button></Link>}
      />

      {!can('closings.perform') ? (
        <Callout tone="info">
          You can see the figures, but only staff with Xisaab Xir access can close the day.
        </Callout>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Step 1 */}
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-3"><StepBadge step={1} /> Review the day</span>}
            description={`Everything recorded for this period, calculated by the system`}
            action={
              <Link to="/transactions" className="text-sm font-semibold text-brand-600">
                {data?.transaction_count ?? 0} transactions
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-2">
            {calcRow('', 'Opening balance', `Counted at the last Xisaab Xir · ${formatBusinessDate(data?.checkpoint_date ?? null, 'd MMM')}`, opening)}
            <div className="h-px bg-line" />
            {calcRow(
              '+',
              'Money received',
              `Income ${formatMoney(money(data?.income_total ?? 0, currency.decimals), currency)} · Owner deposits ${formatMoney(money(data?.owner_deposit_total ?? 0, currency.decimals), currency)}`,
              moneyIn,
              'income',
            )}
            <div className="h-px bg-line" />
            {calcRow(
              '−',
              'Money used',
              `Expenses ${formatMoney(money(data?.expense_total ?? 0, currency.decimals), currency)} (incl. salaries ${formatMoney(money(data?.salary_total ?? 0, currency.decimals), currency)}) · Refunds ${formatMoney(money(data?.refund_total ?? 0, currency.decimals), currency)} · Owner withdrawals ${formatMoney(money(data?.owner_withdrawal_total ?? 0, currency.decimals), currency)}`,
              moneyOut,
              'expense',
            )}
            <div className="my-1 h-0.5 rounded bg-ink-900/80" />
            {calcRow('=', 'Expected closing balance', 'Opening + received − used', expected, undefined, true)}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Before you close" />
            <ul className="flex flex-col gap-2.5 p-5 pt-4 text-sm text-ink-600">
              {['Count the cash drawer twice', 'Check EVC Plus, ZAAD and SAHAL balances in their apps', 'Check the bank balance', 'Record any expense still missing'].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="When you close" />
            <div className="flex flex-col gap-2.5 p-5 pt-4 text-sm text-ink-600">
              <p className="flex gap-2.5"><Lock className="size-4 shrink-0 text-ink-500" /> Transactions dated in this period are locked.</p>
              <p className="flex gap-2.5"><CalendarDays className="size-4 shrink-0 text-ink-500" /> New entries go to the next day.</p>
              <p className="flex gap-2.5"><Wallet className="size-4 shrink-0 text-ink-500" /> Tomorrow starts from the money you counted.</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Step 2 */}
      <Card className="overflow-hidden">
        <CardHeader
          title={<span className="flex items-center gap-3"><StepBadge step={2} /> Count the money</span>}
          description="Count the cash and check each mobile money and bank balance"
          action={
            data?.transfer_total && money(data.transfer_total, currency.decimals) > 0 ? (
              <span className="text-xs text-ink-500">
                In/Out include {formatMoney(money(data.transfer_total, currency.decimals), currency)} of transfers between methods
              </span>
            ) : undefined
          }
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Payment method', 'Opening', 'In', 'Out', 'Expected', 'Counted', 'Difference'].map((header, index) => (
                  <th
                    key={header}
                    className={`h-10 whitespace-nowrap border-b border-line bg-surface-2 px-4 text-xs font-semibold text-ink-500 ${index === 0 ? 'text-left' : 'text-right'}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {countedLines.map(({ line, entered, actual, expectedAmount, valid }) => {
                const difference = valid ? actual - expectedAmount : 0
                return (
                  <tr key={line.payment_method_id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5 font-semibold text-ink-900">
                        <span className="grid size-8 place-items-center rounded-lg bg-ink-100 text-ink-600">{methodIcon(line.type)}</span>
                        {line.name}
                      </span>
                    </td>
                    <td className="num px-4 text-right text-ink-600">{formatMoney(money(line.opening_amount, currency.decimals), currency)}</td>
                    <td className="num px-4 text-right text-income-700">+{formatMoney(money(line.money_in, currency.decimals), currency)}</td>
                    <td className="num px-4 text-right text-expense-600">−{formatMoney(money(line.money_out, currency.decimals), currency)}</td>
                    <td className="num px-4 text-right font-semibold text-ink-900">{formatMoney(expectedAmount, currency)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-[130px]">
                          <MoneyInput
                            currency={currency}
                            value={entered}
                            invalid={Boolean(entered) && !valid}
                            onChange={(value) => setCounted((current) => ({ ...current, [line.payment_method_id]: value }))}
                          />
                        </div>
                        <Button
                          size="icon"
                          aria-label={`Use expected amount for ${line.name}`}
                          title="Same as expected"
                          onClick={() =>
                            setCounted((current) => ({
                              ...current,
                              [line.payment_method_id]: minorToDecimalString(expectedAmount, currency.decimals),
                            }))
                          }
                        >
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 text-right">
                      {!valid ? (
                        <span className="text-xs text-ink-400">—</span>
                      ) : difference === 0 ? (
                        <span className="num inline-flex items-center gap-1.5 font-semibold text-income-700">
                          <CircleCheck className="size-4" /> {formatMoney(0, currency)}
                        </span>
                      ) : (
                        <span className={`num inline-flex items-center gap-1.5 font-bold ${difference < 0 ? 'text-expense-600' : 'text-pending-700'}`}>
                          <TriangleAlert className="size-4" />
                          {formatMoney(difference, currency, { sign: true })}
                          <span className="text-xs font-semibold">{difference < 0 ? 'short' : 'over'}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-surface-2">
                <td className="px-4 py-3 font-bold text-ink-900">Total</td>
                <td className="num px-4 text-right font-semibold text-ink-900">{formatMoney(opening, currency)}</td>
                <td />
                <td />
                <td className="num px-4 text-right font-bold text-ink-900">{formatMoney(expected, currency)}</td>
                <td className="num px-4 pr-[54px] text-right font-bold text-ink-900">{allEntered ? formatMoney(actualTotal, currency) : '—'}</td>
                <td className={`num px-4 text-right font-bold ${!allEntered ? 'text-ink-400' : outcome.difference === 0 ? 'text-income-700' : 'text-expense-600'}`}>
                  {allEntered ? formatMoney(outcome.difference, currency, { sign: outcome.difference !== 0 }) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Step 3 */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-3"><StepBadge step={3} /> Confirm and close</span>}
            description="A note is required when the counted money does not match"
          />
          <div className="flex flex-col gap-4 p-5 pt-4">
            {!allEntered ? (
              <Callout tone="info">
                <p className="font-bold text-ink-900">Waiting for the count</p>
                <p className="text-sm text-ink-600">
                  {countedLines.filter((item) => item.valid).length} of {countedLines.length} payment methods counted. The
                  difference shows once every one is entered.
                </p>
              </Callout>
            ) : (
            <Callout tone={outcome.balanced ? 'success' : 'danger'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`font-bold ${outcome.balanced ? 'text-income-700' : 'text-expense-600'}`}>
                    {outcome.balanced ? 'Balanced' : `Difference ${formatMoney(outcome.difference, currency, { sign: true })}`}
                  </p>
                  <p className="text-sm text-ink-600">
                    {outcome.balanced
                      ? 'The counted money matches the records.'
                      : `${outcome.linesWithDifference} payment method${outcome.linesWithDifference > 1 ? 's do' : ' does'} not match. Explain it before closing.`}
                  </p>
                </div>
                <span className={`num text-[22px] font-bold ${outcome.balanced ? 'text-income-700' : 'text-expense-600'}`}>
                  {formatMoney(outcome.difference, currency, { sign: outcome.difference !== 0 })}
                </span>
              </div>
            </Callout>
            )}

            <Field
              label="Note about the difference"
              optional={!allEntered || outcome.balanced}
              error={needsNote && notes.length > 0 ? 'At least 5 characters.' : undefined}
              hint={outcome.balanced ? 'Optional — anything worth remembering about today' : undefined}
            >
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. Cash drawer short by 15. Counted twice; checking front-desk change tomorrow."
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-ink-500">
                <Avatar name={userName} size="sm" /> Closing as {userName}
              </span>
              <Button
                variant="primary"
                size="lg"
                icon={<Lock className="size-4" />}
                disabled={!canClose}
                onClick={() => setConfirmOpen(true)}
              >
                Xisaab Xir — Close {formatBusinessDate(data?.business_date ?? business.business_date, 'd MMM')}
              </Button>
            </div>
            {!allEntered ? (
              <p className="text-xs text-ink-500">Enter the counted amount for every payment method to close the day.</p>
            ) : needsNote ? (
              <p className="text-xs text-ink-500">Add a note explaining the difference to close the day.</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Last closing" description="The day this one continues from" />
          <div className="flex flex-col gap-2 p-5 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Counted on</span><span className="font-semibold">{formatBusinessDate(data?.checkpoint_date ?? null)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Opening balance now</span><span className="num font-semibold">{formatMoney(opening, currency)}</span></div>
            <Link to="/xisaab-xir/history" className="mt-2 text-sm font-semibold text-brand-600">See all closings →</Link>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Close ${formatBusinessDate(data?.business_date ?? business.business_date)}?`}
        description="Check the numbers one last time. Closing locks the day."
        icon={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Lock className="size-5" /></span>}
        confirmLabel="Close the day"
        cancelLabel="Go back"
        loading={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
        consequences={[
          `Transactions dated ${formatBusinessDate(data?.business_date ?? business.business_date, 'd MMM')} will be locked.`,
          'Anything recorded after this goes to the next day.',
          'Only the owner can reopen this day, with a reason.',
        ]}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Expected', value: expected },
            { label: 'Counted', value: actualTotal },
            { label: 'Difference', value: outcome.difference },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex flex-col gap-1 rounded-xl border p-3 ${
                item.label === 'Difference' && item.value !== 0 ? 'border-expense-100 bg-expense-50' : 'border-line bg-surface-2'
              }`}
            >
              <span className="text-xs text-ink-500">{item.label}</span>
              <span className={`num font-bold ${item.label === 'Difference' && item.value !== 0 ? 'text-expense-600' : 'text-ink-900'}`}>
                {formatMoney(item.value, currency, { sign: item.label === 'Difference' && item.value !== 0 })}
              </span>
            </div>
          ))}
        </div>
        {notes.trim() ? (
          <p className="rounded-xl border border-dashed border-line-strong p-3 text-sm text-ink-600">“{notes.trim()}”</p>
        ) : null}
      </ConfirmDialog>
    </>
  )
}

function StepBadge({ step }: { step: number }) {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-brand-50 text-[13px] font-extrabold text-brand-600">{step}</span>
  )
}

