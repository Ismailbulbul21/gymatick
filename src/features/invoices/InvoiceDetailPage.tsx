import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Ban, Link2, Printer, ReceiptText } from 'lucide-react'
import { cancelInvoice, getInvoice, linkIncomeToInvoice, listPaymentMethods, listTransactions, recordInvoicePayment } from '@/lib/api'
import { invalidateMoney, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Button, Card, CardHeader, Callout, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { Modal, ConfirmDialog } from '@/components/ui/overlay'
import { Field, MoneyInput, Select, Textarea, moneyError, moneyToParam } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { InvoiceDocument } from './InvoiceDocument'
import { formatBusinessDate } from '@/lib/dates'
import { formatMoney, money } from '@/lib/money'
import { newIdempotencyKey } from '@/lib/utils'

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const business = useBusiness()
  const { currency, can, businessDate } = useSession()
  const [payOpen, setPayOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [selectedIncome, setSelectedIncome] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [voidPayments, setVoidPayments] = useState(false)
  const [key, setKey] = useState(newIdempotencyKey)

  const query = useQuery({
    queryKey: queryKeys.invoice(invoiceId ?? ''),
    queryFn: () => getInvoice(invoiceId!),
    enabled: Boolean(invoiceId),
  })
  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
    enabled: payOpen,
  })
  const unlinked = useQuery({
    queryKey: [...queryKeys.transactions(business.business_id), 'unlinked'],
    queryFn: () =>
      listTransactions(business.business_id, {
        from: businessDate.slice(0, 8) + '01',
        to: businessDate,
        kinds: ['income'],
        pageSize: 50,
      }),
    enabled: linkOpen,
  })

  const payMutation = useMutation({
    mutationFn: () =>
      recordInvoicePayment({
        invoiceId: invoiceId!,
        amount: moneyToParam(amount, currency),
        paymentMethodId: methodId,
        idempotencyKey: key,
        businessDate: null,
      }),
    onSuccess: (result) => {
      invalidateMoney(business.business_id)
      setKey(newIdempotencyKey())
      setAmount('')
      setPayOpen(false)
      toast.success('Payment recorded', {
        description: `Balance due ${formatMoney(money(result.balance_due, currency.decimals), currency)}`,
      })
    },
    onError: (error) => toast.error(error),
  })

  const linkMutation = useMutation({
    mutationFn: () => linkIncomeToInvoice(invoiceId!, selectedIncome),
    onSuccess: () => {
      invalidateMoney(business.business_id)
      setLinkOpen(false)
      toast.success('Payment attached', { description: 'No new income was created — the existing payment is now on this invoice.' })
    },
    onError: (error) => toast.error(error),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelInvoice(invoiceId!, cancelReason.trim(), voidPayments),
    onSuccess: () => {
      invalidateMoney(business.business_id)
      setCancelOpen(false)
      toast.success('Invoice cancelled')
    },
    onError: (error) => toast.error(error),
  })

  if (query.isLoading) return <Skeleton className="h-[520px]" />
  if (query.isError || !query.data?.invoice) return <ErrorState message="Could not load this invoice" onRetry={() => void query.refetch()} />

  const { invoice, items, payments } = query.data
  const balance = money(invoice.balance_due, currency.decimals)

  return (
    <>
      <PageHeader
        title={<span className="num">{invoice.invoice_number}</span>}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            <span>
              {invoice.customer_display_name ?? 'Walk-in customer'} · issued {formatBusinessDate(invoice.issue_date)}
            </span>
          </span>
        }
        actions={
          <>
            <Link to="/invoices"><Button icon={<ArrowLeft className="size-4" />}>Invoices</Button></Link>
            <Link to={`/invoices/${invoice.id}/print`} target="_blank">
              <Button icon={<Printer className="size-4" />}>Print / PDF</Button>
            </Link>
            <Link to={`/invoices/${invoice.id}/print?format=receipt`} target="_blank">
              <Button icon={<ReceiptText className="size-4" />}>Receipt</Button>
            </Link>
            {can('invoices.record_payment') && balance > 0 && invoice.status !== 'cancelled' ? (
              <Button variant="primary" onClick={() => { setPayOpen(true); setAmount(String(balance / 10 ** currency.decimals)) }}>
                Record payment
              </Button>
            ) : null}
            {can('invoices.record_payment') && balance > 0 && invoice.status !== 'cancelled' ? (
              <Button icon={<Link2 className="size-4" />} onClick={() => setLinkOpen(true)}>Link existing income</Button>
            ) : null}
            {can('invoices.cancel') && invoice.status !== 'cancelled' ? (
              <Button variant="ghost" icon={<Ban className="size-4" />} onClick={() => setCancelOpen(true)}>Cancel invoice</Button>
            ) : null}
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <InvoiceDocument
            invoice={invoice}
            items={items}
            payments={payments}
            business={{ name: business.business_name }}
            currency={currency}
            footer={business.settings.invoice_footer}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Payments" description={`${payments.filter((p) => p.status === 'posted').length} recorded`} />
            <div className="flex flex-col gap-3 p-5 pt-4">
              {payments.length === 0 ? (
                <p className="text-sm text-ink-500">Nothing paid yet.</p>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className={`flex items-start justify-between gap-3 text-sm ${payment.status === 'voided' ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      <p className="num font-semibold text-ink-900">{payment.reference_label}</p>
                      <p className="text-xs text-ink-500">
                        {formatBusinessDate(payment.business_date)} · {payment.payment_method_name}
                        {payment.status === 'voided' ? ' · voided' : ''}
                      </p>
                    </div>
                    <span className={`num font-semibold ${payment.status === 'voided' ? 'text-ink-400 line-through' : 'text-income-700'}`}>
                      {formatMoney(money(payment.amount, currency.decimals), currency)}
                    </span>
                  </div>
                ))
              )}
              <div className="h-px bg-line" />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Balance due</span>
                <span className="num">{formatMoney(balance, currency)}</span>
              </div>
            </div>
          </Card>

          {invoice.status === 'cancelled' ? (
            <Callout tone="warning">
              This invoice was cancelled{invoice.cancel_reason ? `: “${invoice.cancel_reason}”` : ''}. It does not count as income.
            </Callout>
          ) : null}
        </div>
      </div>

      <Modal
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Record a payment"
        description={`Balance due ${formatMoney(balance, currency)}`}
        footer={
          <>
            <Button onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={payMutation.isPending}
              onClick={() => {
                if (moneyError(amount, currency) || !methodId) return toast.info('Enter the amount and payment method')
                payMutation.mutate()
              }}
            >
              Record payment
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Amount" error={amount ? moneyError(amount, currency) : undefined}>
            <MoneyInput currency={currency} value={amount} onChange={setAmount} />
          </Field>
          <Field label="Payment method">
            <Select value={methodId} onChange={(event) => setMethodId(event.target.value)}>
              <option value="">Choose…</option>
              {(methods.data ?? []).filter((method) => method.status === 'active').map((method) => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </Select>
          </Field>
          <Callout tone="info">This records income for the gym and updates the invoice status automatically.</Callout>
        </div>
      </Modal>

      <Modal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Attach a payment already recorded"
        description="Use this when the money was recorded as income before the invoice was created."
        footer={
          <>
            <Button onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={linkMutation.isPending}
              onClick={() => {
                if (!selectedIncome) return toast.info('Choose the payment to attach')
                linkMutation.mutate()
              }}
            >
              Attach payment
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Payment" hint="Only payments that are not already on an invoice">
            <Select value={selectedIncome} onChange={(event) => setSelectedIncome(event.target.value)}>
              <option value="">Choose a recorded payment…</option>
              {(unlinked.data?.rows ?? [])
                .filter((row) => !row.invoice_id && row.status === 'posted')
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.reference_label} · {formatBusinessDate(row.business_date, 'd MMM')} · {row.description} ·{' '}
                    {formatMoney(money(row.amount, currency.decimals), currency)}
                  </option>
                ))}
            </Select>
          </Field>
          <Callout tone="info">No new income is created — the invoice simply points to that payment.</Callout>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        destructive
        title="Cancel this invoice?"
        description="A cancelled invoice never counts as income."
        confirmLabel="Cancel invoice"
        cancelLabel="Keep invoice"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (cancelReason.trim().length < 5) return toast.info('Please give a reason', 'At least 5 characters.')
          cancelMutation.mutate()
        }}
        consequences={[
          money(invoice.amount_paid, currency.decimals) > 0
            ? 'This invoice has payments — they must be voided as part of cancelling.'
            : 'No payments are attached, so nothing else changes.',
          'The invoice stays in the history with your name and reason.',
        ]}
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason">
            <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="e.g. Member changed their mind before paying" />
          </Field>
          {money(invoice.amount_paid, currency.decimals) > 0 ? (
            <label className="flex items-start gap-3 rounded-xl border border-expense-100 bg-expense-50 p-3.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-expense-600" checked={voidPayments} onChange={(event) => setVoidPayments(event.target.checked)} />
              <span>
                <span className="font-semibold text-ink-900">Void the payments too</span>
                <span className="block text-xs text-ink-600">
                  {formatMoney(money(invoice.amount_paid, currency.decimals), currency)} will stop counting as income. Only owners can do this.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  )
}
