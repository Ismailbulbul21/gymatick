import { getLanguage } from '@/i18n'
/** Dates are business dates: plain YYYY-MM-DD strings decided by the server in the
 *  gym's timezone. The browser clock is never used to decide which day money belongs to. */
import { TZDate } from '@date-fns/tz'
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek, subDays } from 'date-fns'

const SOMALI_DATE_WORDS: Record<string, string> = {
  January: 'Janaayo', February: 'Febraayo', March: 'Maarso', April: 'Abriil', May: 'May', June: 'Juun', July: 'Luuliyo',
  August: 'Ogost', September: 'Sebtembar', October: 'Oktoobar', November: 'Nofembar', December: 'Desembar',
  Jan: 'Jan', Feb: 'Feb', Mar: 'Mar', Apr: 'Abr', Jun: 'Jun', Jul: 'Luu', Aug: 'Ogo', Sep: 'Seb', Oct: 'Okt', Nov: 'Nof', Dec: 'Des',
  Sunday: 'Axad', Monday: 'Isniin', Tuesday: 'Talaado', Wednesday: 'Arbaco', Thursday: 'Khamiis', Friday: 'Jimce', Saturday: 'Sabti',
  Sun: 'Axd', Mon: 'Isn', Tue: 'Tal', Wed: 'Arb', Thu: 'Kha', Fri: 'Jim', Sat: 'Sab',
}

/** Month and day names in the interface language (date-fns has no Somali locale). */
const localize = (text: string): string =>
  getLanguage() === 'so' ? text.replace(/[A-Z][a-z]+/g, (word) => SOMALI_DATE_WORDS[word] ?? word) : text

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'last_7' | 'last_30' | 'custom'

export interface DateRange {
  from: string
  to: string
}

export const toISODate = (date: Date): string => format(date, 'yyyy-MM-dd')
export const parseDate = (iso: string): Date => parseISO(iso)

/** Range boundaries for a preset, calculated from the server's business date. */
export function presetRange(preset: DatePreset, businessToday: string, weekStartsOn = 6): DateRange {
  const today = parseISO(businessToday)
  switch (preset) {
    case 'today':
      return { from: businessToday, to: businessToday }
    case 'yesterday': {
      const d = toISODate(subDays(today, 1))
      return { from: d, to: d }
    }
    case 'this_week': {
      const start = startOfWeek(today, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
      return { from: toISODate(start), to: businessToday }
    }
    case 'last_7':
      return { from: toISODate(subDays(today, 6)), to: businessToday }
    case 'last_30':
      return { from: toISODate(subDays(today, 29)), to: businessToday }
    case 'last_month': {
      const start = startOfMonth(addMonths(today, -1))
      return { from: toISODate(start), to: toISODate(endOfMonth(start)) }
    }
    case 'this_month':
    default:
      return { from: toISODate(startOfMonth(today)), to: businessToday }
  }
}

export const presetLabel: Record<Exclude<DatePreset, 'custom'>, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  last_7: 'Last 7 days',
  last_30: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
}

/** 14 Sep 2026 */
export const formatBusinessDate = (iso: string | null | undefined, pattern = 'd MMM yyyy'): string =>
  iso ? localize(format(parseISO(iso), pattern)) : '—'

/** Monday, 14 September 2026 */
export const formatLongDate = (iso: string): string => localize(format(parseISO(iso), 'EEEE, d MMMM yyyy'))

/** A timestamp shown in the gym's timezone, never the viewer's. */
export function formatBusinessTime(timestamp: string | null | undefined, timezone: string, pattern = 'HH:mm'): string {
  if (!timestamp) return '—'
  return localize(format(new TZDate(new Date(timestamp), timezone), pattern))
}

export const formatBusinessDateTime = (timestamp: string | null | undefined, timezone: string): string =>
  timestamp ? formatBusinessTime(timestamp, timezone, 'd MMM yyyy, HH:mm') : '—'

export const monthStart = (iso: string): string => toISODate(startOfMonth(parseISO(iso)))
export const shiftMonth = (isoMonth: string, months: number): string => toISODate(addMonths(parseISO(isoMonth), months))
export const formatMonth = (isoMonth: string): string => localize(format(parseISO(isoMonth), 'MMMM yyyy'))
export const nextDay = (iso: string): string => toISODate(addDays(parseISO(iso), 1))

/** Days between two business dates, inclusive. */
export const daysInRange = (range: DateRange): number =>
  Math.round((parseISO(range.to).getTime() - parseISO(range.from).getTime()) / 86_400_000) + 1
