import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lock, Plus, X } from 'lucide-react'
import { updateBusinessSettings } from '@/lib/api'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Forbidden } from '@/app/guards'
import { Button, Callout, Card, CardHeader } from '@/components/ui/primitives'
import { Field, Input, MoneyInput, Select, Textarea, minorToInput, moneyToParam } from '@/components/ui/form'
import { ConfirmDialog } from '@/components/ui/overlay'
import { toast } from '@/components/ui/toast'
import { money } from '@/lib/money'
import { tr } from '@/i18n'

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function PreferencesPage() {
  const business = useBusiness()
  const { can, currency, refreshContext } = useSession()
  const settings = business.settings
  const [timezone, setTimezone] = useState(settings.timezone)
  const [cutoff, setCutoff] = useState(settings.day_cutoff.slice(0, 5))
  const [weekStart, setWeekStart] = useState(String(settings.week_starts_on))
  const [threshold, setThreshold] = useState(() => minorToInput(money(settings.large_amount_threshold, currency.decimals), currency))
  const [editWindow, setEditWindow] = useState(String(settings.staff_edit_window_minutes))
  const [idleTimeout, setIdleTimeout] = useState(String(settings.idle_timeout_minutes))
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoice_prefix)
  const [invoiceFooter, setInvoiceFooter] = useState(settings.invoice_footer ?? '')
  const [dueDays, setDueDays] = useState(settings.invoice_default_due_days?.toString() ?? '')
  const [positions, setPositions] = useState<string[]>(settings.employee_positions ?? [])
  const [newPosition, setNewPosition] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      updateBusinessSettings(business.business_id, {
        timezone,
        day_cutoff: `${cutoff}:00`,
        week_starts_on: Number(weekStart),
        large_amount_threshold: moneyToParam(threshold, currency),
        staff_edit_window_minutes: Number(editWindow),
        idle_timeout_minutes: Number(idleTimeout),
        invoice_prefix: invoicePrefix.trim().toUpperCase(),
        invoice_footer: invoiceFooter.trim(),
        invoice_default_due_days: dueDays ? Number(dueDays) : null,
        employee_positions: positions,
      }),
    onSuccess: async () => {
      await refreshContext()
      setConfirmOpen(false)
      toast.success(tr("Preferences saved"))
    },
    onError: (error) => {
      toast.error(error)
      setConfirmOpen(false)
    },
  })

  if (!can('settings.manage')) return <Forbidden what={tr("financial preferences")} />

  const timeChanged = timezone !== settings.timezone || `${cutoff}:00` !== settings.day_cutoff

  const addPosition = () => {
    const name = newPosition.trim()
    if (!name) return
    if (positions.some((item) => item.toLowerCase() === name.toLowerCase())) {
      toast.info(tr("That position is already in the list"))
      return
    }
    setPositions((current) => [...current, name])
    setNewPosition('')
  }

  return (
    <>
      <Card>
        <CardHeader title={tr("Currency")} description={tr("The money everything is recorded in")} />
        <div className="flex flex-col gap-4 p-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={tr("Currency")}><Input value={`${settings.currency_code} (${settings.currency_symbol})`} disabled /></Field>
            <Field label={tr("Decimals")}><Input value={String(settings.currency_decimals)} disabled /></Field>
            <Field label={tr("Number format")}><Input value={settings.locale} disabled /></Field>
          </div>
          <Callout tone="warning" icon={<Lock className="size-[18px] text-pending-600" />}>
            {tr("Currency cannot change once money has been recorded — existing amounts would mean something different.")}
          </Callout>
        </div>
      </Card>

      <Card>
        <CardHeader title={tr("Business day")} description={tr("How GYMATICK decides which day money belongs to")} />
        <div className="grid gap-4 p-5 pt-4 sm:grid-cols-3">
          <Field label={tr("Timezone")} hint={tr("Used for every business date")}>
            <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder={tr("Africa/Mogadishu")} />
          </Field>
          <Field label={tr("Day ends at")} hint={tr("e.g. 03:00 for a gym open past midnight")}>
            <Input type="time" value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
          </Field>
          <Field label={tr("Week starts on")}>
            <Select value={weekStart} onChange={(event) => setWeekStart(event.target.value)}>
              {WEEK_DAYS.map((day, index) => <option key={day} value={index}>{tr(day)}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title={tr("Safety")} description={tr("Small rules that prevent expensive mistakes")} />
        <div className="grid gap-4 p-5 pt-4 sm:grid-cols-3">
          <Field label={tr("Confirm amounts above")} hint={tr("An extra confirmation for unusually large entries")}>
            <MoneyInput currency={currency} value={threshold} onChange={setThreshold} />
          </Field>
          <Field label={tr("Self-correction window")} hint={tr("Minutes a person can fix their own entry")}>
            <Input type="number" min={0} max={120} value={editWindow} onChange={(event) => setEditWindow(event.target.value)} />
          </Field>
          <Field label={tr("Sign out after inactivity")} hint={tr("Minutes — useful on shared front-desk computers")}>
            <Input type="number" min={5} max={480} value={idleTimeout} onChange={(event) => setIdleTimeout(event.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title={tr("Employee positions")} description={tr("The choices offered when adding or editing an employee")} />
        <div className="flex flex-col gap-4 p-5 pt-4">
          <ul className="flex flex-wrap gap-2" aria-label={tr("Employee positions")}>
            {positions.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm font-medium text-ink-900"
              >
                {name}
                <button
                  type="button"
                  aria-label={tr("Remove {0}", { 0: name })}
                  disabled={positions.length === 1}
                  className="grid size-6 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-40"
                  onClick={() => setPositions((current) => current.filter((item) => item !== name))}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              addPosition()
            }}
          >
            <Field label={tr("Add a position")} optional className="flex-1">
              <Input id="new-position" value={newPosition} maxLength={60} onChange={(event) => setNewPosition(event.target.value)} placeholder={tr("e.g. Ilaalada")} />
            </Field>
            <Button type="submit" icon={<Plus className="size-4" />} disabled={!newPosition.trim()}>{tr("Add")}</Button>
          </form>
          <p className="text-xs text-ink-500">{tr("Removing a position does not change employees who already have it. Save preferences to apply.")}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title={tr("Invoices & receipts")} description={tr("How invoice numbers and printed documents look")} />
        <div className="flex flex-col gap-4 p-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("Invoice prefix")} hint={tr("Next invoice will look like {0}-{1}-00001", { 0: invoicePrefix || 'INV', 1: new Date().getFullYear() })}>
              <Input value={invoicePrefix} onChange={(event) => setInvoicePrefix(event.target.value.toUpperCase())} maxLength={8} />
            </Field>
            <Field label={tr("Default due days")} optional hint={tr("Leave empty for payment on receipt")}>
              <Input type="number" min={0} max={365} value={dueDays} onChange={(event) => setDueDays(event.target.value)} />
            </Field>
          </div>
          <Field label={tr("Footer text")} optional>
            <Textarea value={invoiceFooter} onChange={(event) => setInvoiceFooter(event.target.value)} placeholder={tr("Thank you — mahadsanid!")} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" loading={mutation.isPending} onClick={() => (timeChanged ? setConfirmOpen(true) : mutation.mutate())}>
          {tr("Save preferences")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={tr("Change the business day settings?")}
        description={tr("This decides which day new money belongs to.")}
        confirmLabel={tr("Save changes")}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        consequences={[
          tr("Records already saved keep the business date they were given."),
          tr("New entries use the new timezone and day-end time."),
          tr("Closed days are not affected."),
        ]}
      />
    </>
  )
}
