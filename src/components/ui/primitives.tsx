import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Ban, CircleCheck, CircleDashed, Clock, Info, Loader2, RotateCcw, ShieldCheck, TriangleAlert, UserRound,
} from 'lucide-react'
import { cn, avatarColor, initials as toInitials } from '@/lib/utils'
import { formatMoney, type Currency, type Minor } from '@/lib/money'

/* Buttons ------------------------------------------------------------------ */
const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        secondary: 'border border-line-strong bg-surface text-ink-900 shadow-xs hover:bg-ink-50',
        ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        danger: 'bg-expense-600 text-white hover:bg-expense-700',
        success: 'bg-income-700 text-white hover:bg-income-600',
        link: 'text-brand-600 hover:text-brand-700 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-[15px] rounded-xl',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean
  icon?: ReactNode
}

export function Button({ className, variant, size, loading, icon, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ label, className, children, ...props }: ButtonProps & { label: string }) {
  return (
    <Button aria-label={label} title={label} size="icon" className={cn('shrink-0', className)} {...props}>
      {children}
    </Button>
  )
}

/* Surfaces ----------------------------------------------------------------- */
export const Card = ({ className, children, ...rest }: { className?: string; children: ReactNode } & Record<string, unknown>) => (
  <div className={cn('rounded-2xl border border-line bg-surface shadow-xs', className)} {...rest}>
    {children}
  </div>
)

