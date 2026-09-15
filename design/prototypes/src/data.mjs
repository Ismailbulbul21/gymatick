// Sample data for the prototypes (SAMPLE — not real people or figures).
// All totals are internally consistent: dashboard, income, expenses, reports,
// Xisaab Xir and closing history reconcile to the cent.

export const TODAY = { label: 'Monday, 14 September 2026', short: 'Mon, 14 Sep 2026', date: '14 Sep 2026' }

export const OWNER = { name: 'Abdirahman Yusuf', initials: 'AY', role: 'Owner', color: '#2449dc' }
export const MANAGER = { name: 'Farhiya Omar', initials: 'FO', role: 'Staff · Manager', color: '#7c3aed' }
export const FRONTDESK = { name: 'Mahad Warsame', initials: 'MW', role: 'Staff · Front desk', color: '#0e7490' }

export const METHODS = [
  { key: 'cash', name: 'Cash', icon: 'banknote', color: 'var(--m1)' },
  { key: 'evc', name: 'EVC Plus', icon: 'smartphone', color: 'var(--m2)' },
  { key: 'zaad', name: 'ZAAD', icon: 'smartphone', color: 'var(--m3)' },
  { key: 'sahal', name: 'SAHAL', icon: 'smartphone', color: 'var(--m4)' },
  { key: 'bank', name: 'Bank', icon: 'landmark', color: 'var(--m5)' },
]

export const CAT_COLORS = {
  Membership: '#2a78d6', 'Personal Training': '#4a3aa7', Registration: '#eb6834', 'Gym Services': '#1baf7a',
  Products: '#eda100', 'Other Income': '#64748b', Electricity: '#eda100', Cleaning: '#1baf7a', Maintenance: '#eb6834',
  Salary: '#4a3aa7', Rent: '#2a78d6', Equipment: '#e87ba4', Supplies: '#0ea5e9', Marketing: '#64748b', Water: '#0ea5e9', Internet: '#64748b',
}

// Today's ledger (14 Sep 2026). kind: in | out. ref numbers are sequential.
export const TODAY_TX = [
  { ref: 'TX-004839', time: '20:20', kind: 'out', salary: true, desc: 'Salary advance · September', who: 'Hodan Ali', cat: 'Salary', method: 'Cash', amount: 60.0, by: 'Farhiya Omar' },
  { ref: 'TX-004838', time: '20:05', kind: 'in', desc: 'Locker rental', who: 'Zakariye Ali', cat: 'Gym Services', method: 'Cash', amount: 8.0, by: 'Farhiya Omar' },
  { ref: 'TX-004837', time: '19:30', kind: 'in', desc: 'Monthly membership', who: 'Hamdi Osman', cat: 'Membership', method: 'SAHAL', amount: 35.0, by: 'Farhiya Omar' },
  { ref: 'TX-004836', time: '18:55', kind: 'in', desc: 'Personal training · 5 sessions', who: 'Bashir Ismail', cat: 'Personal Training', method: 'EVC Plus', amount: 60.0, by: 'Mahad Warsame' },
  { ref: 'TX-004835', time: '18:10', kind: 'in', desc: 'Day pass', who: 'Walk-in', cat: 'Gym Services', method: 'Cash', amount: 5.0, by: 'Mahad Warsame' },
  { ref: 'TX-004834', time: '17:40', kind: 'in', desc: 'Annual membership', who: 'Ahmed Farah', cat: 'Membership', method: 'Cash', amount: 250.0, by: 'Farhiya Omar', invoice: 'INV-2026-00148' },
  { ref: 'TX-004833', time: '16:05', kind: 'in', desc: '3-month membership', who: 'Sahra Mohamed', cat: 'Membership', method: 'EVC Plus', amount: 95.0, by: 'Farhiya Omar' },
  { ref: 'TX-004832', time: '14:00', kind: 'out', desc: 'Treadmill belt repair', who: 'FixIt Workshop', cat: 'Maintenance', method: 'ZAAD', amount: 40.0, by: 'Abdirahman Yusuf' },
  { ref: 'TX-004830/31', time: '13:30', kind: 'transfer', desc: 'Cash deposited to bank', who: 'Bank agent', cat: null, method: 'Cash → Bank', amount: 300.0, by: 'Abdirahman Yusuf' },
  { ref: 'TX-004829', time: '12:16', kind: 'out', desc: 'Cleaning supplies', who: 'Local market', cat: 'Cleaning', method: 'Cash', amount: 18.0, by: 'Mahad Warsame', voided: true },
  { ref: 'TX-004828', time: '12:15', kind: 'out', desc: 'Cleaning supplies', who: 'Local market', cat: 'Cleaning', method: 'Cash', amount: 18.0, by: 'Mahad Warsame' },
  { ref: 'TX-004827', time: '11:20', kind: 'in', desc: 'Protein shake & water', who: 'Walk-in', cat: 'Products', method: 'Cash', amount: 12.5, by: 'Mahad Warsame' },
  { ref: 'TX-004826', time: '09:30', kind: 'out', desc: 'Electricity bill · August', who: 'Power supplier', cat: 'Electricity', method: 'EVC Plus', amount: 85.0, by: 'Farhiya Omar' },
  { ref: 'TX-004825', time: '09:10', kind: 'in', desc: 'Monthly membership', who: 'Ifrah Dahir', cat: 'Membership', method: 'Cash', amount: 35.0, by: 'Mahad Warsame' },
  { ref: 'TX-004824', time: '08:15', kind: 'in', desc: 'Registration fee', who: 'Ifrah Dahir', cat: 'Registration', method: 'Cash', amount: 10.0, by: 'Mahad Warsame' },
  { ref: 'TX-004823', time: '07:30', kind: 'in', desc: 'Personal training · 10 sessions', who: 'Omar Jama', cat: 'Personal Training', method: 'ZAAD', amount: 120.0, by: 'Mahad Warsame', invoice: 'INV-2026-00147' },
  { ref: 'TX-004822', time: '07:05', kind: 'in', desc: 'Monthly membership', who: 'Najma Hussein', cat: 'Membership', method: 'Cash', amount: 35.0, by: 'Mahad Warsame' },
  { ref: 'TX-004821', time: '06:40', kind: 'in', desc: 'Monthly membership', who: 'Liban Abdi', cat: 'Membership', method: 'EVC Plus', amount: 35.0, by: 'Mahad Warsame' },
]

