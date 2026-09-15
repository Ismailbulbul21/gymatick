import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Banknote, Building2, Check, Landmark, LogOut, Plus, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import {
  listPaymentMethods, savePaymentMethod, setOpeningBalances, setPaymentMethodStatus, updateBusinessProfile,
} from '@/lib/api'
import { invalidateMoney, queryClient, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { GymatickLogo } from '@/components/brand/Logo'
import { Button, Callout, Card, EmptyState, Skeleton } from '@/components/ui/primitives'
import { Field, Input, MoneyInput, Select, Switch, moneyError, moneyToParam } from '@/components/ui/form'
import { ConfirmDialog } from '@/components/ui/overlay'
import { toast } from '@/components/ui/toast'
import { formatBusinessDate } from '@/lib/dates'
import { formatMoney, parseMoneyInput } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { PaymentMethod, PaymentMethodType } from '@/types/db'
import { tr } from '@/i18n'

const STEPS = ['Your gym', 'Where money is kept', 'Opening balances'] as const

const METHOD_ICONS: Record<PaymentMethodType, LucideIcon> = {
  cash: Banknote,
  mobile_money: Smartphone,
  bank: Landmark,
  other: Wallet,
}

/** First run for a new gym: profile, payment methods, and the money already on hand. */
export default function OnboardingPage() {
  const business = useBusiness()
  const { isOwner, signOut } = useSession()
  const [step, setStep] = useState(0)

  if (business.onboarding_completed) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-svh bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 lg:px-8">
        <GymatickLogo onDark={false} />
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <Button variant="ghost" size="sm" icon={<LogOut className="size-4" />} onClick={() => void signOut()}>
            {tr("Sign out")}
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
        {isOwner ? (
          <>
            <div>
              <p className="text-sm font-semibold text-brand-600">{tr("Welcome to GYMATICK")}</p>
              <h1 className="mt-1 text-2xl font-bold text-ink-900">{tr("Set up")}{' '}{business.business_name}</h1>
              <p className="mt-1 text-sm text-ink-500">{tr("Three short steps, then you can record the first payment.")}</p>
            </div>
            <Stepper step={step} />
            {step === 0 ? <GymStep onNext={() => setStep(1)} /> : null}
            {step === 1 ? <MethodsStep onBack={() => setStep(0)} onNext={() => setStep(2)} /> : null}
            {step === 2 ? <OpeningStep onBack={() => setStep(1)} /> : null}
          </>
        ) : (
          <Card className="p-8">
            <EmptyState
              icon={<Building2 className="size-6" />}
              title={tr("The owner is still setting up this gym")}
              description={tr("GYMATICK opens as soon as the owner enters the opening balances.")}
              actions={<Button onClick={() => window.location.reload()}>{tr("Check again")}</Button>}
            />
          </Card>
        )}
      </main>
    </div>
  )
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={tr("Setup progress")}>
      {STEPS.map((label, index) => (
        <li key={label} className="flex flex-1 items-center gap-2" aria-current={index === step ? 'step' : undefined}>
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
              index <= step ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500',
            )}
          >
            {index < step ? <Check className="size-4" aria-hidden /> : index + 1}
          </span>
          <span className={cn('hidden text-sm sm:inline', index === step ? 'font-semibold text-ink-900' : 'text-ink-500')}>{tr(label)}</span>
          {index < STEPS.length - 1 ? <span className="h-px min-w-4 flex-1 bg-line" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  )
}

function StepCard({ icon, title, description, children, footer }: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-6 pb-0">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
        <div>
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-500">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-6">{children}</div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-6 py-4">{footer}</div>
    </Card>
  )
}

function GymStep({ onNext }: { onNext: () => void }) {
  const business = useBusiness()
  const { refreshContext } = useSession()
  const [name, setName] = useState(business.business_name)
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')

  const mutation = useMutation({
    mutationFn: () => updateBusinessProfile(business.business_id, { name: name.trim(), phone: phone.trim(), city: city.trim() }),
    onSuccess: async () => {
      await refreshContext()
      onNext()
    },
    onError: (error) => toast.error(error),
  })

  return (
    <StepCard
      icon={<Building2 className="size-5" />}
      title={tr("Your gym")}
      description={tr("Shown on invoices and receipts.")}
      footer={
        <>
          <span />
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!name.trim()) return toast.info(tr("Enter the gym name"))
              mutation.mutate()
            }}
          >
            {tr("Continue")}
          </Button>
        </>
      }
    >
      <Field label={tr("Gym name")}>
        <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tr("Phone")} optional>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="+252 …" />
        </Field>
        <Field label={tr("City")} optional>
          <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder={tr("Mogadishu")} />
        </Field>
      </div>
      <Callout tone="info">
        {tr('Money is recorded in {0} ({1}) and each business day follows {2} time.', { 0: business.settings.currency_code, 1: business.settings.currency_symbol, 2: business.settings.timezone })}
      </Callout>
    </StepCard>
  )
}

function MethodsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const business = useBusiness()
  const [name, setName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('mobile_money')
  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods(business.business_id) })

  const statusMutation = useMutation({
    mutationFn: ({ method, active }: { method: PaymentMethod; active: boolean }) =>
      setPaymentMethodStatus(method.id, active ? 'active' : 'inactive'),
    onSuccess: refresh,
    onError: (error) => toast.error(error),
  })
  const addMutation = useMutation({
    mutationFn: () => savePaymentMethod(business.business_id, { name: name.trim(), type, account_label: '', include_in_closing: true }),
    onSuccess: async () => {
      await refresh()
      setName('')
    },
    onError: (error) => toast.error(error),
  })

  const list = methods.data ?? []
  const activeCount = list.filter((method) => method.status === 'active').length

  return (
    <StepCard
      icon={<Wallet className="size-5" />}
      title={tr("Where money is kept")}
      description={tr("Turn on every place the gym receives or holds money. Each one is counted separately in Xisaab Xir.")}
      footer={
        <>
          <Button onClick={onBack}>{tr("Back")}</Button>
          <Button variant="primary" disabled={!activeCount} onClick={onNext}>
            {tr("Continue")}
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-line rounded-xl border border-line">
        {methods.isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <li key={index} className="p-3">
                <Skeleton className="h-9" />
              </li>
            ))
          : list.map((method) => {
              const Icon = METHOD_ICONS[method.type]
              return (
                <li key={method.id} className="flex items-center gap-3 p-3">
                  <span className="grid size-9 place-items-center rounded-[10px] bg-ink-100 text-ink-600">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{method.name}</p>
                    <p className="text-xs capitalize text-ink-500">{method.type.replace('_', ' ')}</p>
                  </div>
                  <Switch
                    label={tr("Use {0}", { 0: method.name })}
                    checked={method.status === 'active'}
                    onChange={(checked) => statusMutation.mutate({ method, active: checked })}
                  />
                </li>
              )
            })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label={tr("Add another")} optional className="flex-1">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr("e.g. Premier Bank")} />
        </Field>
        <Field label={tr("Type")} className="sm:w-40">
          <Select value={type} onChange={(event) => setType(event.target.value as PaymentMethodType)}>
            <option value="mobile_money">{tr("Mobile money")}</option>
            <option value="bank">{tr("Bank")}</option>
            <option value="cash">{tr("Cash")}</option>
            <option value="other">{tr("Other")}</option>
          </Select>
        </Field>
        <Button icon={<Plus className="size-4" />} loading={addMutation.isPending} disabled={!name.trim()} onClick={() => addMutation.mutate()}>
          {tr("Add")}
        </Button>
      </div>
    </StepCard>
  )
}

function OpeningStep({ onBack }: { onBack: () => void }) {
  const business = useBusiness()
  const { currency, businessDate, refreshContext } = useSession()
  const navigate = useNavigate()
  const [goLiveDate, setGoLiveDate] = useState(businessDate)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
  })
  const active = (methods.data ?? []).filter((method) => method.status === 'active')
  const errors = Object.fromEntries(
    active.map((method) => [method.id, moneyError(amounts[method.id] || '0', currency, { allowZero: true })]),
  )
  const hasErrors = Object.values(errors).some(Boolean)
  const total = active.reduce(
    (sum, method) => sum + (parseMoneyInput(amounts[method.id] || '0', currency.decimals, { allowZero: true }).minor || 0),
    0,
  )

  const mutation = useMutation({
    mutationFn: () =>
      setOpeningBalances(
        business.business_id,
        goLiveDate,
        active.map((method) => ({ payment_method_id: method.id, amount: moneyToParam(amounts[method.id] || '0', currency) })),
      ),
    onSuccess: async () => {
      invalidateMoney(business.business_id)
      await refreshContext()
      toast.success(tr("GYMATICK is ready"))
      navigate('/dashboard', { replace: true })
    },
    onError: (error) => {
      setConfirmOpen(false)
      toast.error(error)
    },
  })

  return (
    <StepCard
      icon={<Banknote className="size-5" />}
      title={tr("Opening balances")}
      description={tr("Count the money the gym already has in each place. Xisaab Xir starts from these amounts.")}
      footer={
        <>
          <Button onClick={onBack}>{tr("Back")}</Button>
          <Button variant="primary" disabled={!active.length || hasErrors || !goLiveDate} onClick={() => setConfirmOpen(true)}>
            {tr("Finish setup")}
          </Button>
        </>
      }
    >
      <Field label={tr("Start date")} hint={tr("The first business day recorded in GYMATICK")}>
        <Input type="date" value={goLiveDate} max={businessDate} onChange={(event) => setGoLiveDate(event.target.value)} />
      </Field>
      <div className="flex flex-col gap-3">
        {active.map((method) => {
          const Icon = METHOD_ICONS[method.type]
          return (
            <div key={method.id} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
              <label htmlFor={`opening-${method.id}`} className="flex items-center gap-3 text-sm font-semibold text-ink-900">
                <span className="grid size-9 place-items-center rounded-[10px] bg-ink-100 text-ink-600">
                  <Icon className="size-4" aria-hidden />
                </span>
                {method.name}
              </label>
              <MoneyInput
                id={`opening-${method.id}`}
                currency={currency}
                value={amounts[method.id] ?? ''}
                placeholder="0.00"
                invalid={Boolean(errors[method.id])}
                onChange={(value) => setAmounts((current) => ({ ...current, [method.id]: value }))}
              />
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
        <span className="text-sm font-semibold text-ink-600">{tr("Total opening balance")}</span>
        <span className="num text-lg font-bold text-ink-900">{formatMoney(total, currency)}</span>
      </div>
      <Callout tone="warning">{tr("Opening balances are locked after the first entry or Xisaab Xir, so count carefully.")}</Callout>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={tr("Start GYMATICK with these balances?")}
        description={tr("{0} on hand at the start of {1}.", { 0: formatMoney(total, currency), 1: formatBusinessDate(goLiveDate) })}
        confirmLabel={tr("Finish setup")}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        consequences={[
          tr("Each payment method starts from the amount you entered."),
          tr("Money can be recorded from the start date onwards."),
          tr("These amounts cannot be changed after the first entry."),
        ]}
      />
    </StepCard>
  )
}
