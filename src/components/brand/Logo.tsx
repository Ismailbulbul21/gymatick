/** Placeholder GYMATICK mark and wordmark.
 *  Replace with the official logo file in src/assets/brand/ before production. */
import { cn } from '@/lib/utils'

export function GymatickMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0', className)} role="img" aria-label="GYMATICK">
      <rect width="64" height="64" rx="16" fill="#0B1533" />
      <path d="M42.6 21.4A15 15 0 1 0 47 32" fill="none" stroke="#5F84FB" strokeWidth="7" strokeLinecap="round" />
      <path d="M34 32H47" fill="none" stroke="#F03B45" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

export function GymatickWordmark({ onDark = true, className }: { onDark?: boolean; className?: string }) {
  return (
    <span className={cn('text-[19px] font-extrabold leading-none tracking-tight', onDark ? 'text-white' : 'text-ink-900', className)}>
      GYM<span className="text-[#F03B45]">ATICK</span>
    </span>
  )
}

export function GymatickLogo({ size = 34, onDark = true, className }: { size?: number; onDark?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <GymatickMark size={size} />
      <GymatickWordmark onDark={onDark} />
    </span>
  )
}
