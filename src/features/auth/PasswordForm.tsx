import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button, Callout } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/form'
import { cn } from '@/lib/utils'

const RULES = [
  { label: 'At least 10 characters', test: (value: string) => value.length >= 10 },
  { label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value: string) => /\d/.test(value) },
]

export function PasswordForm({ submitLabel, onSaved, disabled }: {
  submitLabel: string
  onSaved: () => void
  disabled?: boolean
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passed = RULES.map((rule) => rule.test(password))
  const strong = passed.every(Boolean)
  const matches = password.length > 0 && password === confirm

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!strong || !matches) return
    setPending(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onSaved()
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Field label="New password" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          disabled={disabled}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <ul className="flex flex-col gap-1.5">
        {RULES.map((rule, index) => (
          <li key={rule.label} className={cn('flex items-center gap-2 text-xs', passed[index] ? 'text-income-700' : 'text-ink-500')}>
            {passed[index] ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
            {rule.label}
          </li>
        ))}
      </ul>
      <Field
        label="Repeat password"
        htmlFor="confirm"
        error={confirm && !matches ? 'The two passwords do not match.' : undefined}
      >
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          disabled={disabled}
          onChange={(event) => setConfirm(event.target.value)}
          invalid={Boolean(confirm) && !matches}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} disabled={disabled || !strong || !matches}>
        {submitLabel}
      </Button>
    </form>
  )
}
