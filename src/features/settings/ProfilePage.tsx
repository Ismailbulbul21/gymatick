import { useLanguage } from '@/app/providers/LanguageProvider'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, Mail } from 'lucide-react'
import { updateMyProfile } from '@/lib/api'
import { useSession } from '@/app/providers/SessionProvider'
import { useTheme, type ThemeChoice } from '@/app/providers/ThemeProvider'
import { PasswordForm } from '@/features/auth/PasswordForm'
import { Avatar, Button, Callout, Card, CardHeader, Segmented } from '@/components/ui/primitives'
import { Field, Input, Select } from '@/components/ui/form'
import { toast } from '@/components/ui/toast'
import { tr } from '@/i18n'

export default function ProfilePage() {
  const { context, membership, refreshContext } = useSession()
  const { choice, setChoice } = useTheme()
  const user = context?.user
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const { language, setLanguage } = useLanguage()
  const [passwordFormKey, setPasswordFormKey] = useState(0)

  const mutation = useMutation({
    mutationFn: () => updateMyProfile({ full_name: fullName.trim(), phone: phone.trim(), preferred_language: language }),
    onSuccess: async () => {
      await refreshContext()
      toast.success(tr("Profile saved"))
    },
    onError: (error) => toast.error(error),
  })

  const changeTheme = (next: ThemeChoice) => {
    setChoice(next)
    // Applied on this device straight away; saved to the account in the background.
    updateMyProfile({ theme_preference: next }).catch(() => undefined)
  }

  return (
    <>
      <Card>
        <CardHeader title={tr("My profile")} description={tr("Your name is stored with every record you create")} />
        <div className="flex flex-col gap-4 p-5 pt-4">
          <div className="flex items-center gap-3">
            <Avatar name={fullName || 'User'} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink-900">{user?.full_name}</p>
              <p className="flex items-center gap-1.5 truncate text-sm text-ink-500">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {user?.email}
              </p>
              <p className="truncate text-xs text-ink-500">
                {membership?.role === 'owner' ? tr("Admin") : (membership?.title ?? tr("Shaqaale"))} · {membership?.business_name}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("Full name")}>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
            </Field>
            <Field label={tr("Phone")} optional>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="+252 …" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr("Language")}>
              <Select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'so')}>
                <option value="en">{tr("English")}</option>
                <option value="so">{tr("Soomaali")}</option>
              </Select>
            </Field>
            <Field label={tr("Theme")}>
              <Segmented
                value={choice}
                onChange={changeTheme}
                options={[
                  { value: 'system', label: tr("System") },
                  { value: 'light', label: tr("Light") },
                  { value: 'dark', label: tr("Dark") },
                ]}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              loading={mutation.isPending}
              onClick={() => {
                if (!fullName.trim()) return toast.info(tr("Enter your name"))
                mutation.mutate()
              }}
            >
              {tr("Save profile")}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={tr("Password")} description={tr("At least 10 characters, with upper and lower case letters and a number")} />
        <div className="p-5 pt-4">
          <Callout tone="info" icon={<KeyRound className="size-[18px] text-brand-600" />}>
            {tr("Keep your password to yourself — every entry you record carries your name.")}
          </Callout>
          <div className="max-w-md">
            <PasswordForm
              key={passwordFormKey}
              submitLabel={tr("Change password")}
              onSaved={() => {
                setPasswordFormKey((current) => current + 1)
                toast.success(tr("Password changed"))
              }}
            />
          </div>
        </div>
      </Card>
    </>
  )
}