// Totals for today (posted only)
export const TODAY_TOTALS = { income: 700.5, expenses: 203.0, salaries: 60.0, net: 497.5, count: 17, payments: 12 }

// Xisaab Xir lines for 14 Sep (opening = counted at 13 Sep closing).
// In/out per method include the $300 Cash → Bank transfer, which nets to zero in totals.
export const CLOSING_LINES = [
  { method: 'Cash', opening: 412.0, in: 355.5, out: 378.0, expected: 389.5, actual: 374.5 },
  { method: 'EVC Plus', opening: 1236.4, in: 190.0, out: 85.0, expected: 1341.4, actual: 1341.4 },
  { method: 'ZAAD', opening: 318.0, in: 120.0, out: 40.0, expected: 398.0, actual: 398.0 },
  { method: 'SAHAL', opening: 96.5, in: 35.0, out: 0.0, expected: 131.5, actual: 131.5 },
  { method: 'Bank', opening: 2450.0, in: 300.0, out: 0.0, expected: 2750.0, actual: 2750.0 },
]
export const CLOSING_TOTALS = { opening: 4512.9, in: 700.5, out: 203.0, expected: 5010.4, actual: 4995.4, diff: -15.0 }

// 7-day cash flow (dashboard) and month-to-date series (reports)
export const DAYS = [
  { d: '1 Sep', w: 'Tue', income: 1240.0, expenses: 1275.0 },
  { d: '2 Sep', w: 'Wed', income: 865.5, expenses: 96.0 },
  { d: '3 Sep', w: 'Thu', income: 610.0, expenses: 120.0 },
  { d: '4 Sep', w: 'Fri', income: 402.0, expenses: 0.0 },
  { d: '5 Sep', w: 'Sat', income: 435.5, expenses: 200.0 },
  { d: '6 Sep', w: 'Sun', income: 497.5, expenses: 160.0 },
  { d: '7 Sep', w: 'Mon', income: 588.5, expenses: 156.0 },
  { d: '8 Sep', w: 'Tue', income: 402.0, expenses: 214.0 },
  { d: '9 Sep', w: 'Wed', income: 731.5, expenses: 150.0 },
  { d: '10 Sep', w: 'Thu', income: 694.0, expenses: 810.0 },
  { d: '11 Sep', w: 'Fri', income: 315.5, expenses: 80.0 },
  { d: '12 Sep', w: 'Sat', income: 548.5, expenses: 180.0 },
  { d: '13 Sep', w: 'Sun', income: 612.0, expenses: 204.5 },
  { d: '14 Sep', w: 'Mon', income: 700.5, expenses: 203.0 },
].map((x) => ({ ...x, net: Math.round((x.income - x.expenses) * 100) / 100 }))

