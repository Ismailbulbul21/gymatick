import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { updateBusinessProfile } from '@/lib/api'
import { useBusiness, useSession } from '@/app/providers/SessionProvider'
import { Forbidden } from '@/app/guards'
import { Button, Card, CardHeader } from '@/components/ui/primitives'
import { Field, Input, Textarea } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { tr } from '@/i18n'

export default function BusinessSettingsPage() {
  const business = useBusiness()
  const { can, refreshContext } = useSession()
  const [name, setName] = useState(business.business_name)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      updateBusinessProfile(business.business_id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
      }),
    onSuccess: async () => {
      await refreshContext()
      toast.success(tr("Business profile saved"))
    },
    onError: (error) => toast.error(error),
  })

  if (!can('settings.manage')) return <Forbidden what={tr("business settings")} />

  return (
    <Card>
      <CardHeader title={tr("Business profile")} description={tr("Shown on invoices and receipts")} />
      <div className="flex flex-col gap-4 p-5 pt-4">
        <Field label={tr("Gym name")}><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("Phone")} optional><Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="+252 …" /></Field>
          <Field label={tr("Email")} optional><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        </div>
        <Field label={tr("Address")} optional><Textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder={tr("Street, district")} /></Field>
        <Field label={tr("City")} optional><Input value={city} onChange={(event) => setCity(event.target.value)} placeholder={tr("Mogadishu")} /></Field>
        <div className="flex justify-end">
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>{tr("Save changes")}</Button>
        </div>
      </div>
    </Card>
  )
}
