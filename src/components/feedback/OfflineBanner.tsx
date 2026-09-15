import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { tr } from '@/i18n'

/** Money cannot be saved offline — say so instead of failing silently. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-pending-500 px-4 py-2 text-sm font-semibold text-ink-950">
      <WifiOff className="size-4" aria-hidden />
      {tr("You are offline. Nothing can be saved until the connection returns.")}
    </div>
  )
}
