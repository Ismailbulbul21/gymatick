// Artboard registry: order, page, frame width, optional fixed height.
import { dashboard, dashboardEmpty } from './screens/dashboard.mjs'
import { income, addIncome, expensesVoid, transactions } from './screens/ledger.mjs'
import { xisaabXir, closeConfirm, dayClosed, closingHistory, closingDetail } from './screens/closing.mjs'

export const PAGES = [
  { id: 'page-1', name: 'Dashboard & money' },
  { id: 'page-2', name: 'Xisaab Xir' },
  { id: 'page-3', name: 'People & billing' },
  { id: 'page-4', name: 'Reports & admin' },
  { id: 'page-5', name: 'Mobile' },
]

export const SCREENS = [
  { file: 'Main.dc.html', title: 'Dashboard', page: 'page-1', w: 1440, render: () => dashboard() },
  { file: 'DashboardDark.dc.html', title: 'Dashboard — dark theme (alternate)', page: 'page-1', w: 1440, render: () => dashboard({ dark: true }) },
  { file: 'DashboardNewGym.dc.html', title: 'Dashboard — new gym (empty state)', page: 'page-1', w: 1440, render: () => dashboardEmpty() },
  { file: 'Income.dc.html', title: 'Income — Lacagta Soo Gasha', page: 'page-1', w: 1440, newRow: true, render: () => income() },
  { file: 'AddIncome.dc.html', title: 'Add income (drawer)', page: 'page-1', w: 1440, h: 900, render: () => addIncome() },
  { file: 'ExpensesVoid.dc.html', title: 'Expenses — void confirmation', page: 'page-1', w: 1440, h: 900, render: () => expensesVoid() },
  { file: 'Transactions.dc.html', title: 'Transactions ledger', page: 'page-1', w: 1440, newRow: true, render: () => transactions() },
  { file: 'XisaabXir.dc.html', title: 'Xisaab Xir — count and close the day', page: 'page-2', w: 1440, render: () => xisaabXir() },
  { file: 'CloseConfirm.dc.html', title: 'Xisaab Xir — confirm closing', page: 'page-2', w: 1440, h: 900, render: () => closeConfirm() },
  { file: 'DayClosed.dc.html', title: 'Xisaab Xir — day closed', page: 'page-2', w: 1440, render: () => dayClosed() },
  { file: 'ClosingHistory.dc.html', title: 'Closing history', page: 'page-2', w: 1440, newRow: true, render: () => closingHistory() },
  { file: 'ClosingDetail.dc.html', title: 'Closing detail — corrected after closing', page: 'page-2', w: 1440, render: () => closingDetail() },
]
