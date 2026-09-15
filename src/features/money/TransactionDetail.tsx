import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Ban, ReceiptText, Undo2 } from 'lucide-react'
import { getTransaction, listPaymentMethods, recordRefund, voidTransaction } from '@/lib/api'
import { invalidateMoney, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Drawer, ConfirmDialog } from '@/components/ui/overlay'
import { Avatar, Button, Callout, Money, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { Field, MoneyInput, Select, Textarea, moneyError, moneyToParam } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate, formatBusinessDateTime } from '@/lib/dates'
import { money } from '@/lib/money'
import { newIdempotencyKey } from '@/lib/utils'
import { tr } from '@/i18n'

const KIND_LABEL: Record<string, string> = {
  income: 'Income',
  refund: 'Refund',
  expense: 'Expense',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  owner_deposit: 'Owner deposit',
  owner_withdrawal: 'Owner withdrawal',
}

export function TransactionDetail({ transactionId, onClose }: { transactionId: string | null; onClose: () => void }) {
  const business = useBusiness()
  const { currency, timezone, can } = useSession()
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const query = useQuery({
    queryKey: queryKeys.transaction(transactionId ?? ''),
    queryFn: () => getTransaction(transactionId!),
    enabled: Boolean(transactionId),
  })
  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
    enabled: refundOpen,
  })

  const row = query.data

  const voidMutation = useMutation({
    mutationFn: () => voidTransaction(transactionId!, voidReason.trim()),
    onSuccess: () => {
      invalidateMoney(business.business_id)
      toast.success(tr("Transaction voided"), { description: tr("It no longer counts in totals, but stays in the history.") })
      setVoidOpen(false)
      setVoidReason('')
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  const refundMutation = useMutation({
    mutationFn: () =>
      recordRefund({
        transactionId: transactionId!,
        amount: moneyToParam(refundAmount, currency),
        paymentMethodId: refundMethod,
        reason: refundReason.trim(),
        idempotencyKey,
      }),
    onSuccess: () => {
      invalidateMoney(business.business_id)
      toast.success(tr("Refund recorded"))
      setRefundOpen(false)
      setRefundAmount('')
      setRefundReason('')
      setIdempotencyKey(newIdempotencyKey())
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  const canVoid = row?.status === 'posted' && (can('transactions.void') || can('closings.correct'))
  const canRefund = row?.kind === 'income' && row.status === 'posted' && can('transactions.refund')

  return (
    <>
      <Drawer
        open={Boolean(transactionId)}
        onOpenChange={(open) => !open && onClose()}
        title={row ? row.description : tr("Transaction")}
        description={row ? `${tr(KIND_LABEL[row.kind] ?? row.kind)} · ${row.reference_label}` : undefined}
      >
        {query.isLoading || !row ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-xl bg-surface-2 p-4">
              <div>
                <p className="text-xs text-ink-500">{tr("Amount")}</p>
                <Money
                  value={money(row.amount, currency.decimals)}
                  currency={currency}
                  tone={['income', 'transfer_in', 'owner_deposit'].includes(row.kind) ? 'income' : 'expense'}
                  className="text-2xl"
                />
              </div>
              <StatusBadge status={row.status} />
            </div>

            <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
              <dt className="text-ink-500">{tr("Business date")}</dt>
              <dd className="font-medium text-ink-900">{formatBusinessDate(row.business_date)}</dd>
              <dt className="text-ink-500">{tr("Recorded at")}</dt>
              <dd className="text-ink-700">{formatBusinessDateTime(row.created_at, timezone)}</dd>
              {row.category_name ? (
                <>
                  <dt className="text-ink-500">{tr("Category")}</dt>
                  <dd className="text-ink-700">{row.category_name}</dd>
                </>
              ) : null}
              <dt className="text-ink-500">{tr("Payment method")}</dt>
              <dd className="text-ink-700">{row.payment_method_name}</dd>
              {row.customer_name ? (
                <>
                  <dt className="text-ink-500">{tr("Customer")}</dt>
                  <dd className="text-ink-700">{row.customer_name}</dd>
                </>
              ) : null}
              {row.vendor ? (
                <>
                  <dt className="text-ink-500">{tr("Paid to")}</dt>
                  <dd className="text-ink-700">{row.vendor}</dd>
                </>
              ) : null}
              {row.employee_name ? (
                <>
                  <dt className="text-ink-500">{tr("Employee")}</dt>
                  <dd className="text-ink-700">
                    {row.employee_name}
                    {row.salary_period ? ` · ${formatBusinessDate(row.salary_period, 'MMMM yyyy')}` : ''}
                  </dd>
                </>
              ) : null}
              {row.invoice_number ? (
                <>
                  <dt className="text-ink-500">{tr("Invoice")}</dt>
                  <dd>
                    <Link to={`/invoices/${row.invoice_id}`} className="font-semibold text-brand-600 hover:underline">
                      {row.invoice_number}
                    </Link>
                  </dd>
                </>
              ) : null}
              {row.notes ? (
                <>
                  <dt className="text-ink-500">{tr("Notes")}</dt>
                  <dd className="text-ink-700">{row.notes}</dd>
                </>
              ) : null}
            </dl>

            <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{tr("History")}</p>
              <div className="flex items-start gap-2.5 text-sm">
                <Avatar name={row.created_by_name ?? 'User'} size="sm" />
                <p className="text-ink-700">
                  {tr("Recorded by")}{' '}<span className="font-semibold">{row.created_by_name ?? tr("someone")}</span> ·{' '}
                  {formatBusinessDateTime(row.created_at, timezone)}
                  {row.is_backdated ? tr(" (recorded for an earlier day)") : ''}
                </p>
              </div>
              {row.voided_at ? (
                <div className="flex items-start gap-2.5 text-sm">
                  <Avatar name={row.voided_by_name ?? 'User'} size="sm" />
                  <p className="text-ink-700">
                    {tr("Voided by")}{' '}<span className="font-semibold">{row.voided_by_name}</span> ·{' '}
                    {formatBusinessDateTime(row.voided_at, timezone)}
                    <span className="block text-ink-500">“{row.void_reason}”</span>
                  </p>
                </div>
              ) : null}
            </div>

            {row.is_salary ? (
              <Callout tone="info">
                {tr("This expense belongs to a salary payment. Change it from")}{' '}<Link to="/salaries" className="font-semibold underline">{tr("Salaries")}</Link>.
              </Callout>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {canRefund ? (
                <Button icon={<Undo2 className="size-4" />} onClick={() => { setRefundOpen(true); setRefundMethod(row.payment_method_id) }}>
                  {tr("Refund")}
                </Button>
              ) : null}
              {row.kind === 'income' && !row.invoice_id && can('invoices.create') ? (
                <Link to={`/invoices/new?income=${row.id}`}>
                  <Button icon={<ReceiptText className="size-4" />}>{tr("Create invoice")}</Button>
                </Link>
              ) : null}
              {canVoid ? (
                <Button variant="danger" icon={<Ban className="size-4" />} onClick={() => setVoidOpen(true)}>
                  {tr("Void")}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        destructive
        title={tr("Void this transaction?")}
        description={tr("Use void only for entries recorded by mistake. To return money to a customer, record a refund instead.")}
        confirmLabel={tr("Void transaction")}
        loading={voidMutation.isPending}
        onConfirm={() => {
          if (voidReason.trim().length < 5) {
            toast.info(tr("Please give a reason"), tr("At least 5 characters, so the correction can be explained later."))
            return
          }
          voidMutation.mutate()
        }}
        consequences={[
          tr("It stops counting in income, expenses, balances and reports."),
          tr("The entry stays in the history with your name and reason."),
          row?.invoice_number ? tr("Invoice {0} will be updated.", { 0: row.invoice_number }) : tr("Nothing else changes."),
        ]}
      >
        <Field label={tr("Reason for voiding")} error={voidReason && voidReason.trim().length < 5 ? 'At least 5 characters.' : undefined}>
          <Textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder={tr("e.g. Entered twice — duplicate of TX-000123")} />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title={tr("Record a refund")}
        description={tr("Money returned to the customer today. The original payment stays in the records.")}
        confirmLabel={tr("Record refund")}
        loading={refundMutation.isPending}
        onConfirm={() => {
          if (moneyError(refundAmount, currency) || refundReason.trim().length < 5 || !refundMethod) {
            toast.info(tr("Check the refund details"), tr("Amount, payment method and a short reason are required."))
            return
          }
          refundMutation.mutate()
        }}
      >
        <div className="flex flex-col gap-4">
          {row ? (
            <Callout tone="info">
              {tr("Original payment:")}{' '}<strong>{row.description}</strong> ·{' '}
              <span className="num">{money(row.amount, currency.decimals) / 10 ** currency.decimals}</span>{' '}{tr("on")}{' '}
              {formatBusinessDate(row.business_date)}
            </Callout>
          ) : null}
          <Field label={tr("Refund amount")} error={refundAmount ? moneyError(refundAmount, currency) : undefined}>
            <MoneyInput currency={currency} value={refundAmount} onChange={setRefundAmount} />
          </Field>
          <Field label={tr("Refunded from")}>
            <Select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}>
              {(methods.data ?? []).filter((m) => m.status === 'active').map((method) => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={tr("Reason")}>
            <Textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder={tr("e.g. Member cancelled within 24 hours")} />
          </Field>
        </div>
      </ConfirmDialog>
    </>
  )
}
