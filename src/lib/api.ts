/** Every call the app makes. Reads go through RLS-protected views; money changes
 *  go through database functions that re-check permissions server-side. */
import { supabase } from './supabase'
import type {
  AuditRow, Category, ClosingDetail, ClosingPreview, ClosingRow, Customer, DashboardSummary, EmployeeRow,
  InvoiceItem, InvoiceRow, MemberRow, PaymentMethod, PermissionRow, ReportSummary, SalaryOverview,
  SalaryPaymentRow, TransactionKind, TransactionRow,
} from '@/types/db'

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

async function select<T>(builder: PromiseLike<{ data: unknown; error: unknown; count?: number | null }>): Promise<{ rows: T[]; count: number }> {
  const { data, error, count } = (await builder) as { data: T[] | null; error: unknown; count?: number | null }
  if (error) throw error
  return { rows: data ?? [], count: count ?? data?.length ?? 0 }
}

/* Master data --------------------------------------------------------------- */
export const listCategories = async (businessId: string): Promise<Category[]> =>
  (await select<Category>(
    supabase.from('categories').select('*').eq('business_id', businessId).order('kind').order('sort_order').order('name'),
  )).rows

export const listPaymentMethods = async (businessId: string): Promise<PaymentMethod[]> =>
  (await select<PaymentMethod>(
    supabase.from('payment_methods').select('*').eq('business_id', businessId).order('sort_order'),
  )).rows

