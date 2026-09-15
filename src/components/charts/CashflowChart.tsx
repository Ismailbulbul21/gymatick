import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { List } from 'lucide-react'
import { useTheme } from '@/app/providers/ThemeProvider'
import { formatBusinessDate } from '@/lib/dates'
import { formatCompactMoney, formatMoney, type Currency, type Minor } from '@/lib/money'
import { Button } from '@/components/ui/primitives'

/** Validated series colours: green income, red expenses, blue net (see spec §11.9). */
const SERIES = {
  light: { income: '#0b6e36', expense: '#ee6368', net: '#2449dc', grid: '#e2e6ee', axis: '#667085', surface: '#ffffff' },
  dark: { income: '#23a863', expense: '#b93a42', net: '#5f84fb', grid: '#22304d', axis: '#8a95ab', surface: '#111a2e' },
}

export interface CashflowPoint {
  day: string
  income: Minor
  expenses: Minor
  net: Minor
}

export function CashflowChart({ data, currency, height = 300 }: { data: CashflowPoint[]; currency: Currency; height?: number }) {
  const { resolved } = useTheme()
  const colors = SERIES[resolved]
  const [asTable, setAsTable] = useState(false)
  const factor = 10 ** currency.decimals
  const rows = data.map((point) => ({
    ...point,
    label: formatBusinessDate(point.day, 'd MMM'),
    incomeValue: point.income / factor,
    expenseValue: point.expenses / factor,
    netValue: point.net / factor,
  }))

  if (asTable) {
    return (
      <div className="flex flex-col gap-3">
        <Legend colors={colors} onToggle={() => setAsTable(false)} toggleLabel="Show chart" />
        <div className="max-h-[320px] overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['Day', 'Income', 'Expenses', 'Net'].map((header) => (
                  <th key={header} className="sticky top-0 h-9 bg-surface-2 px-3 text-left text-xs font-semibold text-ink-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day} className="border-t border-line">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="num px-3 py-2 text-income-700">{formatMoney(row.income, currency)}</td>
                  <td className="num px-3 py-2 text-expense-600">{formatMoney(row.expenses, currency)}</td>
                  <td className="num px-3 py-2 font-semibold">{formatMoney(row.net, currency, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Legend colors={colors} onToggle={() => setAsTable(true)} toggleLabel="View as table" />
      <div style={{ height }} aria-label="Income versus expenses per day">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.axis, fontSize: 11 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(value: number) => formatCompactMoney(Math.round(value * factor), currency)}
            />
            <Tooltip
              cursor={{ fill: colors.grid, fillOpacity: 0.45 }}
              contentStyle={{
                borderRadius: 10,
                border: `1px solid ${colors.grid}`,
                background: colors.surface,
                fontSize: 12,
                boxShadow: '0 12px 24px -6px rgba(16,24,40,.14)',
              }}
              formatter={(value, name) => [formatMoney(Math.round(Number(value ?? 0) * factor), currency), String(name)]}
            />
            <Bar dataKey="incomeValue" name="Income" fill={colors.income} maxBarSize={24} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenseValue" name="Expenses" fill={colors.expense} maxBarSize={24} radius={[4, 4, 0, 0]} />
            <Line
              dataKey="netValue"
              name="Net result"
              type="monotone"
              stroke={colors.net}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.net, stroke: colors.surface, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: colors.net, stroke: colors.surface, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Legend({ colors, onToggle, toggleLabel }: {
  colors: { income: string; expense: string; net: string }
  onToggle: () => void
  toggleLabel: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-600">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: colors.income }} aria-hidden /> Income
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: colors.expense }} aria-hidden /> Expenses
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: colors.net }} aria-hidden /> Net result
        </span>
      </div>
      <Button variant="ghost" size="sm" icon={<List className="size-4" />} onClick={onToggle}>
        {toggleLabel}
      </Button>
    </div>
  )
}
