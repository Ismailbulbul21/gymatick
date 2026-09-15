/** Domain types mirroring the database schema (see GYMATICK_IMPLEMENTATION_PROMPT.md §7).
 *  Regenerate the full typed schema any time with `npm run db:types`. */

export type MemberRole = 'owner' | 'staff'
export type RecordStatus = 'active' | 'inactive'
export type CategoryKind = 'income' | 'expense'
export type PaymentMethodType = 'cash' | 'mobile_money' | 'bank' | 'other'
export type TransactionKind =
  | 'income' | 'refund' | 'expense' | 'transfer_in' | 'transfer_out' | 'owner_deposit' | 'owner_withdrawal'
export type TransactionStatus = 'posted' | 'voided'
export type InvoiceStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled'
export type ClosingKind = 'opening' | 'daily'
export type ClosingStatus = 'closed' | 'reopened'
export type SalaryPaymentType = 'salary' | 'advance' | 'adjustment'

export interface BusinessSettings {
  business_id: string
  currency_code: string
  currency_symbol: string
  currency_decimals: number
  locale: string
  timezone: string
  day_cutoff: string
  week_starts_on: number
  invoice_prefix: string
  invoice_footer: string | null
  invoice_default_due_days: number | null
  large_amount_threshold: string | number
  staff_edit_window_minutes: number
  idle_timeout_minutes: number
  salary_tracking_start_month: string | null
  employee_positions: string[]
}

export interface Membership {
  member_id: string
  business_id: string
  business_name: string
  logo_path: string | null
  role: MemberRole
  status: RecordStatus
  title: string | null
  is_demo: boolean
  go_live_date: string | null
  onboarding_completed: boolean
  business_date: string
  settings: BusinessSettings
  permissions: string[]
}

export interface SessionContext {
  user: {
    id: string
    email: string | null
    full_name: string
    phone: string | null
    preferred_language: 'en' | 'so'
    theme_preference: 'system' | 'light' | 'dark'
    must_change_password: boolean
  }
  memberships: Membership[]
}

export interface Category {
  id: string
  business_id: string
  kind: CategoryKind
  name: string
  description: string | null
  color: string
  is_system: boolean
  system_code: string | null
  status: RecordStatus
  sort_order: number
}

export interface PaymentMethod {
  id: string
  business_id: string
  name: string
  type: PaymentMethodType
  account_label: string | null
  include_in_closing: boolean
  status: RecordStatus
  sort_order: number
}

export interface Customer {
  id: string
  business_id: string
  full_name: string
  phone: string | null
  email: string | null
  member_code: string | null
  notes: string | null
  status: RecordStatus
}

/** Row of the v_transactions view. */
export interface TransactionRow {
  id: string
  business_id: string
  reference_no: number
  reference_label: string
  kind: TransactionKind
  status: TransactionStatus
  amount: string | number
  signed_amount: string | number
  business_date: string
  occurred_at: string
  is_backdated: boolean
  description: string
  notes: string | null
  vendor: string | null
  is_salary: boolean
  category_id: string | null
  category_name: string | null
  category_color: string | null
  payment_method_id: string
  payment_method_name: string
  payment_method_type: PaymentMethodType
  customer_id: string | null
  customer_name: string | null
  invoice_id: string | null
  invoice_number: string | null
  transfer_group_id: string | null
  salary_payment_id: string | null
  salary_period: string | null
  employee_name: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  voided_by_name: string | null
  voided_at: string | null
  void_reason: string | null
}

export interface InvoiceRow {
  id: string
  business_id: string
  invoice_number: string
  customer_id: string | null
  customer_display_name: string | null
  bill_to_name: string | null
  bill_to_phone: string | null
  income_category_id: string
  category_name: string | null
  issue_date: string
  due_date: string | null
  subtotal: string | number
  discount_amount: string | number
  total: string | number
  amount_paid: string | number
  balance_due: string | number
  status: InvoiceStatus
  notes: string | null
  cancel_reason: string | null
  created_by_name: string | null
  created_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  position: number
  description: string
  quantity: string | number
  unit_price: string | number
  line_total: string | number
}

export interface EmployeeRow {
  id: string
  business_id: string
  full_name: string
  phone: string | null
  position: string
  start_date: string
  end_date: string | null
  status: RecordStatus
  notes: string | null
  current_monthly_salary: string | number
}

export interface SalaryPaymentRow {
  id: string
  employee_id: string
  employee_name: string
  position: string
  period_month: string
  payment_type: SalaryPaymentType
  reason: string | null
  transaction_id: string
  reference_label: string
  amount: string | number
  business_date: string
  status: TransactionStatus
  payment_method_name: string
  created_by_name: string | null
}

export interface ClosingRow {
  id: string
  business_id: string
  kind: ClosingKind
  period_start: string
  business_date: string
  status: ClosingStatus
  opening_total: string | number
  income_total: string | number
  refund_total: string | number
  expense_total: string | number
  salary_total: string | number
  money_in_total: string | number
  money_out_total: string | number
  expected_total: string | number
  actual_total: string | number
  difference_total: string | number
  transaction_count: number
  lines_with_difference: number
  is_balanced: boolean
  notes: string | null
  closed_by_name: string | null
  closed_at: string
  reopened_by_name: string | null
  reopened_at: string | null
  reopen_reason: string | null
  has_corrections: boolean
}