export function CardHeader({ title, description, action, className }: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-ink-500">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/* Status -------------------------------------------------------------------- */
export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const badgeTones: Record<BadgeTone, string> = {
  success: 'bg-income-50 text-income-700',
  danger: 'bg-expense-50 text-expense-600',
  warning: 'bg-pending-50 text-pending-700',
  info: 'bg-brand-50 text-brand-600',
  neutral: 'bg-ink-100 text-ink-600',
}

export function Badge({ tone = 'neutral', icon, children, className }: {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold', badgeTones[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

const STATUS_MAP: Record<string, { tone: BadgeTone; icon: ReactNode; label?: string }> = {
  paid: { tone: 'success', icon: <CircleCheck className="size-3.5" /> },
  balanced: { tone: 'success', icon: <CircleCheck className="size-3.5" /> },
  active: { tone: 'success', icon: <CircleCheck className="size-3.5" /> },
  posted: { tone: 'success', icon: <CircleCheck className="size-3.5" /> },
  partially_paid: { tone: 'info', icon: <CircleDashed className="size-3.5" />, label: 'Partially paid' },
  partial: { tone: 'info', icon: <CircleDashed className="size-3.5" /> },
  corrected: { tone: 'info', icon: <Info className="size-3.5" /> },
  owner: { tone: 'info', icon: <ShieldCheck className="size-3.5" /> },
  pending: { tone: 'warning', icon: <Clock className="size-3.5" /> },
  unpaid: { tone: 'warning', icon: <Clock className="size-3.5" /> },
  open: { tone: 'info', icon: <Clock className="size-3.5" /> },
  difference: { tone: 'danger', icon: <TriangleAlert className="size-3.5" /> },
  overdue: { tone: 'danger', icon: <TriangleAlert className="size-3.5" /> },
  voided: { tone: 'neutral', icon: <Ban className="size-3.5" /> },
  cancelled: { tone: 'neutral', icon: <Ban className="size-3.5" /> },
  inactive: { tone: 'neutral', icon: <Ban className="size-3.5" /> },
  reopened: { tone: 'neutral', icon: <RotateCcw className="size-3.5" /> },
  staff: { tone: 'neutral', icon: <UserRound className="size-3.5" /> },
  overpaid: { tone: 'info', icon: <Info className="size-3.5" /> },
  none: { tone: 'neutral', icon: <CircleDashed className="size-3.5" />, label: 'No salary' },
}

export function StatusBadge({ status, suffix, className }: { status: string; suffix?: string; className?: string }) {
  const key = status.toLowerCase()
  const config: { tone: BadgeTone; icon: ReactNode; label?: string } = STATUS_MAP[key] ?? { tone: 'neutral', icon: <Info className="size-3.5" /> }
  const label = config.label ?? status.replace(/_/g, ' ')
  return (
    <Badge tone={config.tone} icon={config.icon} className={cn('capitalize', className)}>
      {label}
      {suffix ? <span className="num normal-case">{suffix}</span> : null}
    </Badge>
  )
}

/* Money -------------------------------------------------------------------- */
export function Money({ value, currency, tone, sign = false, className }: {
  value: Minor
  currency: Currency
  tone?: 'income' | 'expense' | 'neutral' | 'auto'
  sign?: boolean
  className?: string
}) {
  const resolved = tone === 'auto' ? (value >= 0 ? 'income' : 'expense') : tone
  return (
    <span
      className={cn(
        'num font-semibold',
        resolved === 'income' && 'text-income-700',
        resolved === 'expense' && 'text-expense-600',
        className,
      )}
    >
      {formatMoney(value, currency, { sign })}
    </span>
  )
}

/* Stat tile ---------------------------------------------------------------- */
export function StatCard({ label, value, icon, tone = 'brand', caption, delta, footer, className }: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'income' | 'expense' | 'pending' | 'neutral'
  caption?: ReactNode
  delta?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    income: 'bg-income-50 text-income-600',
    expense: 'bg-expense-50 text-expense-600',
    pending: 'bg-pending-50 text-pending-600',
    neutral: 'bg-ink-100 text-ink-600',
  }
  return (
    <Card className={cn('flex flex-col gap-2.5 p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-600">{label}</span>
        {icon ? <span className={cn('grid size-9 place-items-center rounded-[10px]', tones[tone])}>{icon}</span> : null}
      </div>
      <div className="text-[28px] font-bold leading-9 tracking-tight text-ink-900">{value}</div>
      {delta || caption ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          {delta}
          {caption}
        </div>
      ) : null}
      {footer}
    </Card>
  )
}

export function Delta({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value === null) return null
  const up = value >= 0
  const good = up === goodWhenUp
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        good ? 'bg-income-50 text-income-700' : 'bg-expense-50 text-expense-600',
      )}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

/* Feedback ------------------------------------------------------------------ */
export function Callout({ tone = 'info', icon, children, className }: {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  const tones = {
    info: 'bg-brand-50 border-brand-100 text-ink-800',
    success: 'bg-income-50 border-income-100 text-ink-800',
    warning: 'bg-pending-50 border-pending-100 text-ink-800',
    danger: 'bg-expense-50 border-expense-100 text-ink-800',
  }
  const icons = {
    info: <Info className="size-[18px] text-brand-600" />,
    success: <CircleCheck className="size-[18px] text-income-600" />,
    warning: <TriangleAlert className="size-[18px] text-pending-600" />,
    danger: <TriangleAlert className="size-[18px] text-expense-600" />,
  }
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', tones[tone], className)}>
      <span className="mt-0.5 shrink-0">{icon ?? icons[tone]}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function EmptyState({ icon, title, description, actions, className }: {
  icon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      {icon ? <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span> : null}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink-500">{description}</p> : null}
      {actions ? <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry, detail }: { message: string; onRetry?: () => void; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-expense-50 text-expense-600">
        <TriangleAlert className="size-6" />
      </span>
      <p className="text-sm font-semibold text-ink-900">{message}</p>
      {detail ? <p className="max-w-md text-xs text-ink-500">{detail}</p> : null}
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
    </div>
  )
}

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg bg-ink-100', className)} aria-hidden />
)

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-14 text-lg', xl: 'size-[72px] text-2xl' }
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full font-bold text-white', sizes[size], className)}
      style={{ backgroundColor: avatarColor(name) }}
      aria-hidden
    >
      {toInitials(name)}
    </span>
  )
}

export const Dot = ({ color, className }: { color: string; className?: string }) => (
  <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} aria-hidden />
)

export function Progress({ value, tone = 'brand', className }: { value: number; tone?: 'brand' | 'income'; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-ink-200', className)}>
      <span
        className={cn('block h-full rounded-full', tone === 'income' ? 'bg-income-600' : 'bg-brand-600')}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-[10px] bg-ink-100 p-0.5" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg font-semibold transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            option.value === value ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
