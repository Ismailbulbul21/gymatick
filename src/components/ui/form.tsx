import { useId, useMemo, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, minorToDecimalString, parseMoneyInput, type Currency, type Minor } from '@/lib/money'
import { tr } from '@/i18n'

export function Field({ label, htmlFor, error, hint, optional, children, className }: {
  label: ReactNode
  htmlFor?: string
  error?: string
  hint?: ReactNode
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-900">
        {label}
        {optional ? <span className="ml-1 font-medium text-ink-500">{tr("(optional)")}</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-expense-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

const inputStyles = (invalid?: boolean) =>
  cn(
    'h-10 w-full rounded-[10px] border bg-surface px-3 text-sm text-ink-900 placeholder:text-ink-400',
    'focus:outline-none focus-visible:ring-3',
    invalid
      ? 'border-expense-500 focus-visible:border-expense-600 focus-visible:ring-expense-100'
      : 'border-line-strong focus-visible:border-brand-600 focus-visible:ring-brand-100',
  )

export function Input({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(inputStyles(invalid), className)} aria-invalid={invalid || undefined} {...props} />
}

export function Textarea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(inputStyles(invalid), 'h-auto min-h-[84px] py-2.5 leading-relaxed', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function Select({ invalid, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select className={cn(inputStyles(invalid), 'appearance-none pr-9', className)} aria-invalid={invalid || undefined} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
    </div>
  )
}

/** Large money field: validates as you type, sends exact decimal strings. */
export function MoneyInput({ currency, value, onChange, invalid, big, id, autoFocus, placeholder }: {
  currency: Currency
  value: string
  onChange: (raw: string) => void
  invalid?: boolean
  big?: boolean
  id?: string
  autoFocus?: boolean
  placeholder?: string
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 rounded-[10px] border bg-surface px-3',
        big ? 'h-14' : 'h-10',
        invalid
          ? 'border-expense-500 focus-within:ring-3 focus-within:ring-expense-100'
          : 'border-line-strong focus-within:border-brand-600 focus-within:ring-3 focus-within:ring-brand-100',
      )}
    >
      <span className={cn('font-semibold text-ink-500', big ? 'text-xl' : 'text-sm')}>{currency.symbol}</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder ?? (currency.decimals === 0 ? '0' : '0.00')}
        className={cn(
          'num w-full border-0 bg-transparent p-0 text-ink-900 placeholder:text-ink-400 focus:outline-none',
          big ? 'text-2xl font-bold tracking-tight' : 'text-sm font-semibold',
        )}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export const moneyError = (raw: string, currency: Currency, { allowZero = false } = {}): string | undefined => {
  const parsed = parseMoneyInput(raw, currency.decimals, { allowZero })
  if (parsed.ok) return undefined
  switch (parsed.error) {
    case 'empty':
      return tr('Enter an amount.')
    case 'not_positive':
      return tr('Enter an amount greater than 0.')
    case 'too_many_decimals':
      return currency.decimals === 0 ? tr('This currency does not use decimals.') : tr('Use at most {0} decimal places.', { 0: currency.decimals })
    case 'too_large':
      return tr('That amount is too large.')
    default:
      return tr('Enter a valid amount.')
  }
}

export const moneyToParam = (raw: string, currency: Currency): string =>
  minorToDecimalString(parseMoneyInput(raw, currency.decimals, { allowZero: true }).minor, currency.decimals)

export const minorToInput = (minor: Minor, currency: Currency): string =>
  formatMoney(minor, currency, { hideSymbol: true }).replace(/,/g, '')

/** Chip pickers keep the common choices one tap away (categories, payment methods). */
export function ChipGroup<T extends string>({ options, value, onChange, columns }: {
  options: { value: T; label: string; icon?: ReactNode; color?: string }[]
  value: T | null
  onChange: (value: T) => void
  columns?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', columns && 'grid grid-cols-2 sm:grid-cols-3')}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium transition-colors',
              selected
                ? 'border-brand-600 bg-brand-50 font-semibold text-brand-600 ring-1 ring-brand-600'
                : 'border-line-strong bg-surface text-ink-600 hover:bg-ink-50',
            )}
          >
            {option.color ? <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} aria-hidden /> : option.icon}
            <span className="truncate">{option.label}</span>
            {selected ? <Check className="size-3.5" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}

export function Checkbox({ checked, onChange, label, description, disabled, lockedNote }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  lockedNote?: string
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer items-start gap-3 text-sm', disabled && 'cursor-not-allowed opacity-60')}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-[18px] rounded-[5px] border-line-strong text-brand-600 accent-brand-600"
      />
      <span className="min-w-0">
        <span className="font-medium text-ink-900">{label}</span>
        {description ? <span className="block text-xs text-ink-500">{description}</span> : null}
        {disabled && lockedNote ? <span className="block text-xs font-medium text-ink-400">{lockedNote}</span> : null}
      </span>
    </label>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-ink-300')}
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  )
}

/** Searchable picker with an optional "create" action (customers, employees). */
export function Combobox<T extends { id: string; label: string; hint?: string }>({
  items, value, onChange, placeholder, emptyText, onCreate, createLabel, invalid, disabled,
}: {
  items: T[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  emptyText?: string
  onCreate?: (text: string) => void
  createLabel?: string
  invalid?: boolean
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = items.find((item) => item.id === value) ?? null
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 8)
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.hint?.toLowerCase().includes(q)).slice(0, 8)
  }, [items, query])

  if (selected) {
    return (
      <div className={cn('flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 text-sm')}>
        <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{selected.label}</span>
        {selected.hint ? <span className="truncate text-xs text-ink-500">{selected.hint}</span> : null}
        <button type="button" onClick={() => onChange(null)} aria-label={tr("Clear selection")} className="text-ink-500 hover:text-ink-900">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className={cn('flex h-10 items-center gap-2 rounded-[10px] border bg-surface px-3',
        invalid ? 'border-expense-500' : 'border-line-strong focus-within:border-brand-600')}>
        <Search className="size-4 text-ink-500" aria-hidden />
        <input
          className="w-full border-0 bg-transparent p-0 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
          placeholder={placeholder ?? tr("Search…")}
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-ink-50"
              onMouseDown={(event) => {
                event.preventDefault()
                onChange(item.id)
                setQuery('')
                setOpen(false)
              }}
            >
              <span className="truncate font-medium text-ink-900">{item.label}</span>
              {item.hint ? <span className="shrink-0 text-xs text-ink-500">{item.hint}</span> : null}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-500">{emptyText ?? tr("No matches")}</p>
          ) : null}
          {onCreate && query.trim() ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm font-semibold text-brand-600 hover:bg-brand-50"
              onMouseDown={(event) => {
                event.preventDefault()
                onCreate(query.trim())
                setQuery('')
                setOpen(false)
              }}
            >
              {createLabel ?? tr("Add")} “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
