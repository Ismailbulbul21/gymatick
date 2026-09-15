import { FEATURES } from '@/lib/features'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createInvoice, getTransaction, listCategories, listCustomers, listPaymentMethods, listTransactions, saveCustomer } from '@/lib/api'
import { invalidateMoney, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Button, Callout, Card, CardHeader, PageHeader } from '@/components/ui/primitives'
import { Combobox, Field, Input, MoneyInput, Select, Textarea, moneyError, moneyToParam } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate } from '@/lib/dates'
import { formatMoney, money, parseMoneyInput } from '@/lib/money'
import { invoiceTotals } from '@/lib/finance'
import { newIdempotencyKey } from '@/lib/utils'
import { tr } from '@/i18n'

interface LineDraft {
  id: string
  description: string
  quantity: string
  unitPrice: string
}

type PaymentMode = 'paid_now' | 'unpaid' | 'link_existing'

export default function InvoiceNewPage() {
  const business = useBusiness()
  const { currency, businessDate, can } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const linkedIncomeId = params.get('income')

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [billToName, setBillToName] = useState('')
  const [billToPhone, setBillToPhone] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [issueDate, setIssueDate] = useState(businessDate)
  const [dueDate, setDueDate] = useState('')
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ id: crypto.randomUUID(), description: '', quantity: '1', unitPrice: '' }])
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(linkedIncomeId ? 'link_existing' : 'paid_now')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(linkedIncomeId)
  const [key, setKey] = useState(newIdempotencyKey)

  const categories = useQuery({ queryKey: queryKeys.categories(business.business_id), queryFn: () => listCategories(business.business_id) })
  const methods = useQuery({ queryKey: queryKeys.paymentMethods(business.business_id), queryFn: () => listPaymentMethods(business.business_id) })
  const customers = useQuery({ queryKey: queryKeys.customers(business.business_id), queryFn: () => listCustomers(business.business_id), enabled: FEATURES.customers })
  const unlinkedIncome = useQuery({
    queryKey: [...queryKeys.transactions(business.business_id), 'unlinked-income'],
    queryFn: () =>
      listTransactions(business.business_id, {
        from: shift(businessDate, -30),
        to: businessDate,
        kinds: ['income'],
        pageSize: 50,
      }),
    enabled: paymentMode === 'link_existing',
  })
  const linkedIncome = useQuery({
    queryKey: queryKeys.transaction(selectedIncomeId ?? ''),
    queryFn: () => getTransaction(selectedIncomeId!),
    enabled: Boolean(selectedIncomeId),
  })

  const incomeCategories = useMemo(
    () => (categories.data ?? []).filter((category) => category.kind === 'income' && category.status === 'active'),
    [categories.data],
  )
  const activeMethods = useMemo(() => (methods.data ?? []).filter((method) => method.status === 'active'), [methods.data])

  useEffect(() => {
    if (!categoryId && incomeCategories.length) setCategoryId(incomeCategories[0]!.id)
  }, [incomeCategories, categoryId])
  useEffect(() => {
    if (!paymentMethodId && activeMethods.length) setPaymentMethodId(activeMethods[0]!.id)
  }, [activeMethods, paymentMethodId])

  // An invoice made from an existing payment copies its amount, customer and category.
  useEffect(() => {
    const income = linkedIncome.data
    if (!income || paymentMode !== 'link_existing') return
    setLines((current) =>
      current.length === 1 && !current[0]!.description && !current[0]!.unitPrice
        ? [{ id: current[0]!.id, description: income.description, quantity: '1', unitPrice: String(income.amount) }]
        : current,
    )
    if (income.category_id) setCategoryId(income.category_id)
    if (income.customer_id) setCustomerId(income.customer_id)
  }, [linkedIncome.data, paymentMode])

  const totals = invoiceTotals(
    lines.map((line) => ({
      quantity: parseMoneyInput(line.quantity || '0', 2, { allowZero: true }).minor,
      unitPrice: parseMoneyInput(line.unitPrice || '0', currency.decimals, { allowZero: true }).minor,
    })),
    parseMoneyInput(discount || '0', currency.decimals, { allowZero: true }).minor,
    paymentMode === 'link_existing' && linkedIncome.data
      ? money(linkedIncome.data.amount, currency.decimals)
      : paymentMode === 'paid_now'
        ? parseMoneyInput(paymentAmount || '0', currency.decimals, { allowZero: true }).minor
        : 0,
    currency.decimals,
  )

  useEffect(() => {
    if (paymentMode === 'paid_now' && !paymentAmount && totals.total > 0) {
      setPaymentAmount(String(totals.total / 10 ** currency.decimals))
    }
  }, [paymentMode, paymentAmount, totals.total, currency.decimals])

  const mutation = useMutation({
    mutationFn: () =>
      createInvoice({
        businessId: business.business_id,
        items: lines.map((line) => ({
          description: line.description.trim(),
          quantity: line.quantity || '1',
          unit_price: moneyToParam(line.unitPrice || '0', currency),
        })),
        incomeCategoryId: categoryId,
        idempotencyKey: key,
        customerId,
        billToName: customerId ? null : billToName.trim() || null,
        billToPhone: customerId ? null : billToPhone.trim() || null,
        issueDate,
        dueDate: dueDate || null,
        discountAmount: moneyToParam(discount || '0', currency),
        notes: notes.trim() || null,
        payment:
          paymentMode === 'paid_now'
            ? { amount: moneyToParam(paymentAmount, currency), payment_method_id: paymentMethodId, business_date: issueDate }
            : null,
        linkTransactionId: paymentMode === 'link_existing' ? selectedIncomeId : null,
      }),
    onSuccess: (result) => {
      invalidateMoney(business.business_id)
      setKey(newIdempotencyKey())
      toast.success(tr("Invoice {0} created", { 0: result.invoice_number }), {
        description:
          paymentMode === 'link_existing'
            ? tr("Linked to the payment you already recorded — no new income was created.")
            : paymentMode === 'paid_now'
              ? tr("Payment recorded as income.")
              : tr("Waiting for payment."),
      })
      navigate(`/invoices/${result.invoice_id}`)
    },
    onError: (error) => toast.error(error),
  })

  const submit = () => {
    if (!categoryId) return toast.info(tr("Choose an income category"))
    if (!lines.some((line) => line.description.trim() && line.unitPrice)) return toast.info(tr("Add at least one line with a description and price"))
    if (paymentMode === 'paid_now' && (moneyError(paymentAmount, currency) || !paymentMethodId)) {
      return toast.info(tr("Check the payment"), tr("Amount and payment method are required."))
    }
    if (paymentMode === 'link_existing' && !selectedIncomeId) return toast.info(tr("Choose the payment to attach"))
    mutation.mutate()
  }

  return (
    <>
      <PageHeader
        title={tr("New invoice")}
        subtitle={tr("Qaansheeg cusub · a bill or receipt for a member")}
        actions={<Link to="/invoices"><Button icon={<ArrowLeft className="size-4" />}>{tr("Back to invoices")}</Button></Link>}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={tr("Bill to")} description={FEATURES.customers ? tr("Leave empty for a walk-in customer") : tr("Printed on the invoice")} />
            <div className="flex flex-col gap-4 p-5 pt-4">
              {FEATURES.customers ? (
              <Field label={tr("Customer")} optional>
                <Combobox
                  items={(customers.data ?? []).map((customer) => ({
                    id: customer.id,
                    label: customer.full_name,
                    hint: customer.member_code ?? customer.phone ?? undefined,
                  }))}
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder={tr("Search members…")}
                  createLabel={tr("Add customer")}
                  onCreate={async (name) => {
                    try {
                      const created = await saveCustomer(business.business_id, { full_name: name })
                      await customers.refetch()
                      setCustomerId(created.id)
                    } catch (error) {
                      toast.error(error)
                    }
                  }}
                />
              </Field>
              ) : null}
              {!customerId ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={tr("Name on the invoice")} optional>
                    <Input value={billToName} onChange={(event) => setBillToName(event.target.value)} placeholder={FEATURES.customers ? tr("Walk-in customer") : tr("Name of the person paying")} />
                  </Field>
                  <Field label={tr("Phone")} optional>
                    <Input value={billToPhone} onChange={(event) => setBillToPhone(event.target.value)} inputMode="tel" />
                  </Field>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title={tr("Details")} />
            <div className="grid gap-4 p-5 pt-4 sm:grid-cols-3">
              <Field label={tr("Issue date")}><Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></Field>
              <Field label={tr("Due date")} optional>
                <Input type="date" value={dueDate} min={issueDate} onChange={(event) => setDueDate(event.target.value)} />
              </Field>
              <Field label={tr("Income category")} hint={tr("Used when the invoice is paid")}>
                <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  {incomeCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={tr("What is being charged")}
              action={
                <Button
                  size="sm"
                  icon={<Plus className="size-4" />}
                  onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), description: '', quantity: '1', unitPrice: '' }])}
                >
                  {tr("Add line")}
                </Button>
              }
            />
            <div className="flex flex-col gap-3 p-5 pt-4">
              {lines.map((line, index) => (
                <div key={line.id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_80px_130px_40px]">
                  <Field label={index === 0 ? tr("Description") : ''}>
                    <Input
                      value={line.description}
                      onChange={(event) =>
                        setLines((current) => current.map((item) => (item.id === line.id ? { ...item, description: event.target.value } : item)))
                      }
                      placeholder={tr("e.g. Annual membership")}
                    />
                  </Field>
                  <Field label={index === 0 ? tr("Qty") : ''}>
                    <Input
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) =>
                        setLines((current) => current.map((item) => (item.id === line.id ? { ...item, quantity: event.target.value } : item)))
                      }
                    />
                  </Field>
                  <Field label={index === 0 ? tr("Unit price") : ''}>
                    <MoneyInput
                      currency={currency}
                      value={line.unitPrice}
                      onChange={(value) =>
                        setLines((current) => current.map((item) => (item.id === line.id ? { ...item, unitPrice: value } : item)))
                      }
                    />
                  </Field>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={tr("Remove line")}
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tr("Discount")} optional>
                  <MoneyInput currency={currency} value={discount} onChange={setDiscount} />
                </Field>
                <Field label={tr("Notes on the invoice")} optional>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={tr("Payment")} description={tr("How this invoice is paid")} />
            <div className="flex flex-col gap-3 p-5 pt-4">
              {([
                { value: 'paid_now', label: tr("Paid now"), hint: tr("Records the money as income straight away") },
                { value: 'unpaid', label: tr("Not paid yet"), hint: tr("The invoice stays pending until payment") },
                { value: 'link_existing', label: tr("Already recorded"), hint: tr("Attach a payment you recorded earlier — no new income is created") },
              ] as const).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${
                    paymentMode === option.value ? 'border-brand-600 bg-brand-50' : 'border-line hover:bg-ink-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-mode"
                    className="mt-0.5 size-4 accent-brand-600"
                    checked={paymentMode === option.value}
                    onChange={() => setPaymentMode(option.value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{option.label}</span>
                    <span className="block text-xs text-ink-500">{option.hint}</span>
                  </span>
                </label>
              ))}

              {paymentMode === 'paid_now' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={tr("Amount received")} error={paymentAmount ? moneyError(paymentAmount, currency) : undefined}>
                    <MoneyInput currency={currency} value={paymentAmount} onChange={setPaymentAmount} />
                  </Field>
                  <Field label={tr("Payment method")}>
                    <Select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
                      {activeMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                    </Select>
                  </Field>
                </div>
              ) : null}

              {paymentMode === 'link_existing' ? (
                <div className="flex flex-col gap-3">
                  <Field label={tr("Payment to attach")} hint={tr("Only payments that are not already on an invoice")}>
                    <Select value={selectedIncomeId ?? ''} onChange={(event) => setSelectedIncomeId(event.target.value || null)}>
                      <option value="">{tr("Choose a recorded payment…")}</option>
                      {(unlinkedIncome.data?.rows ?? [])
                        .filter((row) => !row.invoice_id && row.status === 'posted')
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.reference_label} · {formatBusinessDate(row.business_date, 'd MMM')} · {row.description} ·{' '}
                            {formatMoney(money(row.amount, currency.decimals), currency)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Callout tone="info">
                    {tr("No new income will be recorded — this invoice points to the payment that is already in the ledger.")}
                  </Callout>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="sticky top-24">
          <CardHeader title={tr("Totals")} description={tr("What the customer sees")} />
          <div className="flex flex-col gap-2 p-5 pt-4 text-sm">
            <Row label={tr("Subtotal")} value={formatMoney(totals.subtotal, currency)} />
            {totals.discount > 0 ? <Row label={tr("Discount")} value={`−${formatMoney(totals.discount, currency)}`} /> : null}
            <div className="h-px bg-line" />
            <Row label={tr("Total")} value={formatMoney(totals.total, currency)} strong />
            <Row label={tr("Paid")} value={formatMoney(totals.paid, currency)} />
            <Row label={tr("Balance due")} value={formatMoney(totals.balance, currency)} strong />
            <Button variant="primary" size="lg" className="mt-4 w-full" loading={mutation.isPending} onClick={submit} disabled={!can('invoices.create')}>
              {tr("Create invoice")}
            </Button>
            <Link to="/invoices"><Button className="w-full">{tr("Cancel")}</Button></Link>
          </div>
        </Card>
      </div>
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-semibold text-ink-900' : 'text-ink-500'}>{label}</span>
      <span className={`num ${strong ? 'text-base font-bold text-ink-900' : 'font-semibold text-ink-700'}`}>{value}</span>
    </div>
  )
}

function shift(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}
