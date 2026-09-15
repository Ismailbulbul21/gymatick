import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { GymatickLogo } from '@/components/brand/Logo'
import { Card } from '@/components/ui/primitives'
import { PasswordForm } from './PasswordForm'

/** Landing page for the emailed recovery link. */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else setInvalid(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setInvalid(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <div className="grid min-h-svh place-items-center bg-canvas p-6">
      <Card className="w-full max-w-[440px] p-8">
        <GymatickLogo onDark={false} />
        <h1 className="mt-6 text-2xl font-bold text-ink-900">Choose a new password</h1>
        {invalid && !ready ? (
          <p className="mt-2 text-sm text-expense-600">
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
        ) : (
          <PasswordForm
            submitLabel="Save new password"
            onSaved={() => navigate('/dashboard', { replace: true })}
            disabled={!ready}
          />
        )}
      </Card>
    </div>
  )
}
