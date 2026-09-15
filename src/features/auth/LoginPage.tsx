import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/app/providers/SessionProvider'
import { GymatickLogo } from '@/components/brand/Logo'
import { Button, Callout, Card } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/form'
import { safeReturnTo } from '@/lib/utils'
import { tr } from '@/i18n'

export default function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const returnTo = safeReturnTo(params.get('returnTo')) ?? '/dashboard'
  const reason = params.get('reason')

  useEffect(() => {
    if (status === 'signed_in') navigate(returnTo, { replace: true })
  }, [status, navigate, returnTo])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (!signInError) {
      navigate(returnTo, { replace: true })
      return
    }
    const message = signInError.message.toLowerCase()
    if (message.includes('banned') || message.includes('disabled')) {
      setError('This account has been deactivated. Contact the gym owner.')
    } else if (signInError.status === 429 || message.includes('rate')) {
      setError('Too many attempts. Please wait a few minutes and try again.')
    } else if (message.includes('failed to fetch') || message.includes('network')) {
      setError('Cannot reach the server. Check your internet connection.')
    } else {
      setError('Email or password is incorrect.')
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-[520px] rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(61,99,242,0.35) 0%, rgba(11,21,51,0) 70%)' }}
        />
        <GymatickLogo size={40} />
        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <h1 className="max-w-md text-4xl font-bold leading-tight text-white">
              {tr("Every shilling in and out of your gym, in one place.")}
            </h1>
            <p className="mt-3 max-w-md text-white/60">
              {tr("Income, expenses, invoices, salaries and Xisaab Xir — with a record of who did what, and when.")}
            </p>
          </div>
          <ul className="flex flex-col gap-4 text-white/80">
            {[
              { icon: <Wallet className="size-[18px]" />, text: 'Know exactly how much money you should have right now' },
              { icon: <ShieldCheck className="size-[18px]" />, text: 'Close the day with Xisaab Xir and lock the numbers' },
              { icon: <TrendingUp className="size-[18px]" />, text: 'See where the money comes from and where it goes' },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/10 text-brand-300">{item.icon}</span>
                <span className="text-sm">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/40">{tr("Accounts are created by the gym owner. Access is checked on every request.")}</p>
      </div>

      {/* Sign-in form */}
      <div className="flex items-center justify-center bg-canvas p-6">
        <Card className="w-full max-w-[420px] p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="lg:hidden">
              <GymatickLogo onDark={false} />
            </div>
            <LanguageSwitch className="ml-auto" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-ink-900">{tr("Welcome back")}</h2>
          <p className="mt-1 text-sm text-ink-500">{tr("Sign in to manage GYMATICK's money.")}</p>

          {reason === 'session-expired' ? (
            <Callout tone="info" className="mt-5">{tr("Your session expired. Please sign in again.")}</Callout>
          ) : null}
          {error ? (
            <Callout tone="danger" className="mt-5" icon={<LockKeyhole className="size-[18px] text-expense-600" />}>
              {error}
            </Callout>
          ) : null}

          <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
            <Field label={tr("Email")} htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={tr("you@example.com")}
              />
            </Field>
            <Field label={tr("Password")} htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  aria-label={showPassword ? tr("Hide password") : tr("Show password")}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
                >
                  {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
            </Field>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:underline">
                {tr("Forgot password?")}
              </Link>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
              {tr("Sign in")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
