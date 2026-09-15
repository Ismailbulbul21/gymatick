import type { LoaderFunction } from 'react-router'
import {
  getCashflow, getClosingPreview, getDashboard, getReport, getSalaryOverview, getTransactionTotals, listAudit,
  listCategories, listCustomers, listEmployees, listInvoices, listMembers, listPaymentMethods, listPermissionCatalog,
  listTransactions,
} from '@/lib/api'
import { monthStart, presetRange } from '@/lib/dates'
import { activeMembership } from '@/lib/membership'
import { queryClient, queryKeys } from '@/lib/query-client'
import type { Membership, SessionContext, TransactionKind } from '@/types/db'

/** Longest a click waits for a screen's data before opening it with loading placeholders. */
const MAX_WAIT_MS = 800

type Can = (permission: string) => boolean
type Job = Promise<unknown> | false
type Jobs = (business: Membership, can: Can) => Job[]

const ensure = <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>): Promise<T> =>
  queryClient.ensureQueryData({ queryKey, queryFn })

/** Route loader that fetches what a screen shows first, so the screen opens complete instead of
 *  flashing loading placeholders. It never holds a click for long, and does nothing before the
 *  session has loaded (the first page load keeps its splash screen). The query keys match the
 *  screens' own queries, so the screens read straight from the cache. */
function screenLoader(jobs: Jobs): LoaderFunction {
  return async () => {
    const business = activeMembership(queryClient.getQueryData<SessionContext>(queryKeys.context))
    if (!business) return null
    const permissions = new Set(business.permissions)
    const pending = jobs(business, (permission) => permissions.has(permission))
      .filter((job): job is Promise<unknown> => job !== false)
      .map((job) => job.catch(() => undefined))
    await Promise.race([Promise.all(pending), new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS))])
    return null
  }
}

const formLists = (id: string): Job[] => [
  ensure(queryKeys.categories(id), () => listCategories(id)),
  ensure(queryKeys.paymentMethods(id), () => listPaymentMethods(id)),
]

/** The default view of TransactionsScreen: this month, posted entries, first page. */
function transactionsView(business: Membership, kinds: TransactionKind[] | undefined): Job[] {
  const id = business.business_id
  const range = presetRange('this_month', business.business_date, business.settings.week_starts_on)
  const filters = {
    from: range.from,
    to: range.to,
    kinds,
    categoryId: null,
    paymentMethodId: null,
    status: 'posted' as const,
    search: '',
    page: 0,
    pageSize: 25,
  }
  return [
    ...formLists(id),
    ensure(queryKeys.transactionList(id, filters), () => listTransactions(id, filters)),
    ensure([...queryKeys.transactions(id), 'totals', filters], () => getTransactionTotals(id, filters)),
  ]
}

export const screenData = {
  dashboard: screenLoader((business, can) => {
    const id = business.business_id
    const today = business.business_date
    const chart = presetRange('last_7', today, business.settings.week_starts_on)
    const since = presetRange('last_30', today).from
    const month = monthStart(today)
    return [
      ensure(queryKeys.dashboard(id), () => getDashboard(id)),
      can('income.view') && can('expenses.view') && ensure(queryKeys.cashflow(id, chart.from, chart.to), () => getCashflow(id, chart.from, chart.to)),
      (can('income.view') || can('expenses.view')) &&
        ensure([...queryKeys.transactions(id), 'recent'], () => listTransactions(id, { from: since, to: today, pageSize: 7 })),
      can('invoices.view') && ensure([...queryKeys.invoices(id), 'recent'], () => listInvoices(id, { from: since, to: today, pageSize: 4 })),
      can('salaries.view') && ensure(queryKeys.salaryOverview(id, month), () => getSalaryOverview(id, month)),
    ]
  }),
  income: screenLoader((business, can) => (can('income.view') ? transactionsView(business, ['income', 'refund']) : [])),
  expenses: screenLoader((business, can) => (can('expenses.view') ? transactionsView(business, ['expense']) : [])),
  transactions: screenLoader((business, can) =>
    can('transactions.view_all')
      ? [
          ...transactionsView(business, undefined),
          can('dashboard.financials') && ensure(queryKeys.dashboard(business.business_id), () => getDashboard(business.business_id)),
        ]
      : [],
  ),
  xisaabXir: screenLoader((business, can) =>
    can('closings.view') ? [ensure(queryKeys.closingPreview(business.business_id), () => getClosingPreview(business.business_id))] : [],
  ),
  invoices: screenLoader((business, can) => {
    if (!can('invoices.view')) return []
    const id = business.business_id
    const range = presetRange('this_month', business.business_date, business.settings.week_starts_on)
    const view = { ...range, status: 'all' as const, search: '', page: 0 }
    return [ensure(queryKeys.invoiceList(id, view), () => listInvoices(id, { ...view, pageSize: 25 }))]
  }),
  invoiceNew: screenLoader((business, can) =>
    can('invoices.create')
      ? [...formLists(business.business_id), ensure(queryKeys.customers(business.business_id), () => listCustomers(business.business_id))]
      : [],
  ),
  customers: screenLoader((business, can) =>
    can('customers.view')
      ? [ensure(queryKeys.customerList(business.business_id, { search: '' }), () => listCustomers(business.business_id, '', 100))]
      : [],
  ),
  employees: screenLoader((business, can) =>
    can('employees.view')
      ? [
          ensure(queryKeys.employeeList(business.business_id, { status: 'active', search: '' }), () =>
            listEmployees(business.business_id, { status: 'active', search: '' }),
          ),
        ]
      : [],
  ),
  salaries: screenLoader((business, can) => {
    const month = monthStart(business.business_date)
    return can('salaries.view')
      ? [ensure(queryKeys.salaryOverview(business.business_id, month), () => getSalaryOverview(business.business_id, month))]
      : []
  }),
  reports: screenLoader((business, can) => {
    const range = presetRange('this_month', business.business_date, business.settings.week_starts_on)
    return can('reports.view')
      ? [ensure(queryKeys.report(business.business_id, range.from, range.to), () => getReport(business.business_id, range.from, range.to))]
      : []
  }),
  activity: screenLoader((business, can) => {
    if (!can('audit.view')) return []
    const id = business.business_id
    const range = presetRange('last_7', business.business_date, business.settings.week_starts_on)
    return [
      ensure(queryKeys.audit(id, { ...range, module: 'all', actorId: '', page: 0 }), () =>
        listAudit(id, { ...range, module: 'all', actorId: undefined, page: 0, pageSize: 50 }),
      ),
      ensure(queryKeys.members(id), () => listMembers(id)),
    ]
  }),
  categories: screenLoader((business, can) =>
    can('settings.manage') ? [ensure(queryKeys.categories(business.business_id), () => listCategories(business.business_id))] : [],
  ),
  paymentMethods: screenLoader((business, can) =>
    can('settings.manage')
      ? [
          ensure(queryKeys.paymentMethods(business.business_id), () => listPaymentMethods(business.business_id)),
          can('dashboard.financials') && ensure(queryKeys.dashboard(business.business_id), () => getDashboard(business.business_id)),
        ]
      : [],
  ),
  users: screenLoader((business, can) =>
    can('users.manage')
      ? [
          ensure(queryKeys.members(business.business_id), () => listMembers(business.business_id)),
          ensure(queryKeys.permissionsCatalog, listPermissionCatalog),
        ]
      : [],
  ),
}
