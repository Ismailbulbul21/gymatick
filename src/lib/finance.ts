/** Pure financial calculations, mirroring the SQL rules (the database stays the authority).
 *  All amounts are integer minor units. */
import type { Minor } from './money'

export const netIncome = (grossIncome: Minor, refunds: Minor): Minor => grossIncome - refunds
export const netResult = (income: Minor, expenses: Minor): Minor => income - expenses

/** Opening + money received − money used. */
export const expectedClosing = (opening: Minor, moneyIn: Minor, moneyOut: Minor): Minor => opening + moneyIn - moneyOut

export const closingDifference = (actual: Minor, expected: Minor): Minor => actual - expected

export type ClosingOutcome = 'balanced' | 'short' | 'over'

export function closingOutcome(lines: { expected: Minor; actual: Minor }[]): {
  difference: Minor
  linesWithDifference: number
  outcome: ClosingOutcome
  balanced: boolean
} {
  const difference = lines.reduce((total, line) => total + closingDifference(line.actual, line.expected), 0)
  const linesWithDifference = lines.filter((line) => line.actual !== line.expected).length
  const balanced = difference === 0 && linesWithDifference === 0
  return {
    difference,
    linesWithDifference,
    balanced,
    outcome: balanced ? 'balanced' : difference < 0 ? 'short' : 'over',
  }
}

export const invoiceLineTotal = (quantityMinor: Minor, unitPriceMinor: Minor, decimals = 2): Minor => {
  const scale = 10 ** decimals
  return Math.round((quantityMinor * unitPriceMinor) / scale)
}

export function invoiceTotals(
  items: { quantity: Minor; unitPrice: Minor }[],
  discount: Minor,
  paid: Minor = 0,
  decimals = 2,
): { subtotal: Minor; discount: Minor; total: Minor; paid: Minor; balance: Minor } {
  const subtotal = items.reduce((sum, item) => sum + invoiceLineTotal(item.quantity, item.unitPrice, decimals), 0)
  const cappedDiscount = Math.min(Math.max(discount, 0), subtotal)
  const total = subtotal - cappedDiscount
  return { subtotal, discount: cappedDiscount, total, paid, balance: total - paid }
}

export type InvoiceState = 'pending' | 'partially_paid' | 'paid' | 'cancelled'

export const invoiceStatus = (total: Minor, paid: Minor, cancelled = false): InvoiceState =>
  cancelled ? 'cancelled' : paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : 'pending'

export type SalaryState = 'paid' | 'partial' | 'unpaid' | 'overpaid' | 'none'

export function salaryState(obligation: Minor, paid: Minor): SalaryState {
  if (obligation === 0) return 'none'
  if (paid > obligation) return 'overpaid'
  if (paid >= obligation) return 'paid'
  return paid > 0 ? 'partial' : 'unpaid'
}

export const salaryRemaining = (obligation: Minor, paid: Minor): Minor => Math.max(obligation - paid, 0)

export const pendingSalaryTotal = (rows: { obligation: Minor; paid: Minor }[]): Minor =>
  rows.reduce((total, row) => total + salaryRemaining(row.obligation, row.paid), 0)

/** Income ÷ days elapsed in the range (a range ending in the future counts only up to today). */
export function averageDailyIncome(income: Minor, days: number): Minor {
  const safeDays = Math.max(days, 1)
  return Math.round(income / safeDays)
}

/** Percentage change against a previous period; null when there is nothing to compare. */
export function percentChange(current: Minor, previous: Minor): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

/** Current balance = money counted at the last closing + everything recorded since. */
export const currentBalance = (checkpointActual: Minor, movementsSince: Minor): Minor => checkpointActual + movementsSince
