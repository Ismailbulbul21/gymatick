import { formatMoney, type Currency, type Minor } from '@/lib/money'
import { useTheme } from '@/app/providers/ThemeProvider'

export interface BreakdownRow {
  label: string
  amount: Minor
  share: number
  count?: number
}

/** Nominal categories: one hue for every bar, sorted, value at the tip. */
export function BreakdownBars({ rows, currency, tone = 'expense', emptyText = 'Nothing in this period' }: {
  rows: BreakdownRow[]
  currency: Currency
  tone?: 'income' | 'expense' | 'brand'
  emptyText?: string
}) {
  const { resolved } = useTheme()
  const palette = {
    light: { income: '#0b6e36', expense: '#ee6368', brand: '#2449dc' },
    dark: { income: '#23a863', expense: '#b93a42', brand: '#5f84fb' },
  }[resolved]
  const color = palette[tone]
  const max = Math.max(...rows.map((row) => row.amount), 1)

  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-500">{emptyText}</p>

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,140px)_1fr_48px] items-center gap-3">
          <span className="truncate text-[13px] text-ink-600" title={row.label}>{row.label}</span>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="block h-3 rounded-r"
              style={{ width: `${Math.max((row.amount / max) * 78, 1.5)}%`, background: color }}
              aria-hidden
            />
            <span className="num whitespace-nowrap text-[13px] font-semibold text-ink-900">{formatMoney(row.amount, currency)}</span>
          </div>
          <span className="num text-right text-xs text-ink-500">{row.share.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}