export interface ClosingLine {
  payment_method_id: string
  name: string
  type: PaymentMethodType
  opening_amount: string | number
  money_in: string | number
  money_out: string | number
  expected_amount: string | number
  actual_amount?: string | number
  difference?: string | number
  has_activity?: boolean
}

export interface ClosingPreview {
  status: 'open' | 'closed'
  business_date: string
  period_start?: string
  today: string
  checkpoint_date?: string
  days_in_period?: number
  opening_total?: string | number
  income_total?: string | number
  refund_total?: string | number
  expense_total?: string | number
  salary_total?: string | number
  owner_deposit_total?: string | number
  owner_withdrawal_total?: string | number
  transfer_total?: string | number
  money_in_total?: string | number
  money_out_total?: string | number
  expected_total?: string | number
  actual_total?: string | number
  difference_total?: string | number
  is_balanced?: boolean
  transaction_count?: number
  lines?: ClosingLine[]
  preview_token?: string
  closing_id?: string
  closed_at?: string
  next_open_date?: string
}

export interface AuditRow {
  id: string
  business_id: string
  actor_id: string | null
  action: string
  module: string
  entity_type: string
  entity_id: string | null
  summary: string
  changes: Record<string, { from: unknown; to: unknown }> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface MemberRow {
  id: string
  business_id: string
  user_id: string
  role: MemberRole
  status: RecordStatus
  title: string | null
  last_sign_in_at: string | null
  created_at: string
}

export interface PermissionRow {
  key: string
  module: string
  label: string
  description: string
  owner_only: boolean
  front_desk_default: boolean
  manager_preset: boolean
  staff_allowed: boolean
  sort_order: number
}

/* RPC payloads -------------------------------------------------------------- */
export interface DashboardSummary {
  business_date: string
  today: {
    income: number | null
    gross_income: number | null
    refunds: number | null
    expenses: number | null
    salaries: number | null
    net: number | null
    transaction_count: number
  }
  after_close: { business_date: string; income: number; expenses: number; count: number } | null
  balance: {
    total: number
    checkpoint_date: string | null
    by_method: { payment_method_id: string; name: string; type: PaymentMethodType; balance: number }[]
  } | null
  outstanding_invoices: { total: number; count: number } | null
  pending_salaries: {
    obligations: number
    paid: number
    pending: number
    employee_count: number
    unpaid_count: number
  } | null
  closing_status: {
    is_closed: boolean
    closed_at: string | null
    difference_total: number | null
    is_balanced: boolean | null
    unclosed_days_with_activity: number
    last_checkpoint_date: string | null
  }
  last_closing: {
    id: string
    business_date: string
    period_start: string
    opening_total: number
    money_in_total: number
    money_out_total: number
    expected_total: number
    actual_total: number
    difference_total: number
    is_balanced: boolean
    notes: string | null
    closed_by_name: string | null
    closed_at: string
  } | null
  permissions: { income: boolean; expenses: boolean; salaries: boolean; financials: boolean; closings: boolean }
}

export interface SalaryOverviewEmployee {
  employee_id: string
  full_name: string
  position: string
  status: RecordStatus
  monthly_salary: number
  paid: number
  remaining: number
  state: 'paid' | 'partial' | 'unpaid' | 'overpaid' | 'none'
  last_payment_at: string | null
  last_payment_method: string | null
}

export interface SalaryOverview {
  period_month: string
  employees: SalaryOverviewEmployee[]
  totals: { obligations: number; paid: number; pending: number; employee_count: number; unpaid_count: number }
  arrears: { total: number; months: { month: string }[]; since: string }
}

export interface ReportBreakdownRow {
  category_id?: string
  payment_method_id?: string
  name: string
  color?: string
  amount?: number
  count?: number
  share?: number
  money_in?: number
  money_out?: number
  net?: number
  type?: PaymentMethodType
}

export interface ReportSummary {
  range: { from: string; to: string; days: number; previous_from: string; previous_to: string; today: string }
  totals: {
    gross_income: number
    refunds: number
    income: number
    expenses: number
    salaries: number
    owner_deposits: number
    owner_withdrawals: number
    transfers: number
    net: number
    transaction_count: number
    average_daily_income: number
  }
  previous: { income: number; expenses: number; net: number }
  granularity: 'day' | 'week' | 'month'
  series: { bucket: string; income: number; expenses: number; net: number }[]
  income_categories: ReportBreakdownRow[]
  expense_categories: ReportBreakdownRow[]
  payment_methods: ReportBreakdownRow[]
  closings: { days_closed: number; balanced_days: number; days_with_difference: number; difference_total: number } | null
  invoices: { invoiced: number; collected: number; outstanding: number; outstanding_count: number; invoice_count: number }
}

export interface ClosingDetail {
  closing: ClosingRow & { closed_by_name: string | null; reopened_by_name: string | null }
  lines: ClosingLine[]
  transactions: {
    id: string
    reference_no: number
    kind: TransactionKind
    status: TransactionStatus
    amount: number
    signed_amount: number
    description: string
    business_date: string
    occurred_at: string
    category: string | null
    payment_method: string
    is_salary: boolean
    voided_at: string | null
    void_reason: string | null
  }[]
  corrections: {
    id: string
    reference_no: number
    description: string
    amount: number
    kind: TransactionKind
    voided_at: string
    void_reason: string
    voided_by: string | null
  }[]
  recalculated: { payment_method_id: string; name: string; expected_amount: number; actual_amount: number; difference: number }[]
  has_corrections: boolean
}
