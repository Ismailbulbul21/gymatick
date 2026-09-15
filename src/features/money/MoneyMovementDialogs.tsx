import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, HandCoins } from 'lucide-react'
import { listPaymentMethods, recordOwnerMovement, recordTransfer } from '@/lib/api'
import { invalidateMoney, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Modal } from '@/components/ui/overlay'
import { Button, Callout } from '@/components/ui/primitives'
import { Field, Input, MoneyInput, Select, Textarea, moneyError, moneyToParam } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { newIdempotencyKey } from '@/lib/utils'
import { formatMoney, parseMoneyInput } from '@/lib/money'

/** Moving money between cash, mobile money and the bank: the totals never change. */
export function TransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const business = useBusiness()
  const { currency, businessDate } = useSession()
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(businessDate)
  const [notes, setNotes] = useState('')
  const [key, setKey] = useState(newIdempotencyKey)

  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
    enabled: open,
  })
  const active = (methods.data ?? []).filter((method) => method.status === 'active')

  const mutation = useMutation({
    mutationFn: () =>
      recordTransfer({
        businessId: business.business_id,
        fromMethodId: fromId,
        toMethodId: toId,
        amount: moneyToParam(amount, currency),
        idempotencyKey: key,
        businessDate: date,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      invalidateMoney(business.business_id)
      toast.success('Transfer recorded', { description: 'Balances moved between methods; the gym total is unchanged.' })
      setAmount('')
      setNotes('')
      setKey(newIdempotencyKey())
      onOpenChange(false)
    },
    onError: (error) => toast.error(error),
  })

  const parsed = parseMoneyInput(amount, currency.decimals)
  const fromName = active.find((m) => m.id === fromId)?.name
  const toName = active.find((m) => m.id === toId)?.name

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Transfer between payment methods"
      description="For example, putting cash into the bank or moving EVC Plus money to the drawer."
      icon={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><ArrowLeftRight className="size-5" /></span>}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!fromId || !toId || fromId === toId) {
                toast.info('Choose two different payment methods')
                return
              }
              if (moneyError(amount, currency)) {
                toast.info('Enter a valid amount')
                return
              }
              mutation.mutate()
            }}
          >
            Record transfer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            <Select value={fromId} onChange={(event) => setFromId(event.target.value)}>
              <option value="">Choose…</option>
              {active.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </Select>
          </Field>
          <Field label="To" error={fromId && fromId === toId ? 'Choose two different methods.' : undefined}>
            <Select value={toId} onChange={(event) => setToId(event.target.value)} invalid={Boolean(fromId && fromId === toId)}>
              <option value="">Choose…</option>
              {active.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Amount" error={amount ? moneyError(amount, currency) : undefined}>
          <MoneyInput currency={currency} value={amount} onChange={setAmount} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Note" optional>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Cash deposited at the bank agent" />
        </Field>
        {parsed.ok && fromName && toName ? (
          <Callout tone="info">
            <span className="num font-semibold">{fromName} −{formatMoney(parsed.minor, currency)}</span> ·{' '}
            <span className="num font-semibold">{toName} +{formatMoney(parsed.minor, currency)}</span> · the gym total stays the same.
            This is not income or an expense.
          </Callout>
        ) : null}
      </div>
    </Modal>
  )
}

/** Owner putting money in or taking money out: changes the balance, not the profit. */
export function OwnerMovementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const business = useBusiness()
  const { currency, businessDate } = useSession()
  const [direction, setDirection] = useState<'deposit' | 'withdrawal'>('withdrawal')
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(businessDate)
  const [notes, setNotes] = useState('')
  const [key, setKey] = useState(newIdempotencyKey)

  const methods = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
    enabled: open,
  })
  const active = (methods.data ?? []).filter((method) => method.status === 'active')

  const mutation = useMutation({
    mutationFn: () =>
      recordOwnerMovement({
        businessId: business.business_id,
        direction,
        amount: moneyToParam(amount, currency),
        paymentMethodId: methodId,
        idempotencyKey: key,
        businessDate: date,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      invalidateMoney(business.business_id)
      toast.success(direction === 'deposit' ? 'Owner deposit recorded' : 'Owner withdrawal recorded')
      setAmount('')
      setNotes('')
      setKey(newIdempotencyKey())
      onOpenChange(false)
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Owner deposit or withdrawal"
      description="Money the owner puts into the gym or takes out of it."
      icon={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pending-50 text-pending-600"><HandCoins className="size-5" /></span>}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!methodId || moneyError(amount, currency) || notes.trim().length < 3) {
                toast.info('Fill in the amount, the method and a short note')
                return
              }
              mutation.mutate()
            }}
          >
            Record
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Type">
          <Select value={direction} onChange={(event) => setDirection(event.target.value as 'deposit' | 'withdrawal')}>
            <option value="withdrawal">Owner takes money out</option>
            <option value="deposit">Owner puts money in</option>
          </Select>
        </Field>
        <Field label="Payment method">
          <Select value={methodId} onChange={(event) => setMethodId(event.target.value)}>
            <option value="">Choose…</option>
            {active.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </Select>
        </Field>
        <Field label="Amount" error={amount ? moneyError(amount, currency) : undefined}>
          <MoneyInput currency={currency} value={amount} onChange={setAmount} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Note" hint="Required — this explains the movement in the records">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Owner took cash for personal use" />
        </Field>
        <Callout tone="warning">
          This is <strong>not</strong> income or an expense. It changes the gym balance only, so profit stays correct.
        </Callout>
      </div>
    </Modal>
  )
}
