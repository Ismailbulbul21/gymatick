import { useEffect } from 'react'
import { useSession } from './providers/SessionProvider'
import { toast } from '@/components/ui/toast'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
const STORAGE_KEY = 'gymatick.last-activity'

/** Signs the person out after the gym's inactivity limit — front-desk computers are shared.
 *  Activity in any open GYMATICK tab keeps every tab signed in. */
export function useIdleSignOut(minutes: number): void {
  const { signOut } = useSession()

  useEffect(() => {
    if (!Number.isFinite(minutes) || minutes <= 0) return
    const limit = minutes * 60_000
    let last = Date.now()

    const markActive = () => {
      const now = Date.now()
      if (now - last < 10_000) return
      last = now
      try {
        localStorage.setItem(STORAGE_KEY, String(now))
      } catch {
        /* storage blocked: this tab still tracks its own activity */
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) last = Math.max(last, Number(event.newValue) || 0)
    }

    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, markActive, { passive: true })
    window.addEventListener('storage', onStorage)
    const timer = window.setInterval(() => {
      if (Date.now() - last < limit) return
      window.clearInterval(timer)
      toast.info('Signed out after inactivity')
      void signOut()
    }, 15_000)

    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, markActive)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(timer)
    }
  }, [minutes, signOut])
}
