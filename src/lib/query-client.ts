import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Permission and validation errors never succeed on retry.
        const message = (error as { message?: string })?.message ?? ''
        if (/^[A-Z_]+$/.test(message)) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
    // Money writes carry an idempotency key, so the person decides when to retry.
    mutations: { retry: 0 },
  },
})

export const queryKeys = {
  context: ['context'] as const,
  dashboard: (businessId: string) => ['dashboard', businessId] as const,
  cashflow: (businessId: string, from: string, to: string) => ['cashflow', businessId, from, to] as const,
  transactions: (businessId: string) => ['transactions', businessId] as const,
  transactionList: (businessId: string, filters: unknown) => ['transactions', businessId, 'list', filters] as const,
  transaction: (id: string) => ['transaction', id] as const,
  categories: (businessId: string) => ['categories', businessId] as const,
  paymentMethods: (businessId: string) => ['payment-methods', businessId] as const,
  customers: (businessId: string) => ['customers', businessId] as const,
  customerList: (businessId: string, filters: unknown) => ['customers', businessId, 'list', filters] as const,
  closingPreview: (businessId: string) => ['closing-preview', businessId] as const,
  closings: (businessId: string) => ['closings', businessId] as const,
  closingList: (businessId: string, filters: unknown) => ['closings', businessId, 'list', filters] as const,
  closing: (id: string) => ['closing', id] as const,
  salaryOverview: (businessId: string, period: string) => ['salary-overview', businessId, period] as const,
  salaryPayments: (businessId: string, filters: unknown) => ['salary-payments', businessId, filters] as const,
  employees: (businessId: string) => ['employees', businessId] as const,
  employeeList: (businessId: string, filters: unknown) => ['employees', businessId, 'list', filters] as const,
  employee: (id: string) => ['employee', id] as const,
  invoices: (businessId: string) => ['invoices', businessId] as const,
  invoiceList: (businessId: string, filters: unknown) => ['invoices', businessId, 'list', filters] as const,
  invoice: (id: string) => ['invoice', id] as const,
  report: (businessId: string, from: string, to: string) => ['report', businessId, from, to] as const,
  audit: (businessId: string, filters: unknown) => ['audit', businessId, filters] as const,
  members: (businessId: string) => ['members', businessId] as const,
  permissionsCatalog: ['permissions-catalog'] as const,
}

/** After money changes, everything derived from the ledger is refreshed. */
export function invalidateMoney(_businessId?: string): void {
  const keys = ['transactions', 'dashboard', 'cashflow', 'closing-preview', 'closings', 'report', 'audit',
    'invoices', 'invoice', 'salary-overview', 'salary-payments', 'employee', 'customers']
  for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] })
}
