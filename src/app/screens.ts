import { FEATURES } from '@/lib/features'
import type { ComponentType } from 'react'

type ScreenModule = Promise<{ default: ComponentType }>

/** Every screen is its own chunk. The imports live in one place so the router can load
 *  them lazily and the app shell can fetch them ahead of time. */
export const screens = {
  login: () => import('@/features/auth/LoginPage'),
  forgotPassword: () => import('@/features/auth/ForgotPasswordPage'),
  resetPassword: () => import('@/features/auth/ResetPasswordPage'),
  setPassword: () => import('@/features/auth/SetPasswordPage'),
  onboarding: () => import('@/features/onboarding/OnboardingPage'),
  dashboard: () => import('@/features/dashboard/DashboardPage'),
  income: () => import('@/features/money/IncomePage'),
  expenses: () => import('@/features/money/ExpensesPage'),
  transactions: () => import('@/features/money/TransactionsPage'),
  xisaabXir: () => import('@/features/closings/XisaabXirPage'),
  closingHistory: () => import('@/features/closings/ClosingHistoryPage'),
  closingDetail: () => import('@/features/closings/ClosingDetailPage'),
  invoices: () => import('@/features/invoices/InvoicesPage'),
  invoiceNew: () => import('@/features/invoices/InvoiceNewPage'),
  invoiceDetail: () => import('@/features/invoices/InvoiceDetailPage'),
  invoicePrint: () => import('@/features/invoices/InvoicePrintPage'),
  customers: () => import('@/features/customers/CustomersPage'),
  employees: () => import('@/features/employees/EmployeesPage'),
  employeeDetail: () => import('@/features/employees/EmployeeDetailPage'),
  salaries: () => import('@/features/salaries/SalariesPage'),
  reports: () => import('@/features/reports/ReportsPage'),
  activity: () => import('@/features/activity/ActivityPage'),
  settings: () => import('@/features/settings/SettingsLayout'),
  businessSettings: () => import('@/features/settings/BusinessSettingsPage'),
  preferences: () => import('@/features/settings/PreferencesPage'),
  categories: () => import('@/features/settings/CategoriesPage'),
  paymentMethods: () => import('@/features/settings/PaymentMethodsPage'),
  users: () => import('@/features/settings/UsersPage'),
  profile: () => import('@/features/settings/ProfilePage'),
  notFound: () => import('@/features/system/NotFoundPage'),
} satisfies Record<string, () => ScreenModule>

/** Route `lazy` loader for a screen. */
export const lazyScreen = (load: () => ScreenModule) => async () => ({ Component: (await load()).default })

/** In-app screens, most used first. */
const IN_APP: (keyof typeof screens)[] = [
  'dashboard', 'income', 'expenses', 'xisaabXir', 'transactions', 'invoices', 'invoiceNew', 'invoiceDetail',
  'salaries', 'employees', 'employeeDetail', 'customers', 'reports', 'closingHistory', 'closingDetail', 'activity',
  'settings', 'businessSettings', 'preferences', 'categories', 'paymentMethods', 'users', 'profile', 'invoicePrint',
]

/** Downloads the in-app screens one at a time while the browser is idle, so opening a
 *  feature later never waits for code. Skipped when the device asks to save data. */
export function preloadScreens(): () => void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return () => undefined

  const queue = IN_APP.filter((name) => FEATURES.customers || name !== 'customers').map((name) => screens[name])
  let cancelled = false
  const schedule = (task: () => void) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: 3000 })
    else setTimeout(task, 300)
  }
  const next = () => {
    const load = queue.shift()
    if (cancelled || !load) return
    load()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) schedule(next)
      })
  }
  schedule(next)
  return () => {
    cancelled = true
  }
}