export const MONTH = {
  income: 8643.0, expenses: 3848.5, salaries: 520.0, net: 4794.5, transactions: 238, payments: 196, expenseCount: 41,
  avgDaily: 617.36, outstanding: 415.0, outstandingCount: 6, closingDiff: -3.0, refunds: 35.0,
  prev: { income: 7690.0, expenses: 3972.0, net: 3718.0 },
}

export const EXPENSE_CATS = [
  ['Rent', 1200.0, 31.2], ['Equipment', 610.0, 15.9], ['Salary', 520.0, 13.5], ['Electricity', 385.0, 10.0],
  ['Maintenance', 298.0, 7.7], ['Cleaning', 214.5, 5.6], ['Supplies', 196.0, 5.1], ['Marketing', 150.0, 3.9], ['Other (3 categories)', 275.0, 7.1],
]
export const INCOME_CATS = [
  ['Membership', 5420.0, 62.7], ['Personal Training', 1890.0, 21.9], ['Gym Services', 512.0, 5.9],
  ['Registration', 420.0, 4.9], ['Products', 366.0, 4.2], ['Other Income', 35.0, 0.4],
]
export const METHOD_MONTH = [
  ['Cash', 3306.0, 1012.5, 38.3], ['EVC Plus', 3544.5, 1506.0, 41.0], ['ZAAD', 1118.0, 820.0, 12.9], ['SAHAL', 674.5, 60.0, 7.8], ['Bank', 0.0, 450.0, 0.0],
]

export const CLOSINGS = [
  { date: '14 Sep', day: 'Mon', opening: 4512.9, income: 700.5, expenses: 203.0, expected: 5010.4, actual: 4995.4, diff: -15.0, status: 'Difference', by: 'Abdirahman Yusuf', at: '21:04', note: 'Cash short' },
  { date: '13 Sep', day: 'Sun', opening: 4105.4, income: 612.0, expenses: 204.5, expected: 4512.9, actual: 4512.9, diff: 0, status: 'Balanced', by: 'Farhiya Omar', at: '21:12' },
  { date: '12 Sep', day: 'Sat', opening: 3736.9, income: 548.5, expenses: 180.0, expected: 4105.4, actual: 4105.4, diff: 0, status: 'Balanced', by: 'Farhiya Omar', at: '21:05' },
  { date: '11 Sep', day: 'Fri', opening: 3501.4, income: 315.5, expenses: 80.0, expected: 3736.9, actual: 3736.9, diff: 0, status: 'Balanced', by: 'Abdirahman Yusuf', at: '19:40' },
  { date: '10 Sep', day: 'Thu', opening: 3622.4, income: 694.0, expenses: 810.0, expected: 3506.4, actual: 3501.4, diff: -5.0, status: 'Difference', by: 'Farhiya Omar', at: '21:18' },
  { date: '9 Sep', day: 'Wed', opening: 3040.9, income: 731.5, expenses: 150.0, expected: 3622.4, actual: 3622.4, diff: 0, status: 'Balanced', by: 'Farhiya Omar', at: '21:09' },
  { date: '8 Sep', day: 'Tue', opening: 2850.9, income: 402.0, expenses: 214.0, expected: 3038.9, actual: 3040.9, diff: 2.0, status: 'Difference', by: 'Abdirahman Yusuf', at: '20:55' },
  { date: '7 Sep', day: 'Mon', opening: 2418.4, income: 588.5, expenses: 156.0, expected: 2850.9, actual: 2850.9, diff: 0, status: 'Difference', corrected: true, note: '2 methods differed', by: 'Farhiya Omar', at: '21:02' },
  { date: '6 Sep', day: 'Sun', opening: 2080.9, income: 497.5, expenses: 160.0, expected: 2418.4, actual: 2418.4, diff: 0, status: 'Balanced', by: 'Farhiya Omar', at: '21:15' },
  { date: '5 Sep', day: 'Sat', opening: 1845.4, income: 435.5, expenses: 200.0, expected: 2080.9, actual: 2080.9, diff: 0, status: 'Balanced', by: 'Abdirahman Yusuf', at: '22:31' },
  { date: '5 Sep', day: 'Sat', opening: 1845.4, income: 400.5, expenses: 200.0, expected: 2045.9, actual: 2080.9, diff: 35.0, status: 'Reopened', by: 'Farhiya Omar', at: '21:10' },
]

