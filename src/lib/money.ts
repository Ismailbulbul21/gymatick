/** Money handling: integer minor units in TypeScript, decimal strings on the wire.
 *  Never use floating point arithmetic on amounts. */

export type Minor = number

const isSafe = (n: number) => Number.isSafeInteger(n)

/** Parses an API value ("1250.50", 1250.5) into minor units. */
export function toMinor(value: string | number | null | undefined, decimals = 2): Minor {
  if (value === null || value === undefined || value === '') return 0
  const text = typeof value === 'number' ? value.toFixed(decimals) : value.trim()
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) {
    const n = Number(text)
    if (!Number.isFinite(n)) return 0
    return Math.round(n * 10 ** decimals)
  }
  const [, sign, whole, fraction = ''] = match
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals)
  const minor = Number(whole ?? '0') * 10 ** decimals + Number(padded || '0')
  return sign ? -minor : minor
}

/** Minor units → decimal string for RPC parameters ("1250.50"). */
export function minorToDecimalString(minor: Minor, decimals = 2): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  if (decimals === 0) return `${sign}${abs}`
  const whole = Math.floor(abs / 10 ** decimals)
  const fraction = String(abs % 10 ** decimals).padStart(decimals, '0')
  return `${sign}${whole}.${fraction}`
}

export interface ParsedAmount {
  ok: boolean
  minor: Minor
  error?: 'empty' | 'invalid' | 'not_positive' | 'too_many_decimals' | 'too_large'
}

/** Validates what a person typed into a money field. */
export function parseMoneyInput(raw: string, decimals = 2, { allowZero = false } = {}): ParsedAmount {
  const text = raw.replace(/[\s,]/g, '').trim()
  if (text === '') return { ok: false, minor: 0, error: 'empty' }
  if (!/^\d*(\.\d*)?$/.test(text)) return { ok: false, minor: 0, error: 'invalid' }
  const [whole = '', fraction = ''] = text.split('.')
  if (fraction.length > decimals) return { ok: false, minor: 0, error: 'too_many_decimals' }
  if (whole.length > 12) return { ok: false, minor: 0, error: 'too_large' }
  const minor = toMinor(text === '.' ? '0' : text, decimals)
  if (!isSafe(minor)) return { ok: false, minor: 0, error: 'too_large' }
  if (minor === 0 && !allowZero) return { ok: false, minor: 0, error: 'not_positive' }
  return { ok: true, minor }
}

export interface Currency {
  code: string
  symbol: string
  decimals: number
  locale: string
}

export const DEFAULT_CURRENCY: Currency = { code: 'USD', symbol: '$', decimals: 2, locale: 'en-US' }

/** "$1,250.50" — sign is rendered explicitly so colour never carries meaning alone. */
export function formatMoney(
  minor: Minor,
  currency: Currency = DEFAULT_CURRENCY,
  { sign = false, hideSymbol = false }: { sign?: boolean; hideSymbol?: boolean } = {},
): string {
  const abs = Math.abs(minor) / 10 ** currency.decimals
  const body = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(abs)
  const symbol = hideSymbol ? '' : currency.symbol
  if (minor < 0) return `−${symbol}${body}`
  if (sign && minor > 0) return `+${symbol}${body}`
  return `${symbol}${body}`
}

/** Compact form for chart axes: $1.2K, $980 */
export function formatCompactMoney(minor: Minor, currency: Currency = DEFAULT_CURRENCY): string {
  const value = minor / 10 ** currency.decimals
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1000) {
    const k = abs / 1000
    return `${sign}${currency.symbol}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return `${sign}${currency.symbol}${Math.round(abs)}`
}

export const sumMinor = (values: Minor[]): Minor => values.reduce((total, v) => total + v, 0)

/** Money from the API (numeric columns arrive as strings or numbers). */
export const money = (value: string | number | null | undefined, decimals = 2): Minor => toMinor(value, decimals)
