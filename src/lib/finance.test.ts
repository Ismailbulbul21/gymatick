import { describe, expect, it } from 'vitest'
import {
  averageDailyIncome, closingDifference, closingOutcome, expectedClosing, invoiceLineTotal, invoiceStatus,
  invoiceTotals, netIncome, netResult, pendingSalaryTotal, percentChange, salaryRemaining, salaryState, currentBalance,
} from './finance'
import { formatCompactMoney, formatMoney, minorToDecimalString, parseMoneyInput, toMinor } from './money'
import { daysInRange, presetRange } from './dates'
import { toCsv } from './utils'

const USD = { code: 'USD', symbol: '$', decimals: 2, locale: 'en-US' }

describe('money input', () => {
  it('accepts plain and grouped amounts', () => {
    expect(parseMoneyInput('12.50').minor).toBe(1250)
    expect(parseMoneyInput('1,250.50').minor).toBe(125050)
    expect(parseMoneyInput('1250').minor).toBe(125000)
    expect(parseMoneyInput('0.01').minor).toBe(1)
  })
  it('rejects what would corrupt the ledger', () => {
    expect(parseMoneyInput('').error).toBe('empty')
    expect(parseMoneyInput('0').error).toBe('not_positive')
    expect(parseMoneyInput('12.505').error).toBe('too_many_decimals')
    expect(parseMoneyInput('-5').error).toBe('invalid')
    expect(parseMoneyInput('abc').error).toBe('invalid')
    expect(parseMoneyInput('1234567890123').error).toBe('too_large')
  })
  it('rejects decimals in a zero-decimal currency', () => {
    expect(parseMoneyInput('5.5', 0).error).toBe('too_many_decimals')
    expect(parseMoneyInput('5', 0).minor).toBe(5)
  })
  it('round-trips API values without floating point drift', () => {
    expect(toMinor('999999999999.99')).toBe(99999999999999)
    expect(minorToDecimalString(125050)).toBe('1250.50')
    expect(minorToDecimalString(5, 2)).toBe('0.05')
    expect(toMinor(0.1) + toMinor(0.2)).toBe(toMinor(0.3))
  })
  it('formats with an explicit sign so colour is never the only signal', () => {
    expect(formatMoney(125050, USD)).toBe('$1,250.50')
    expect(formatMoney(70050, USD, { sign: true })).toBe('+$700.50')
    expect(formatMoney(-1500, USD)).toBe('−$15.00')
    expect(formatCompactMoney(120000, USD)).toBe('$1.2K')
  })
})

describe('daily totals', () => {
  it('is zero for a day with no transactions', () => {
    expect(netIncome(0, 0)).toBe(0)
    expect(netResult(0, 0)).toBe(0)
  })
  it('subtracts refunds from income and keeps salaries inside expenses', () => {
    const income = netIncome(70050, 3500)
    expect(income).toBe(66550)
    expect(netResult(income, 20300)).toBe(46250)
  })
})

describe('Xisaab Xir', () => {
  it('matches the reference example: 500 + 250 − 135 = 615, counted 600 → −15', () => {
    const expected = expectedClosing(50000, 25000, 13500)
    expect(expected).toBe(61500)
    expect(closingDifference(60000, expected)).toBe(-1500)
  })
  it('is balanced only when every method matches', () => {
    expect(closingOutcome([{ expected: 61500, actual: 61500 }]).balanced).toBe(true)
    const offsetting = closingOutcome([
      { expected: 73490, actual: 78490 },
      { expected: 113500, actual: 108500 },
    ])
    expect(offsetting.difference).toBe(0)
    expect(offsetting.linesWithDifference).toBe(2)
    expect(offsetting.balanced).toBe(false)
  })
  it('labels short and over days', () => {
    expect(closingOutcome([{ expected: 61500, actual: 60000 }]).outcome).toBe('short')
    expect(closingOutcome([{ expected: 61500, actual: 61700 }]).outcome).toBe('over')
  })
  it('starts the next day from the money counted', () => {
    expect(currentBalance(60000, 3000)).toBe(63000)
  })
})

