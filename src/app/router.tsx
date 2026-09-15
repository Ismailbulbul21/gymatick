import { FEATURES } from '@/lib/features'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './AppShell'
import { RequireAuth, RequireBusiness, RequirePermission, Splash } from './guards'
import { screenData } from './prefetch'
import { lazyScreen as page, screens } from './screens'
import { RouteError } from '@/components/feedback/RouteError'

export const router = createBrowserRouter([
  { path: '/login', lazy: page(screens.login), errorElement: <RouteError /> },
  { path: '/forgot-password', lazy: page(screens.forgotPassword) },
  { path: '/reset-password', lazy: page(screens.resetPassword) },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <Splash />,
    children: [
      { path: '/set-password', lazy: page(screens.setPassword) },
      {
        element: <RequireBusiness />,
        children: [
          { path: '/onboarding', lazy: page(screens.onboarding) },
          {
            element: <AppShell />,
            errorElement: <RouteError />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: '/dashboard', loader: screenData.dashboard, lazy: page(screens.dashboard) },
              {
                path: '/income',
                element: <RequirePermission permission="income.view" what="income" />,
                children: [{ index: true, loader: screenData.income, lazy: page(screens.income) }],
              },
              {
                path: '/expenses',
                element: <RequirePermission permission="expenses.view" what="expenses" />,
                children: [{ index: true, loader: screenData.expenses, lazy: page(screens.expenses) }],
              },
              {
                path: '/transactions',
                element: <RequirePermission permission="transactions.view_all" what="the ledger" />,
                children: [{ index: true, loader: screenData.transactions, lazy: page(screens.transactions) }],
              },
              {
                path: '/xisaab-xir',
                element: <RequirePermission permission="closings.view" what="Xisaab Xir" />,
                children: [
                  { index: true, loader: screenData.xisaabXir, lazy: page(screens.xisaabXir) },
                  { path: 'history', lazy: page(screens.closingHistory) },
                  { path: ':closingId', lazy: page(screens.closingDetail) },
                ],
              },
              {
                path: '/invoices',
                element: <RequirePermission permission="invoices.view" what="invoices" />,
                children: [
                  { index: true, loader: screenData.invoices, lazy: page(screens.invoices) },
                  { path: 'new', loader: screenData.invoiceNew, lazy: page(screens.invoiceNew) },
                  { path: ':invoiceId', lazy: page(screens.invoiceDetail) },
                ],
              },
              ...(FEATURES.customers
                ? [
                    {
                      path: '/customers',
                      element: <RequirePermission permission="customers.view" what="customers" />,
                      children: [{ index: true, loader: screenData.customers, lazy: page(screens.customers) }],
                    },
                  ]
                : []),
              {
                path: '/employees',
                element: <RequirePermission permission="employees.view" what="employees" />,
                children: [
                  { index: true, loader: screenData.employees, lazy: page(screens.employees) },
                  { path: ':employeeId', lazy: page(screens.employeeDetail) },
                ],
              },
              {
                path: '/salaries',
                element: <RequirePermission permission="salaries.view" what="salaries" />,
                children: [{ index: true, loader: screenData.salaries, lazy: page(screens.salaries) }],
              },
              {
                path: '/reports',
                element: <RequirePermission permission="reports.view" what="reports" />,
                children: [{ index: true, loader: screenData.reports, lazy: page(screens.reports) }],
              },
              {
                path: '/activity',
                element: <RequirePermission permission="audit.view" what="the activity log" />,
                children: [{ index: true, loader: screenData.activity, lazy: page(screens.activity) }],
              },
              {
                path: '/settings',
                lazy: page(screens.settings),
                children: [
                  { index: true, element: <Navigate to="/settings/business" replace /> },
                  { path: 'business', lazy: page(screens.businessSettings) },
                  { path: 'preferences', lazy: page(screens.preferences) },
                  { path: 'categories', loader: screenData.categories, lazy: page(screens.categories) },
                  { path: 'payment-methods', loader: screenData.paymentMethods, lazy: page(screens.paymentMethods) },
                  { path: 'users', loader: screenData.users, lazy: page(screens.users) },
                  { path: 'profile', lazy: page(screens.profile) },
                ],
              },
            ],
          },
          { path: '/invoices/:invoiceId/print', lazy: page(screens.invoicePrint) },
        ],
      },
    ],
  },
  { path: '*', lazy: page(screens.notFound) },
])
