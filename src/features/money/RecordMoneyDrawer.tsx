import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, Landmark, Plus, Smartphone } from 'lucide-react'
import { listCategories, listCustomers, listPaymentMethods, recordExpense, recordIncome, saveCustomer } from '@/lib/api'
import { queryKeys, invalidateMoney } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Drawer, ConfirmDialog } from '@/components/ui/overlay'
import { Button, Callout } from '@/components/ui/primitives'
import { ChipGroup, Combobox, Field, Input, MoneyInput, Textarea, moneyError, moneyToParam } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { newIdempotencyKey } from '@/lib/utils'
import { categoryColor } from '@/lib/utils'
import { formatBusinessDate, nextDay } from '@/lib/dates'
import { parseAppError } from '@/lib/errors'
import { parseMoneyInput } from '@/lib/money'
import type { Category, PaymentMethod } from '@/types/db'

const methodIcon = (method: PaymentMethod) =>
  method.type === 'cash' ? <Banknote className="size-4" /> : method.type === 'bank' ? <Landmark className="size-4" /> : <Smartphone className="size-4" />

export function RecordMoneyDrawer({ mode, open, onOpenChange, onRecorded }: {
  mode: 'income' | 'expense'
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecorded?: () => void
}) {
  const business = useBusiness()
  const { currency, businessDate } = useSession()
  const isIncome = mode === 'income'

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [date, setDate] = useState(businessDate)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [addAnother, setAddAnother] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [confirmLarge, setConfirmLarge] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const categories = useQuery({
    queryKey: queryKeys.categories(business.business_id),
    queryFn: () => listCategories(business.business_id),
    enabled: open,
  })
  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
    enabled: open,
  })
  const customers = useQuery({
    queryKey: queryKeys.customers(business.business_id),
    queryFn: () => listCustomers(business.business_id),
    enabled: open && isIncome,
  })
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(business.business_id),
    queryFn: async () => (await import('@/lib/api')).getDashboard(business.business_id),
    enabled: open,
  })

  const todayClosed = Boolean((dashboard.data as { closing_status?: { is_closed?: boolean } } | undefined)?.closing_status?.is_closed)
  const defaultDate = todayClosed ? nextDay(businessDate) : businessDate

  useEffect(() => {
    if (!open) return
    setDate(defaultDate)
  }, [open, defaultDate])

  const visibleCategories = useMemo(
    () => (categories.data ?? []).filter((c: Category) => c.kind === mode && c.status === 'active' && !c.is_system),
    [categories.data, mode],
  )
  const visibleMethods = useMemo(
    () => (methods.data ?? []).filter((m) => m.status === 'active'),
    [methods.data],
  )

  useEffect(() => {
    if (!methodId && visibleMethods.length) setMethodId(visibleMethods[0]!.id)
  }, [visibleMethods, methodId])

  const threshold = parseMoneyInput(String(business.settings.large_amount_threshold ?? '1000'), currency.decimals, { allowZero: true }).minor
  const parsedAmount = parseMoneyInput(amount, currency.decimals)
  const isLargeAmount = parsedAmount.ok && threshold > 0 && parsedAmount.minor >= threshold

  const reset = (keepContext: boolean) => {
    setAmount('')
    setDescription('')
    setNotes('')
    setShowNotes(false)
    setSubmitted(false)
    setFieldErrors({})
    setIdempotencyKey(newIdempotencyKey())
    if (!keepContext) {
      setCategoryId(null)
      setCustomerId(null)
      setVendor('')
      setDate(defaultDate)
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        businessId: business.business_id,
        amount: moneyToParam(amount, currency),
        categoryId: categoryId!,
        paymentMethodId: methodId!,
        idempotencyKey,
        businessDate: date,
        description: description.trim() || null,
        notes: notes.trim() || null,
      }
      return isIncome
        ? recordIncome({ ...payload, customerId })
        : recordExpense({ ...payload, vendor: vendor.trim() || null })
    },
    onSuccess: (row) => {
      invalidateMoney(business.business_id)
      toast.success(
        `${isIncome ? 'Income' : 'Expense'} of ${currency.symbol}${Number(row.amount).toFixed(currency.decimals)} recorded`,
        { description: `${row.reference_label ?? ''} · ${formatBusinessDate(row.business_date)}`.trim() },
      )
      onRecorded?.()
      if (addAnother) reset(true)
      else {
        reset(false)
        onOpenChange(false)
      }
    },
    onError: (error) => {
      const parsed = parseAppError(error)
      if (parsed.field) setFieldErrors({ [parsed.field]: parsed.message })
      toast.error(error)
    },
  })

  const validate = () => {
    const errors: Record<string, string> = {}
    const amountError = moneyError(amount, currency)
    if (amountError) errors.amount = amountError
    if (!categoryId) errors.category_id = 'Choose a category.'
    if (!methodId) errors.payment_method_id = 'Choose how the money was paid.'
    if (!date) errors.business_date = 'Choose a date.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = () => {
    setSubmitted(true)
    if (!validate()) return
    if (isLargeAmount && !confirmLarge) {
      setConfirmLarge(true)
      return
    }
    mutation.mutate()
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) reset(false)
          onOpenChange(next)
        }}
        title={isIncome ? 'Add income' : 'Add expense'}
        description={isIncome ? 'Lacagta Soo Gasha · money received' : 'Lacagta Baxda · money spent'}
        icon={
          <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${isIncome ? 'bg-income-50 text-income-600' : 'bg-expense-50 text-expense-600'}`}>
            {isIncome ? <ArrowDownLeft className="size-[18px]" /> : <ArrowUpRight className="size-[18px]" />}
          </span>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                className="size-[18px] rounded-[5px] accent-brand-600"
                checked={addAnother}
                onChange={(event) => setAddAnother(event.target.checked)}
              />
              Add another after saving
            </label>
            <div className="flex items-center gap-2">
              <Button onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
              <Button variant="primary" icon={<Check className="size-4" />} onClick={submit} loading={mutation.isPending}>
                {isIncome ? 'Save income' : 'Save expense'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Amount" error={submitted ? fieldErrors.amount : undefined}>
            <MoneyInput
              currency={currency}
              value={amount}
              onChange={setAmount}
              invalid={Boolean(submitted && fieldErrors.amount)}
              big
              autoFocus
            />
          </Field>

          <Field label="Category" error={submitted ? fieldErrors.category_id : undefined}>
            <ChipGroup
              options={visibleCategories.map((category) => ({
                value: category.id,
                label: category.name,
                color: categoryColor(category.color),
              }))}
              value={categoryId}
              onChange={setCategoryId}
            />
            {!isIncome ? (
              <p className="mt-1 text-xs text-ink-500">
                Salaries are paid from Salaries → Pay salary, so they are counted once.
              </p>
            ) : null}
          </Field>

          <Field label="Payment method" error={submitted ? fieldErrors.payment_method_id : undefined}>
            <ChipGroup
              options={visibleMethods.map((method) => ({ value: method.id, label: method.name, icon: methodIcon(method) }))}
              value={methodId}
              onChange={setMethodId}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Date"
              htmlFor="money-date"
              error={submitted ? fieldErrors.business_date : undefined}
              hint={todayClosed ? `Today is closed — this goes to ${formatBusinessDate(defaultDate)}` : `Business day · ${business.settings.timezone}`}
            >
              <Input id="money-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>

            {isIncome ? (
              <Field label="Customer" optional hint="Leave empty for a walk-in">
                <Combobox
                  items={(customers.data ?? []).map((customer) => ({
                    id: customer.id,
                    label: customer.full_name,
                    hint: customer.member_code ?? customer.phone ?? undefined,
                  }))}
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder="Search members…"
                  createLabel="Add customer"
                  onCreate={async (name) => {
                    try {
                      const created = await saveCustomer(business.business_id, { full_name: name })
                      await customers.refetch()
                      setCustomerId(created.id)
                      toast.success(`${created.full_name} added`)
                    } catch (error) {
                      toast.error(error)
                    }
                  }}
                />
              </Field>
            ) : (
              <Field label="Paid to" optional hint="Shop, supplier or person">
                <Input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="e.g. Power supplier" />
              </Field>
            )}
          </div>

          <Field label="Description" optional>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                visibleCategories.find((c) => c.id === categoryId)?.name ?? (isIncome ? 'Monthly membership' : 'Electricity bill')
              }
              maxLength={300}
            />
          </Field>

          {showNotes ? (
            <Field label="Notes" optional>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
            </Field>
          ) : (
            <Button variant="link" size="sm" icon={<Plus className="size-4" />} onClick={() => setShowNotes(true)} className="self-start px-0">
              Add a note
            </Button>
          )}

          {parsedAmount.ok && methodId ? (
            <Callout tone="info">
              Recorded as{' '}
              <strong className="num">
                {isIncome ? '+' : '−'}
                {currency.symbol}
                {amount}
              </strong>{' '}
              in {visibleMethods.find((m) => m.id === methodId)?.name} on {formatBusinessDate(date)}. It appears on the dashboard
              and in that day&apos;s Xisaab Xir.
            </Callout>
          ) : null}
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmLarge}
        onOpenChange={setConfirmLarge}
        title="Confirm this amount"
        description={`${currency.symbol}${amount} is larger than the usual amount for this gym.`}
        confirmLabel="Yes, record it"
        loading={mutation.isPending}
        onConfirm={() => {
          setConfirmLarge(false)
          mutation.mutate()
        }}
        consequences={[
          `It will be recorded as ${isIncome ? 'income' : 'an expense'} on ${formatBusinessDate(date)}.`,
          'You can void it later with a reason if it was a mistake.',
        ]}
      />
    </>
  )
}