export const EMPLOYEES = [
  { name: 'Abdi Hassan', initials: 'AH', color: '#2a78d6', position: 'Head Trainer', salary: 450, paid: 0, start: '3 Feb 2025', status: 'Active', last: '31 Aug · EVC Plus' },
  { name: 'Farhiya Omar', initials: 'FO', color: '#7c3aed', position: 'Front Desk Manager', salary: 350, paid: 100, start: '15 Jun 2024', status: 'Active', last: '5 Sep · Cash' },
  { name: 'Mahad Warsame', initials: 'MW', color: '#0e7490', position: 'Trainer', salary: 380, paid: 0, start: '1 Oct 2025', status: 'Active', last: '31 Aug · EVC Plus' },
  { name: 'Yasmin Aden', initials: 'YA', color: '#be185d', position: 'Trainer', salary: 360, paid: 360, start: '10 Mar 2025', status: 'Active', last: '10 Sep · EVC Plus' },
  { name: 'Hodan Ali', initials: 'HA', color: '#b45309', position: 'Cleaner', salary: 180, paid: 60, start: '1 Sep 2026', status: 'Active', last: '14 Sep · Cash' },
  { name: 'Khalid Nur', initials: 'KN', color: '#475467', position: 'Security', salary: 200, paid: 0, start: '20 Jan 2026', status: 'Active', last: '31 Aug · Cash' },
  { name: 'Sagal Mire', initials: 'SM', color: '#98a2b3', position: 'Receptionist', salary: 250, paid: null, start: '5 Jan 2025', status: 'Inactive', last: '31 Jul · Cash' },
]
export const SALARY_TOTALS = { obligations: 1920, paid: 520, pending: 1400, employees: 6, unpaidEmployees: 5 }

export const INVOICES = [
  { no: 'INV-2026-00148', customer: 'Ahmed Farah', issued: '14 Sep', due: '—', total: 250, paid: 250, status: 'Paid' },
  { no: 'INV-2026-00147', customer: 'Omar Jama', issued: '14 Sep', due: '—', total: 120, paid: 120, status: 'Paid' },
  { no: 'INV-2026-00146', customer: 'Muna Abdullahi', issued: '13 Sep', due: '20 Sep', total: 95, paid: 0, status: 'Pending' },
  { no: 'INV-2026-00145', customer: 'Liban Abdi', issued: '12 Sep', due: '19 Sep', total: 180, paid: 90, status: 'Partially paid' },
  { no: 'INV-2026-00144', customer: 'Najma Hussein', issued: '12 Sep', due: '—', total: 35, paid: 35, status: 'Paid' },
  { no: 'INV-2026-00143', customer: 'Walk-in customer', issued: '11 Sep', due: '—', total: 12.5, paid: 12.5, status: 'Paid' },
  { no: 'INV-2026-00142', customer: 'Bashir Ismail', issued: '10 Sep', due: '12 Sep', total: 60, paid: 0, status: 'Pending', overdue: true },
  { no: 'INV-2026-00141', customer: 'Ifrah Dahir', issued: '9 Sep', due: '—', total: 45, paid: 45, status: 'Paid' },
  { no: 'INV-2026-00140', customer: 'Hamdi Osman', issued: '8 Sep', due: '10 Sep', total: 70, paid: 0, status: 'Pending', overdue: true },
  { no: 'INV-2026-00139', customer: 'Zakariye Ali', issued: '7 Sep', due: '—', total: 35, paid: 0, status: 'Cancelled' },
]

export const money = (v, { sign = false, dp = 2 } = {}) => {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  if (!sign) return (v < 0 ? '−$' : '$') + abs
  if (v === 0) return '$' + abs
  return (v > 0 ? '+$' : '−$') + abs
}
