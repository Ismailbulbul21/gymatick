import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GymatickLogo } from '@/components/brand/Logo'
import { Button, Callout, Card } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/form'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    // The same answer either way: never reveal whether an account exists.
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    setPending(false)
    setSent(true)
  }

  return (
    <div className="grid min-h-svh place-items-center bg-canvas p-6">
      <Card className="w-full max-w-[420px] p-8">
        <GymatickLogo onDark={false} />
        <h1 className="mt-6 text-2xl font-bold text-ink-900">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-500">We will email you a link to choose a new password.</p>

        {sent ? (
          <Callout tone="success" className="mt-6" icon={<MailCheck className="size-[18px] text-income-600" />}>
            If an account exists for that email, a reset link is on its way. The link works once and expires in an hour.
          </Callout>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm text-ink-500">
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to sign in</Link>
        </p>
      </Card>
    </div>
  )
}