export const listCustomers = async (businessId: string, search = '', limit = 50): Promise<Customer[]> => {
  let query = supabase.from('customers').select('*').eq('business_id', businessId).order('full_name').limit(limit)
  if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,member_code.ilike.%${search.trim()}%`)
  return (await select<Customer>(query)).rows
}

export const saveCustomer = (businessId: string, data: Record<string, unknown>, customerId?: string) =>
  rpc<Customer>('save_customer', { p_business_id: businessId, p_data: data, p_customer_id: customerId ?? null })

export const setCustomerStatus = (customerId: string, status: 'active' | 'inactive') =>
  rpc<Customer>('set_customer_status', { p_customer_id: customerId, p_status: status })

/* Ledger -------------------------------------------------------------------- */
export interface TransactionFilters {
  from: string
  to: string
  kinds?: TransactionKind[]
  categoryId?: string | null
  paymentMethodId?: string | null
  customerId?: string | null
  status?: 'posted' | 'voided' | 'all'
  search?: string
  createdBy?: string | null
  page?: number
  pageSize?: number
}

export async function listTransactions(businessId: string, filters: TransactionFilters) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  let query = supabase
    .from('v_transactions')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .gte('business_date', filters.from)
    .lte('business_date', filters.to)
    .order('business_date', { ascending: false })
    .order('occurred_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (filters.kinds?.length) query = query.in('kind', filters.kinds)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.paymentMethodId) query = query.eq('payment_method_id', filters.paymentMethodId)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
  if (!filters.status || filters.status === 'posted') query = query.eq('status', 'posted')
  else if (filters.status === 'voided') query = query.eq('status', 'voided')
  const search = filters.search?.trim()
  if (search) {
    const digits = search.replace(/\D/g, '')
    const clauses = [
      `description.ilike.%${search}%`,
      `customer_name.ilike.%${search}%`,
      `vendor.ilike.%${search}%`,
      `invoice_number.ilike.%${search}%`,
    ]
    if (digits) clauses.push(`reference_no.eq.${Number(digits)}`)
    query = query.or(clauses.join(','))
  }
  return select<TransactionRow>(query)
}

export const getTransaction = async (id: string): Promise<TransactionRow | null> => {
  const { data, error } = await supabase.from('v_transactions').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as TransactionRow) ?? null
}

export const recordIncome = (args: {
  businessId: string; amount: string; categoryId: string; paymentMethodId: string; idempotencyKey: string
  businessDate?: string | null; customerId?: string | null; description?: string | null; notes?: string | null
}) =>
  rpc<TransactionRow>('record_income', {
    p_business_id: args.businessId, p_amount: args.amount, p_category_id: args.categoryId,
    p_payment_method_id: args.paymentMethodId, p_idempotency_key: args.idempotencyKey,
    p_business_date: args.businessDate ?? null, p_customer_id: args.customerId ?? null,
    p_description: args.description ?? null, p_notes: args.notes ?? null,
  })

export const recordExpense = (args: {
  businessId: string; amount: string; categoryId: string; paymentMethodId: string; idempotencyKey: string
  businessDate?: string | null; vendor?: string | null; description?: string | null; notes?: string | null
}) =>
  rpc<TransactionRow>('record_expense', {
    p_business_id: args.businessId, p_amount: args.amount, p_category_id: args.categoryId,
    p_payment_method_id: args.paymentMethodId, p_idempotency_key: args.idempotencyKey,
    p_business_date: args.businessDate ?? null, p_vendor: args.vendor ?? null,
    p_description: args.description ?? null, p_notes: args.notes ?? null,
  })

export const recordRefund = (args: {
  transactionId: string; amount: string; paymentMethodId: string; reason: string; idempotencyKey: string; businessDate?: string | null
}) =>
  rpc<TransactionRow>('record_refund', {
    p_transaction_id: args.transactionId, p_amount: args.amount, p_payment_method_id: args.paymentMethodId,
    p_reason: args.reason, p_idempotency_key: args.idempotencyKey, p_business_date: args.businessDate ?? null,
  })

export const recordTransfer = (args: {
  businessId: string; fromMethodId: string; toMethodId: string; amount: string; idempotencyKey: string
  businessDate?: string | null; notes?: string | null
}) =>
  rpc<{ transfer_group_id: string; out_id: string; in_id: string; business_date: string }>('record_transfer', {
    p_business_id: args.businessId, p_from_method_id: args.fromMethodId, p_to_method_id: args.toMethodId,
    p_amount: args.amount, p_idempotency_key: args.idempotencyKey, p_business_date: args.businessDate ?? null,
    p_notes: args.notes ?? null,
  })

export const recordOwnerMovement = (args: {
  businessId: string; direction: 'deposit' | 'withdrawal'; amount: string; paymentMethodId: string
  idempotencyKey: string; businessDate?: string | null; notes?: string | null
}) =>
  rpc<TransactionRow>('record_owner_movement', {
    p_business_id: args.businessId, p_direction: args.direction, p_amount: args.amount,
    p_payment_method_id: args.paymentMethodId, p_idempotency_key: args.idempotencyKey,
    p_business_date: args.businessDate ?? null, p_notes: args.notes ?? null,
  })

export const updateTransaction = (transactionId: string, patch: Record<string, unknown>, reason?: string) =>
  rpc<TransactionRow>('update_transaction', { p_transaction_id: transactionId, p_patch: patch, p_reason: reason ?? null })

export const voidTransaction = (transactionId: string, reason: string) =>
  rpc<TransactionRow[]>('void_transaction', { p_transaction_id: transactionId, p_reason: reason })

/* Dashboard and reports ----------------------------------------------------- */
export const getDashboard = (businessId: string) => rpc<DashboardSummary>('get_dashboard_summary', { p_business_id: businessId })
export const getCashflow = (businessId: string, from: string, to: string) =>
  rpc<{ day: string; income: number; expenses: number; net: number }[]>('get_cashflow_series', {
    p_business_id: businessId, p_from: from, p_to: to,
  })
export const getReport = (businessId: string, from: string, to: string) =>
  rpc<ReportSummary>('get_report', { p_business_id: businessId, p_from: from, p_to: to })
export const exportTransactions = (businessId: string, from: string, to: string, includeVoided = false) =>
  rpc<Record<string, unknown>[]>('export_transactions', {
    p_business_id: businessId, p_from: from, p_to: to, p_kinds: null, p_include_voided: includeVoided,
  })
export const logExport = (businessId: string, from: string, to: string, rowCount: number) =>
  rpc<void>('log_export', { p_business_id: businessId, p_from: from, p_to: to, p_row_count: rowCount })

/* Xisaab Xir ---------------------------------------------------------------- */
export const getClosingPreview = (businessId: string, businessDate?: string) =>
  rpc<ClosingPreview>('get_closing_preview', { p_business_id: businessId, p_business_date: businessDate ?? null })

export const performClosing = (args: {
  businessId: string; businessDate: string; actuals: { payment_method_id: string; actual_amount: string }[]
  idempotencyKey: string; notes?: string | null; previewToken?: string | null
}) =>
  rpc<{
    closing_id: string; business_date: string; expected_total: number; actual_total: number
    difference_total: number; is_balanced: boolean; next_business_date: string
  }>('perform_closing', {
    p_business_id: args.businessId, p_business_date: args.businessDate, p_actuals: args.actuals,
    p_idempotency_key: args.idempotencyKey, p_notes: args.notes ?? null, p_preview_token: args.previewToken ?? null,
  })

export const reopenClosing = (closingId: string, reason: string) =>
  rpc<{ closing_id: string }>('reopen_closing', { p_closing_id: closingId, p_reason: reason })

export const getClosingDetail = (closingId: string) => rpc<ClosingDetail>('get_closing_detail', { p_closing_id: closingId })

export const setOpeningBalances = (businessId: string, goLiveDate: string, balances: { payment_method_id: string; amount: string }[]) =>
  rpc<{ closing_id: string; total: number }>('set_opening_balances', {
    p_business_id: businessId, p_go_live_date: goLiveDate, p_balances: balances,
  })

export async function listClosings(businessId: string, filters: { from: string; to: string; page?: number; pageSize?: number }) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  return select<ClosingRow>(
    supabase
      .from('v_closings')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .eq('kind', 'daily')
      .gte('business_date', filters.from)
      .lte('business_date', filters.to)
      .order('business_date', { ascending: false })
      .order('closed_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1),
  )
}

/* People -------------------------------------------------------------------- */
export async function listEmployees(businessId: string, filters: { status?: 'active' | 'inactive' | 'all'; search?: string } = {}) {
  let query = supabase.from('v_employees').select('*', { count: 'exact' }).eq('business_id', businessId).order('full_name')
  if (!filters.status || filters.status === 'active') query = query.eq('status', 'active')
  else if (filters.status === 'inactive') query = query.eq('status', 'inactive')
  if (filters.search?.trim()) query = query.or(`full_name.ilike.%${filters.search.trim()}%,position.ilike.%${filters.search.trim()}%`)
  return select<EmployeeRow>(query)
}

export const getEmployee = async (id: string): Promise<EmployeeRow | null> => {
  const { data, error } = await supabase.from('v_employees').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as EmployeeRow) ?? null
}

export const createEmployee = (args: {
  businessId: string; fullName: string; position: string; startDate: string; monthlySalary: string
  phone?: string | null; notes?: string | null
}) =>
  rpc<EmployeeRow>('create_employee', {
    p_business_id: args.businessId, p_full_name: args.fullName, p_position: args.position,
    p_start_date: args.startDate, p_monthly_salary: args.monthlySalary, p_phone: args.phone ?? null,
    p_notes: args.notes ?? null,
  })

export const updateEmployee = (employeeId: string, patch: Record<string, unknown>) =>
  rpc<EmployeeRow>('update_employee', { p_employee_id: employeeId, p_patch: patch })

export const changeEmployeeSalary = (employeeId: string, monthlySalary: string, effectiveMonth: string, reason?: string) =>
  rpc<{ monthly_salary: number; previous: number }>('change_employee_salary', {
    p_employee_id: employeeId, p_monthly_salary: monthlySalary, p_effective_month: effectiveMonth, p_reason: reason ?? null,
  })

export const setEmployeeStatus = (employeeId: string, status: 'active' | 'inactive', endDate?: string | null, reason?: string) =>
  rpc<EmployeeRow>('set_employee_status', {
    p_employee_id: employeeId, p_status: status, p_end_date: endDate ?? null, p_reason: reason ?? null,
  })

export const getSalaryOverview = (businessId: string, periodMonth: string) =>
  rpc<SalaryOverview>('get_salary_overview', { p_business_id: businessId, p_period_month: periodMonth })

export const paySalary = (args: {
  employeeId: string; periodMonth: string; amount: string; paymentMethodId: string; idempotencyKey: string
  paymentType?: 'salary' | 'advance' | 'adjustment'; businessDate?: string | null; notes?: string | null; reason?: string | null
}) =>
  rpc<{ salary_payment_id: string; transaction_id: string; reference_no: number; amount: number }>('pay_salary', {
    p_employee_id: args.employeeId, p_period_month: args.periodMonth, p_amount: args.amount,
    p_payment_method_id: args.paymentMethodId, p_idempotency_key: args.idempotencyKey,
    p_payment_type: args.paymentType ?? 'salary', p_business_date: args.businessDate ?? null,
    p_notes: args.notes ?? null, p_reason: args.reason ?? null,
  })

export async function listSalaryPayments(businessId: string, filters: { employeeId?: string; period?: string; page?: number; pageSize?: number } = {}) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  let query = supabase
    .from('v_salary_payments')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .order('business_date', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.period) query = query.eq('period_month', filters.period)
  return select<SalaryPaymentRow>(query)
}

/* Invoices ------------------------------------------------------------------ */
export async function listInvoices(businessId: string, filters: {
  from: string; to: string; status?: string; search?: string; customerId?: string; page?: number; pageSize?: number
}) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  let query = supabase
    .from('v_invoices')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .gte('issue_date', filters.from)
    .lte('issue_date', filters.to)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.search?.trim()) {
    query = query.or(`invoice_number.ilike.%${filters.search.trim()}%,bill_to_name.ilike.%${filters.search.trim()}%`)
  }
  return select<InvoiceRow>(query)
}

export const getInvoice = async (id: string) => {
  const [{ data: invoice, error }, items, payments] = await Promise.all([
    supabase.from('v_invoices').select('*').eq('id', id).maybeSingle(),
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position'),
    supabase.from('v_transactions').select('*').eq('invoice_id', id).order('occurred_at'),
  ])
  if (error) throw error
  if (items.error) throw items.error
  if (payments.error) throw payments.error
  return {
    invoice: (invoice as InvoiceRow) ?? null,
    items: (items.data ?? []) as InvoiceItem[],
    payments: (payments.data ?? []) as TransactionRow[],
  }
}

export const createInvoice = (args: {
  businessId: string
  items: { description: string; quantity: string; unit_price: string }[]
  incomeCategoryId: string
  idempotencyKey: string
  customerId?: string | null
  billToName?: string | null
  billToPhone?: string | null
  issueDate?: string | null
  dueDate?: string | null
  discountAmount?: string
  notes?: string | null
  payment?: { amount: string; payment_method_id: string; business_date?: string | null } | null
  linkTransactionId?: string | null
}) =>
  rpc<{ invoice_id: string; invoice_number: string; total: number; amount_paid: number; status: string }>('create_invoice', {
    p_business_id: args.businessId, p_items: args.items, p_income_category_id: args.incomeCategoryId,
    p_idempotency_key: args.idempotencyKey, p_customer_id: args.customerId ?? null,
    p_bill_to_name: args.billToName ?? null, p_bill_to_phone: args.billToPhone ?? null,
    p_issue_date: args.issueDate ?? null, p_due_date: args.dueDate ?? null,
    p_discount_amount: args.discountAmount ?? '0', p_notes: args.notes ?? null,
    p_payment: args.payment ?? null, p_link_transaction_id: args.linkTransactionId ?? null,
  })

export const recordInvoicePayment = (args: {
  invoiceId: string; amount: string; paymentMethodId: string; idempotencyKey: string; businessDate?: string | null; notes?: string | null
}) =>
  rpc<{ invoice_id: string; status: string; balance_due: number }>('record_invoice_payment', {
    p_invoice_id: args.invoiceId, p_amount: args.amount, p_payment_method_id: args.paymentMethodId,
    p_idempotency_key: args.idempotencyKey, p_business_date: args.businessDate ?? null, p_notes: args.notes ?? null,
  })

export const linkIncomeToInvoice = (invoiceId: string, transactionId: string) =>
  rpc<{ invoice_id: string; status: string }>('link_income_to_invoice', { p_invoice_id: invoiceId, p_transaction_id: transactionId })

export const cancelInvoice = (invoiceId: string, reason: string, voidPayments = false) =>
  rpc<InvoiceRow>('cancel_invoice', { p_invoice_id: invoiceId, p_reason: reason, p_void_payments: voidPayments })

export const updateInvoice = (invoiceId: string, patch: Record<string, unknown>) =>
  rpc<InvoiceRow>('update_invoice', { p_invoice_id: invoiceId, p_patch: patch })

/* Activity, settings and users ---------------------------------------------- */
export async function listAudit(businessId: string, filters: {
  from: string; to: string; module?: string; actorId?: string; page?: number; pageSize?: number
}) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 50
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .gte('created_at', `${filters.from}T00:00:00Z`)
    .lte('created_at', `${filters.to}T23:59:59Z`)
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (filters.module && filters.module !== 'all') query = query.eq('module', filters.module)
  if (filters.actorId) query = query.eq('actor_id', filters.actorId)
  return select<AuditRow>(query)
}

export const updateBusinessProfile = (businessId: string, patch: Record<string, unknown>) =>
  rpc<Record<string, unknown>>('update_business_profile', { p_business_id: businessId, p_patch: patch })

export const updateBusinessSettings = (businessId: string, patch: Record<string, unknown>) =>
  rpc<Record<string, unknown>>('update_business_settings', { p_business_id: businessId, p_patch: patch })

export const saveCategory = (businessId: string, data: Record<string, unknown>, categoryId?: string) =>
  rpc<Category>('save_category', { p_business_id: businessId, p_data: data, p_category_id: categoryId ?? null })

export const setCategoryStatus = (categoryId: string, status: 'active' | 'inactive') =>
  rpc<Category>('set_category_status', { p_category_id: categoryId, p_status: status })

export const savePaymentMethod = (businessId: string, data: Record<string, unknown>, methodId?: string) =>
  rpc<PaymentMethod>('save_payment_method', { p_business_id: businessId, p_data: data, p_method_id: methodId ?? null })

export const setPaymentMethodStatus = (methodId: string, status: 'active' | 'inactive') =>
  rpc<PaymentMethod>('set_payment_method_status', { p_method_id: methodId, p_status: status })

export const updateMyProfile = (patch: Record<string, unknown>) => rpc<Record<string, unknown>>('update_my_profile', { p_patch: patch })

export async function listMembers(businessId: string) {
  const { data, error } = await supabase
    .from('business_members')
    .select('*, profiles!user_id(full_name, phone)')
    .eq('business_id', businessId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as (MemberRow & { profiles: { full_name: string; phone: string | null } | null })[]
}

export const updateMember = (memberId: string, args: { role?: 'owner' | 'staff'; title?: string | null; permissionKeys?: string[] | null }) =>
  rpc<{ member_id: string }>('update_member', {
    p_member_id: memberId, p_role: args.role ?? null, p_title: args.title ?? null,
    p_permission_keys: args.permissionKeys ?? null,
  })

export const listPermissionCatalog = async (): Promise<PermissionRow[]> =>
  (await select<PermissionRow>(supabase.from('permissions').select('*').order('sort_order'))).rows

export const recordSignIn = (businessId: string) => rpc<void>('record_sign_in', { p_business_id: businessId })

export interface TransactionTotals {
  count: number
  income: number
  refunds: number
  expenses: number
  salaries: number
  money_in: number
  money_out: number
  net: number
  average: number
  top_category: { name: string; amount: number; share: number } | null
  by_method: { name: string; amount: number }[]
}

export const getTransactionTotals = (businessId: string, filters: TransactionFilters) =>
  rpc<TransactionTotals>('get_transaction_totals', {
    p_business_id: businessId,
    p_from: filters.from,
    p_to: filters.to,
    p_kinds: filters.kinds ?? null,
    p_category_id: filters.categoryId ?? null,
    p_payment_method_id: filters.paymentMethodId ?? null,
    p_status: filters.status ?? 'posted',
    p_search: filters.search ?? null,
  })
