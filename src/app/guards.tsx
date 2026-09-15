import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Lock, LoaderCircle } from 'lucide-react'
import { useSession } from './providers/SessionProvider'
import { Button, Card, EmptyState } from '@/components/ui/primitives'
import { GymatickMark } from '@/components/brand/Logo'

export function Splash({ message }: { message?: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <GymatickMark size={44} />
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {message ?? 'Loading GYMATICK…'}
        </div>
      </div>
    </div>
  )
}

/** Signed-in users only; anonymous visitors are sent to sign in and back again. */
export function RequireAuth() {
  const { status } = useSession()
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'signed_out') {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }
  return <Outlet />
}

/** Requires an active membership and finished setup. */
export function RequireBusiness() {
  const { context, contextError, membership, signOut } = useSession()

  if (!context && !contextError) return <Splash />

  // A failed background refresh keeps the gym already loaded on screen.
  if (contextError && !context) {
    return (
      <div className="grid min-h-svh place-items-center bg-canvas p-6">
        <Card className="max-w-md p-8">
          <EmptyState
            icon={<Lock className="size-6" />}
            title="Cannot load your gym"
            description="GYMATICK could not reach the server or your session has changed. Sign in again to continue."
            actions={<Button variant="primary" onClick={() => void signOut()}>Sign in again</Button>}
          />
        </Card>
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="grid min-h-svh place-items-center bg-canvas p-6">
        <Card className="max-w-md p-8">
          <EmptyState
            icon={<Lock className="size-6" />}
            title="This account has no gym yet"
            description="Your account is not linked to a gym, or it has been deactivated. Ask the gym owner to give you access."
            actions={<Button onClick={() => void signOut()}>Sign out</Button>}
          />
        </Card>
      </div>
    )
  }

  return (
    <SetupGate
      mustChangePassword={Boolean(context?.user.must_change_password)}
      onboardingCompleted={membership.onboarding_completed}
    />
  )
}

/** A temporary password is replaced, and a new gym is set up, before anyone touches money. */
function SetupGate({ mustChangePassword, onboardingCompleted }: { mustChangePassword: boolean; onboardingCompleted: boolean }) {
  const location = useLocation()
  if (mustChangePassword) return <Navigate to="/set-password" replace />
  if (!onboardingCompleted && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

export function Forbidden({ what = 'this page' }: { what?: string }) {
  return (
    <Card className="mx-auto max-w-xl">
      <EmptyState
        icon={<Lock className="size-6" />}
        title={`You don't have access to ${what}`}
        description="Your account can only use the parts of GYMATICK the owner has given you. Ask the owner if you need more access."
        actions={
          <Button variant="primary" onClick={() => window.history.back()}>
            Go back
          </Button>
        }
      />
    </Card>
  )
}

export function RequirePermission({ permission, what, children }: { permission: string; what?: string; children?: ReactNode }) {
  const { can } = useSession()
  if (!can(permission)) return <Forbidden what={what} />
  return <>{children ?? <Outlet />}</>
}