describe('invoices', () => {
  it('rounds each line before adding them up', () => {
    expect(invoiceLineTotal(300, 3333)).toBe(9999) // 3 × 33.33 = 99.99, matching round(q*p, 2) in SQL
    expect(invoiceLineTotal(150, 2000)).toBe(3000) // 1.5 × 20.00 = 30.00
    const totals = invoiceTotals([{ quantity: 100, unitPrice: 26000 }], 1000, 25000)
    expect(totals.subtotal).toBe(26000)
    expect(totals.total).toBe(25000)
    expect(totals.balance).toBe(0)
  })
  it('never lets the discount exceed the subtotal', () => {
    expect(invoiceTotals([{ quantity: 100, unitPrice: 5000 }], 999999).total).toBe(0)
  })
  it('derives status from payments', () => {
    expect(invoiceStatus(25000, 0)).toBe('pending')
    expect(invoiceStatus(25000, 9000)).toBe('partially_paid')
    expect(invoiceStatus(25000, 25000)).toBe('paid')
    expect(invoiceStatus(0, 0)).toBe('paid')
    expect(invoiceStatus(25000, 25000, true)).toBe('cancelled')
  })
})

describe('salaries', () => {
  it('classifies each employee for the period', () => {
    expect(salaryState(45000, 0)).toBe('unpaid')
    expect(salaryState(45000, 10000)).toBe('partial')
    expect(salaryState(45000, 45000)).toBe('paid')
    expect(salaryState(45000, 50000)).toBe('overpaid')
    expect(salaryState(0, 0)).toBe('none')
  })
  it('adds up only what is still owed', () => {
    expect(salaryRemaining(45000, 50000)).toBe(0)
    expect(pendingSalaryTotal([
      { obligation: 45000, paid: 0 },
      { obligation: 35000, paid: 10000 },
      { obligation: 18000, paid: 18000 },
    ])).toBe(70000)
  })
})

describe('reporting helpers', () => {
  it('averages income over the days elapsed', () => {
    expect(averageDailyIncome(864300, 14)).toBe(61736)
  })
  it('compares with the previous period', () => {
    expect(percentChange(864300, 769000)).toBe(12.4)
    expect(percentChange(100, 0)).toBeNull()
  })
})

describe('date ranges', () => {
  const today = '2026-09-14'
  it('builds presets from the business date, not the browser clock', () => {
    expect(presetRange('today', today)).toEqual({ from: today, to: today })
    expect(presetRange('yesterday', today)).toEqual({ from: '2026-09-13', to: '2026-09-13' })
    expect(presetRange('this_month', today)).toEqual({ from: '2026-09-01', to: today })
    expect(presetRange('last_month', today)).toEqual({ from: '2026-08-01', to: '2026-08-31' })
    expect(presetRange('last_7', today)).toEqual({ from: '2026-09-08', to: today })
  })
  it('starts the week on Saturday for Somalia', () => {
    expect(presetRange('this_week', today, 6).from).toBe('2026-09-12')
  })
  it('counts days inclusively', () => {
    expect(daysInRange({ from: '2026-09-01', to: '2026-09-14' })).toBe(14)
  })
})

describe('csv export', () => {
  it('quotes separators and blocks formula injection in text cells', () => {
    const csv = toCsv(
      [{ description: '=cmd|calc', amount: '25.00', customer: 'Ali, "Big" A' }],
      [
        { key: 'description', label: 'Description' },
        { key: 'amount', label: 'Amount', numeric: true },
        { key: 'customer', label: 'Customer' },
      ],
    )
    expect(csv).toContain("'=cmd|calc")
    expect(csv).toContain('"Ali, ""Big"" A"')
    expect(csv).toContain(',25.00,')
  })
})
