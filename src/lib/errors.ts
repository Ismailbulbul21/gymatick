/** Database functions raise coded errors: message = CODE, detail = sentence, hint = JSON.
 *  This turns them into something a gym owner can act on. */
import type { PostgrestError } from '@supabase/supabase-js'

export interface AppError {
  code: string
  message: string
  field?: string
  hint: Record<string, unknown>
  raw?: unknown
}

/** Which form field an error belongs to, so it shows next to the input. */
const FIELD_BY_CODE: Record<string, string> = {
  INVALID_AMOUNT: 'amount',
  AMOUNT_PRECISION: 'amount',
  REFUND_EXCEEDS_ORIGINAL: 'amount',
  SALARY_EXCEEDS_REMAINING: 'amount',
  OVERPAYMENT: 'amount',
  CATEGORY_INVALID: 'category_id',
  CATEGORY_INACTIVE: 'category_id',
  SYSTEM_CATEGORY: 'category_id',
  CATEGORY_MISMATCH: 'category_id',
  METHOD_INACTIVE: 'payment_method_id',
  SAME_METHOD_TRANSFER: 'to_payment_method_id',
  DAY_CLOSED: 'business_date',
  FUTURE_DATE: 'business_date',
  BACKDATE_NOT_ALLOWED: 'business_date',
  REASON_REQUIRED: 'reason',
  NOTES_REQUIRED: 'notes',
  CUSTOMER_INVALID: 'customer_id',
  EMPLOYEE_NOT_ELIGIBLE: 'period_month',
}

const FALLBACK: Record<string, string> = {
  PERMISSION_DENIED: 'You do not have permission to do this.',
  NOT_FOUND: 'That record no longer exists.',
  ONBOARDING_REQUIRED: 'Finish setting up the gym (opening balances) first.',
  IDEMPOTENCY_MISMATCH: 'This form was already submitted with different details. Reload and try again.',
  CLOSING_STALE: 'New activity was recorded while you were counting. Review the updated figures.',
  ALREADY_CLOSED: 'This day is already closed.',
  ALREADY_VOIDED: 'This transaction is already voided.',
  LINKED_TRANSACTION_LOCKED: 'Change this through its invoice, salary or transfer instead.',
  HAS_REFUNDS: 'Void the refunds for this payment first.',
  INVOICE_HAS_PAYMENTS: 'This invoice has payments. Void them first.',
  INVOICE_CANCELLED: 'This invoice is cancelled.',
  TRANSACTION_ALREADY_LINKED: 'This payment already belongs to another invoice.',
  CURRENCY_LOCKED: 'Currency cannot change after transactions are recorded.',
  METHOD_HAS_BALANCE: 'Move the money in this method somewhere else first.',
  LAST_OWNER: 'GYMATICK needs at least one active owner.',
  SELF_CHANGE_NOT_ALLOWED: 'You cannot change your own access.',
  OWNER_ONLY_PERMISSION: 'That permission is available to owners only.',
  OPENING_LOCKED: 'Opening balances can no longer be changed.',
  EDIT_WINDOW_EXPIRED: 'This entry can no longer be changed by you. Ask the owner.',
  SALARY_LINK_MISSING: 'Salary expenses must be created from Salaries → Pay salary.',
  RANGE_TOO_LARGE: 'Choose a shorter date range.',
  SETUP_INCOMPLETE: 'This gym is not fully set up yet.',
  EMAIL_IN_USE: 'This email already has a GYMATICK account.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_INPUT: 'Check the details and try again.',
}

const isPostgrestError = (error: unknown): error is PostgrestError =>
  typeof error === 'object' && error !== null && 'message' in error && 'code' in error

export function parseAppError(error: unknown): AppError {
  if (isPostgrestError(error)) {
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'UNEXPECTED'
    let hint: Record<string, unknown> = {}
    try {
      hint = error.hint ? (JSON.parse(error.hint) as Record<string, unknown>) : {}
    } catch {
      hint = {}
    }
    const detail = typeof error.details === 'string' && error.details ? error.details : undefined
    if (error.code === '42501') {
      return { code: 'PERMISSION_DENIED', message: FALLBACK.PERMISSION_DENIED!, hint: {}, raw: error }
    }
    return {
      code,
      message: detail ?? FALLBACK[code] ?? 'Something went wrong. Please try again.',
      field: FIELD_BY_CODE[code],
      hint,
      raw: error,
    }
  }
  if (error instanceof Error) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return {
      code: offline ? 'OFFLINE' : 'NETWORK',
      message: offline
        ? 'You are offline. Your entry was not saved.'
        : 'Cannot reach the server right now. Your data is safe — try again.',
      hint: {},
      raw: error,
    }
  }
  return { code: 'UNEXPECTED', message: 'Something went wrong. Please try again.', hint: {}, raw: error }
}

export const errorMessage = (error: unknown): string => parseAppError(error).message
