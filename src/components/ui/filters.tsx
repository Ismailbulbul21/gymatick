import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { presetLabel, presetRange, type DatePreset, type DateRange } from '@/lib/dates'
import { Button } from './primitives'

export const FilterBar = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
)

const controlClass =
  'inline-flex h-9 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink-900'

export function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className={cn(controlClass, 'gap-1.5 pr-2')}>
      <span className="text-ink-500">{label}</span>
      <select
        className="cursor-pointer border-0 bg-transparent py-0 pl-0 pr-1 text-[13px] font-semibold text-brand-600 focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder, className }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (text !== value) onChange(text)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [text, value, onChange])

  return (
    <div className={cn('flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3', className)}>
      <Search className="size-4 shrink-0 text-ink-500" aria-hidden />
      <input
        className="w-full border-0 bg-transparent p-0 text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
        placeholder={placeholder ?? 'Search…'}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {text ? (
        <button type="button" aria-label="Clear search" onClick={() => setText('')} className="text-ink-500 hover:text-ink-900">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

const PRESETS: Exclude<DatePreset, 'custom'>[] = ['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'last_7', 'last_30']

/** Date range control: presets first, custom dates behind them. */
export function DateRangeFilter({ value, preset, onChange, businessToday, weekStartsOn = 6 }: {
  value: DateRange
  preset: DatePreset
  onChange: (range: DateRange, preset: DatePreset) => void
  businessToday: string
  weekStartsOn?: number
}) {
  const [custom, setCustom] = useState(preset === 'custom')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={cn(controlClass, 'gap-1.5 pr-2')}>
        <CalendarDays className="size-4 text-ink-500" aria-hidden />
        <select
          aria-label="Date range"
          className="cursor-pointer border-0 bg-transparent py-0 pl-0 pr-1 text-[13px] font-semibold text-brand-600 focus:outline-none"
          value={preset}
          onChange={(event) => {
            const next = event.target.value as DatePreset
            if (next === 'custom') {
              setCustom(true)
              onChange(value, 'custom')
              return
            }
            setCustom(false)
            onChange(presetRange(next, businessToday, weekStartsOn), next)
          }}
        >
          {PRESETS.map((item) => (
            <option key={item} value={item}>{presetLabel[item]}</option>
          ))}
          <option value="custom">Custom range</option>
        </select>
      </label>

      {custom ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            className="h-9 rounded-[10px] border border-line-strong bg-surface px-2 text-[13px] text-ink-900"
            value={value.from}
            max={value.to}
            onChange={(event) => onChange({ ...value, from: event.target.value }, 'custom')}
          />
          <span className="text-ink-500">→</span>
          <input
            type="date"
            aria-label="To date"
            className="h-9 rounded-[10px] border border-line-strong bg-surface px-2 text-[13px] text-ink-900"
            value={value.to}
            min={value.from}
            onChange={(event) => onChange({ ...value, to: event.target.value }, 'custom')}
          />
        </div>
      ) : (
        <span className="num text-xs text-ink-500">
          {value.from} → {value.to}
        </span>
      )}
    </div>
  )
}

export function ActiveFilters({ items, onClear }: { items: { label: string; onRemove: () => void }[]; onClear: () => void }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span key={item.label} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-50 pl-3 pr-1.5 text-xs font-semibold text-brand-600">
          {item.label}
          <button type="button" aria-label={`Remove ${item.label}`} onClick={item.onRemove} className="rounded-full p-0.5 hover:bg-brand-100">
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <Button variant="link" size="sm" onClick={onClear}>Clear filters</Button>
    </div>
  )
}
