import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Banknote, Landmark, Plus, Smartphone } from 'lucide-react'
import { getDashboard, listPaymentMethods, savePaymentMethod, setPaymentMethodStatus } from '@/lib/api'
import { queryClient, queryKeys } from '@/lib/query-client'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Forbidden } from '@/app/guards'
import { Button, Callout, Card, CardHeader, Skeleton, StatusBadge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlay'
import { Field, Input, Select, Switch } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { formatMoney, money } from '@/lib/money'
import type { PaymentMethod } from '@/types/db'
import { tr } from '@/i18n'

const icons = {
  cash: <Banknote className="size-4" />,
  bank: <Landmark className="size-4" />,
  mobile_money: <Smartphone className="size-4" />,
  other: <Banknote className="size-4" />,
}

export default function PaymentMethodsPage() {
  const business = useBusiness()
  const { can, currency } = useSession()
  const [editing, setEditing] = useState<PaymentMethod | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const list = useQuery({
    queryKey: queryKeys.paymentMethods(business.business_id),
    queryFn: () => listPaymentMethods(business.business_id),
  })
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(business.business_id),
    queryFn: () => getDashboard(business.business_id),
    enabled: can('dashboard.financials'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) => setPaymentMethodStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      toast.success(tr("Payment method updated"))
    },
    onError: (error) => toast.error(error),
  })

  if (!can('settings.manage')) return <Forbidden what={tr("payment methods")} />

  const balanceOf = (methodId: string) =>
    dashboard.data?.balance?.by_method.find((method) => method.payment_method_id === methodId)?.balance ?? null

  return (
    <>
      <Card>
        <CardHeader
          title={tr("Payment methods")}
          description={tr("Where the gym's money is held — each one is counted separately in Xisaab Xir")}
          action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>{tr("Add method")}</Button>}
        />
        <div className="p-5 pt-4">
          <ul className="divide-y divide-line">
            {list.isLoading
              ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="my-2 h-10" />)
              : (list.data ?? []).map((method) => {
                  const balance = balanceOf(method.id)
                  return (
                    <li key={method.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="grid size-9 place-items-center rounded-[10px] bg-ink-100 text-ink-600">{icons[method.type]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-900">{method.name}</p>
                        <p className="text-xs text-ink-500">
                          {method.type.replace('_', ' ')}
                          {method.account_label ? ` · ${method.account_label}` : ''}
                        </p>
                      </div>
                      {balance !== null ? (
                        <span className="num text-sm font-semibold text-ink-900">{formatMoney(money(balance, currency.decimals), currency)}</span>
                      ) : null}
                      <StatusBadge status={method.status} />
                      <Switch
                        label={tr("{0} active", { 0: method.name })}
                        checked={method.status === 'active'}
                        onChange={(checked) => statusMutation.mutate({ id: method.id, status: checked ? 'active' : 'inactive' })}
                      />
                      <Button size="sm" onClick={() => setEditing(method)}>{tr("Edit")}</Button>
                    </li>
                  )
                })}
          </ul>
          <Callout tone="info" className="mt-4">
            {tr("A method holding money cannot be deactivated — move the money to another method first, so the balances stay correct.")}
          </Callout>
        </div>
      </Card>

      <MethodModal open={addOpen || Boolean(editing)} method={editing} onClose={() => { setAddOpen(false); setEditing(null) }} />
    </>
  )
}

function MethodModal({ open, method, onClose }: { open: boolean; method: PaymentMethod | null; onClose: () => void }) {
  const business = useBusiness()
  const [name, setName] = useState(method?.name ?? '')
  const [type, setType] = useState(method?.type ?? 'mobile_money')
  const [accountLabel, setAccountLabel] = useState(method?.account_label ?? '')
  const [includeInClosing, setIncludeInClosing] = useState(method?.include_in_closing ?? true)

  const mutation = useMutation({
    mutationFn: () =>
      savePaymentMethod(
        business.business_id,
        { name: name.trim(), type, account_label: accountLabel.trim(), include_in_closing: includeInClosing },
        method?.id,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      toast.success(method ? tr("Payment method updated") : tr("Payment method added"))
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={method ? tr("Edit payment method") : tr("Add payment method")}
      footer={
        <>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => {
              if (!name.trim()) return toast.info(tr("Enter a name"))
              mutation.mutate()
            }}
          >
            {tr("Save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={tr("Name")}><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr("e.g. EVC Plus")} autoFocus /></Field>
        <Field label={tr("Type")}>
          <Select value={type} onChange={(event) => setType(event.target.value as PaymentMethod['type'])} disabled={Boolean(method)}>
            <option value="cash">{tr("Cash")}</option>
            <option value="mobile_money">{tr("Mobile money")}</option>
            <option value="bank">{tr("Bank")}</option>
            <option value="other">{tr("Other")}</option>
          </Select>
        </Field>
        <Field label={tr("Account label")} optional hint={tr("Something to recognise the account — never a PIN or password")}>
          <Input value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder={tr("e.g. Merchant 612…")} />
        </Field>
        <label className="flex items-center justify-between rounded-xl border border-line p-3.5 text-sm">
          <span>
            <span className="block font-semibold text-ink-900">{tr("Count in Xisaab Xir")}</span>
            <span className="block text-xs text-ink-500">{tr("Ask for this balance when closing the day")}</span>
          </span>
          <Switch label={tr("Count in Xisaab Xir")} checked={includeInClosing} onChange={setIncludeInClosing} />
        </label>
      </div>
    </Modal>
  )
}
