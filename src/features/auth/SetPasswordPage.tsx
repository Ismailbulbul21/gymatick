import { useNavigate } from 'react-router'
import { KeyRound } from 'lucide-react'
import { useSession } from '@/app/providers/SessionProvider'
import { GymatickLogo } from '@/components/brand/Logo'
import { Button, Callout, Card } from '@/components/ui/primitives'
import { PasswordForm } from './PasswordForm'
import { tr } from '@/i18n'

/** Shown after signing in with a temporary password from the owner. */
export default function SetPasswordPage() {
  const navigate = useNavigate()
  const { context, refreshContext, signOut } = useSession()

  return (
    <div className="grid min-h-svh place-items-center bg-canvas p-6">
      <Card className="w-full max-w-[440px] p-8">
        <GymatickLogo onDark={false} />
        <h1 className="mt-6 text-2xl font-bold text-ink-900">{tr("Choose your own password")}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {context?.user.full_name ? tr('{0}, you are signed in with a temporary password. Set your own before you start recording money.', { 0: context.user.full_name }) : tr('You are signed in with a temporary password. Set your own before you start recording money.')}
        </p>
        <Callout tone="info" className="mt-5" icon={<KeyRound className="size-[18px] text-brand-600" />}>
          {tr("Nobody else should know this password — every entry you record is stored with your name.")}
        </Callout>
        <PasswordForm
          submitLabel={tr("Save password and continue")}
          onSaved={async () => {
            await refreshContext()
            navigate('/dashboard', { replace: true })
          }}
        />
        <Button variant="link" size="sm" className="mt-4 px-0" onClick={() => void signOut()}>
          {tr("Sign out instead")}
        </Button>
      </Card>
    </div>
  )
}
