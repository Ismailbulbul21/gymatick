import { icon } from '../icons.mjs'
import { shell, pageHeader, btn, badge, avatar, statCard, delta, catLabel } from '../components.mjs'
import { cashflowChart, legend, stackedBalance, THEME } from '../charts.mjs'
import { DAYS, TODAY_TX, TODAY_TOTALS, CLOSING_LINES, CLOSING_TOTALS, EMPLOYEES, INVOICES, CAT_COLORS, money } from '../data.mjs'

function balanceHero(parts, total, caption) {
  return `<div class="card stat" style="background:#0f1b44;border-color:#0f1b44;color:#fff;box-shadow:0 12px 28px -16px rgba(15,27,68,.9)">
    <div class="stat-top"><span class="stat-l" style="color:#c9d3ee">Current balance</span><span class="ico" style="background:rgba(255,255,255,.08);color:#9fb6ff">${icon('wallet', 20)}</span></div>
    <div class="stat-v" style="color:#fff">${total}</div>
    <div class="xs" style="color:#9aa8cc;margin-top:-4px">${caption}</div>
    <div style="--text:#ffffff;--text-2:#c9d3ee">${stackedBalance(parts, 'dark', { legendCols: 5, stacked: true })}</div>
  </div>`
}

function header(greeting, statusBadge) {
  return pageHeader(
    greeting,
    `<div class="row" style="gap:10px;margin-top:2px"><span>Monday, 14 September 2026</span>${statusBadge}</div>`,
    `${btn('Add income', { kind: 'primary', ic: 'plus' })}${btn('Add expense', { ic: 'arrow-up-right' })}${btn('Xisaab Xir', { ic: 'calculator' })}`,
  )
}

function recentTransactions(rows) {
  return `<div class="card" style="overflow:hidden">
    <div class="card-h"><div><h3 class="card-t">Recent transactions</h3><div class="xs muted">17 posted today · 1 voided</div></div><a class="sm w6 row" style="gap:4px">View all ${icon('arrow-right', 16)}</a></div>
    <table class="tbl" style="margin-top:14px"><thead><tr><th>Description</th><th>Category</th><th>Method</th><th>Time</th><th class="r">Amount</th></tr></thead><tbody>
    ${rows
      .map(
        (t) => `<tr><td><div class="row" style="gap:12px"><span class="ico ${t.kind === 'in' ? 'in' : 'out'}" style="width:32px;height:32px;border-radius:9px">${icon(t.kind === 'in' ? 'arrow-down-left' : t.salary ? 'badge-dollar-sign' : 'arrow-up-right', 16)}</span><div class="col"><span class="t-main">${t.desc}</span><span class="xs muted">${t.who}${t.invoice ? ` · ${t.invoice}` : ''}</span></div></div></td><td>${catLabel(t.cat, CAT_COLORS[t.cat])}</td><td>${t.method}</td><td class="num">${t.time}</td><td class="amt ${t.kind === 'in' ? 'pos' : 'neg'}">${t.kind === 'in' ? '+' : '−'}${money(t.amount)}</td></tr>`,
      )
      .join('')}
    </tbody></table></div>`
}

function pendingSalaries() {
  const rows = EMPLOYEES.filter((e) => e.status === 'Active' && e.paid < e.salary)
    .map((e) => ({ ...e, remaining: e.salary - e.paid, pct: Math.round((e.paid / e.salary) * 100) }))
    .sort((a, b) => b.remaining - a.remaining)
  return `<div class="card" style="display:flex;flex-direction:column">
    <div class="card-h"><div><h3 class="card-t">Pending salaries</h3><div class="xs muted">September 2026</div></div>${badge('Pending')}</div>
    <div class="card-b col" style="gap:14px;flex:1">
      ${rows
        .map(
          (e) => `<div class="col" style="gap:8px"><div class="row" style="gap:10px">${avatar(e.initials, e.color)}<div class="col grow"><span class="sm w6">${e.name}</span><span class="xs muted">Paid ${money(e.paid, { dp: 0 })} of ${money(e.salary, { dp: 0 })}</span></div><span class="sm w7 num">${money(e.remaining)}</span></div><div class="prog"><span style="width:${e.pct}%"></span></div></div>`,
        )
        .join('')}
      <div class="divider" style="margin-top:auto"></div>
      <div class="row" style="justify-content:space-between"><span class="sm muted">Total pending</span><span class="w7 num">$1,400.00</span></div>
      ${btn('Pay salary', { ic: 'badge-dollar-sign', size: 'sm', style: 'width:100%' })}
    </div></div>`
}

function lastClosingCard() {
  const line = (label, value, strong = false, cls = '') =>
    `<div class="row" style="justify-content:space-between"><span class="sm ${strong ? 'w6' : 'muted'}">${label}</span><span class="sm num ${strong ? 'w7' : 'w6'} ${cls}">${value}</span></div>`
  return `<div class="card" style="display:flex;flex-direction:column">
    <div class="card-h"><div><h3 class="card-t">Last Xisaab Xir</h3><div class="xs muted">Sun, 13 Sep 2026 · closed 21:12</div></div>${badge('Balanced')}</div>
    <div class="card-b col" style="gap:10px;flex:1">
      ${line('Opening balance', '$4,105.40')}
      ${line('+ Money received', '$612.00')}
      ${line('− Money used', '$204.50')}
      <div class="divider"></div>
      ${line('Expected', '$4,512.90', true)}
      ${line('Counted', '$4,512.90', true)}
      <div class="row" style="justify-content:space-between;padding:10px 12px;border-radius:10px;background:var(--income-50)"><span class="sm w6 pos row" style="gap:6px">${icon('circle-check', 16)}Difference</span><span class="sm w7 num pos">$0.00</span></div>
      <div class="row" style="gap:8px;margin-top:4px">${avatar('FO', '#7c3aed', 's')}<span class="xs muted">Closed by Farhiya Omar · “Counted cash twice, EVC Plus checked in app.”</span></div>
      <div class="row" style="gap:8px;margin-top:auto;padding-top:6px">${btn('View closing', { size: 'sm', style: 'flex:1' })}${btn('History', { size: 'sm', kind: 'ghost', ic: 'history' })}</div>
    </div></div>`
}

function recentInvoices() {
  return `<div class="card" style="overflow:hidden"><div class="card-h"><div><h3 class="card-t">Recent invoices</h3><div class="xs muted">Unpaid this month: $415.00 across 6 invoices</div></div><a class="sm w6 row" style="gap:4px">All invoices ${icon('arrow-right', 16)}</a></div>
  <table class="tbl" style="margin-top:14px"><thead><tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>
  ${INVOICES.slice(0, 4)
    .map((v) => `<tr><td class="ref">${v.no}</td><td class="t-main">${v.customer}</td><td>${v.issued}</td><td>${badge(v.status)}</td><td class="amt" style="color:var(--text)">${money(v.total)}</td></tr>`)
    .join('')}
  </tbody></table></div>`
}

export function dashboard({ dark = false } = {}) {
  const theme = dark ? 'dark' : 'light'
  const t = THEME[theme]
  const parts = CLOSING_LINES.map((l) => ({ name: l.method, value: l.expected }))
  const week = DAYS.slice(-7)
  const inner = `
  ${header('Good evening, Abdirahman', `<span class="badge b-info"><span class="dot" style="background:var(--brand)"></span>Today is open · not closed yet</span>`)}
  <div class="grid kpi" style="grid-template-columns:repeat(3,minmax(0,1fr)) minmax(0,1.9fr)">
    ${statCard({ label: 'Income today', value: `<span class="pos">+${money(TODAY_TOTALS.income)}</span>`, ic: 'arrow-down-left', tone: 'in', caption: 'vs last Monday', delta: delta('19.0%', true, true), extra: '<span class="xs muted" style="margin-top:-6px">12 payments</span>' })}
    ${statCard({ label: 'Expenses today', value: `<span class="neg">${money(TODAY_TOTALS.expenses)}</span>`, ic: 'arrow-up-right', tone: 'out', caption: 'incl. $60.00 salaries' })}
    ${statCard({ label: 'Net today', value: `<span class="pos">+${money(TODAY_TOTALS.net)}</span>`, ic: 'scale', tone: 'brand', caption: 'Income − expenses' })}
    ${balanceHero(parts, money(CLOSING_TOTALS.expected), 'Calculated from last count (13 Sep) + today’s movements')}
  </div>
  <div class="grid g3">
    <div class="card stat" style="flex-direction:row;align-items:center;gap:14px"><span class="ico neutral">${icon('list', 20)}</span><div class="col grow"><span class="stat-l">Transactions today</span><span class="xs muted">12 in · 4 out · 1 transfer · 1 voided</span></div><span class="stat-v sm num">17</span></div>
    <div class="card stat" style="flex-direction:row;align-items:center;gap:14px"><span class="ico warn">${icon('badge-dollar-sign', 20)}</span><div class="col grow"><span class="stat-l">Pending salaries</span><span class="xs muted">5 employees · September</span></div><span class="stat-v sm num">$1,400.00</span></div>
    <div class="card stat" style="flex-direction:row;align-items:center;gap:14px"><span class="ico brand">${icon('calculator', 20)}</span><div class="col grow"><span class="stat-l">Today’s Xisaab Xir</span><span class="xs muted">Not closed yet</span></div>${btn('Close day', { kind: 'primary', size: 'sm' })}</div>
  </div>
  <div class="grid g-main">
    <div class="card"><div class="card-h"><div><h3 class="card-t">Income vs expenses</h3><div class="xs muted">Last 7 days · net result shown as a line</div></div><div class="row" style="gap:10px"><div class="seg"><span class="on">7 days</span><span>30 days</span><span>This month</span><span>${icon('calendar', 14)}Custom</span></div><span class="btn btn-ghost btn-sm">${icon('list', 16)}Table</span></div></div>
      <div class="card-b col" style="gap:12px">${legend([['income', 'Income'], ['expense', 'Expenses'], ['net', 'Net result']], t)}${cashflowChart(week, { width: 686, height: 290, yMin: -200, yMax: 1000, step: 200, hover: 2, theme, xLabel: (d) => `${d.w} ${d.d.replace(' Sep', '')}` })}</div></div>
    ${lastClosingCard()}
  </div>
  <div class="grid g-main">
    ${recentTransactions(TODAY_TX.filter((x) => !x.voided).slice(0, 7))}
    ${pendingSalaries()}
  </div>
  ${recentInvoices()}`
  return shell('Dashboard', inner, { dark })
}

export function dashboardEmpty() {
  const parts = [
    { name: 'Cash', value: 300 }, { name: 'EVC Plus', value: 200 }, { name: 'ZAAD', value: 0.0001 }, { name: 'SAHAL', value: 0.0001 }, { name: 'Bank', value: 1500 },
  ]
  const step = (n, title, text, done, action = '') =>
    `<div class="row" style="gap:14px;padding:14px 0;border-top:1px solid var(--border)"><span style="width:28px;height:28px;border-radius:99px;display:grid;place-items:center;flex:none;${done ? 'background:var(--income-50);color:var(--income)' : 'background:var(--neutral-50);color:var(--text-2)'};font-weight:700;font-size:12px">${done ? icon('check', 16, 2.4) : n}</span><div class="col grow"><span class="sm w6" style="${done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${title}</span><span class="xs muted">${text}</span></div>${action}</div>`
  const inner = `
  ${header('Good morning, Abdirahman', `<span class="badge b-info"><span class="dot" style="background:var(--brand)"></span>First day · today is open</span>`)}
  <div class="grid kpi" style="grid-template-columns:repeat(3,minmax(0,1fr)) minmax(0,1.9fr)">
    ${statCard({ label: 'Income today', value: '$0.00', ic: 'arrow-down-left', tone: 'in', caption: 'No money recorded yet' })}
    ${statCard({ label: 'Expenses today', value: '$0.00', ic: 'arrow-up-right', tone: 'out', caption: 'No money recorded yet' })}
    ${statCard({ label: 'Net today', value: '$0.00', ic: 'scale', tone: 'brand', caption: 'Income − expenses' })}
    ${balanceHero(parts.map((p) => ({ ...p, value: p.value })), '$2,000.00', 'From your opening balances · counted 13 Sep')}
  </div>
  <div class="grid g-main">
    <div class="card" style="min-height:360px;display:grid;place-items:center;padding:40px">
      <div class="col" style="align-items:center;text-align:center;gap:14px;max-width:420px">
        <span class="ico brand" style="width:56px;height:56px;border-radius:16px">${icon('chart-column', 28)}</span>
        <h3 class="card-t" style="font-size:18px">No money recorded yet</h3>
        <p class="sm muted" style="margin:0">Record your first income or expense and GYMATICK will show today’s numbers and your cash flow here.</p>
        <div class="row" style="gap:10px;margin-top:6px">${btn('Add income', { kind: 'primary', ic: 'plus' })}${btn('Add expense', { ic: 'arrow-up-right' })}</div>
      </div>
    </div>
    <div class="card"><div class="card-h"><div><h3 class="card-t">Get GYMATICK ready</h3><div class="xs muted">1 of 4 done</div></div><span class="xs w6 muted">25%</span></div>
      <div class="card-b" style="padding-top:12px"><div class="prog ok" style="margin-bottom:10px"><span style="width:25%"></span></div>
        ${step(1, 'Set opening balances', 'Cash $300 · EVC Plus $200 · Bank $1,500', true)}
        ${step(2, 'Add your employees', 'Track monthly salaries and payments', false, btn('Add', { size: 'sm' }))}
        ${step(3, 'Create staff accounts', 'Front desk records income and invoices', false, btn('Invite', { size: 'sm' }))}
        ${step(4, 'Close your first day', 'Count the money with Xisaab Xir tonight', false, btn('Learn how', { size: 'sm', kind: 'ghost' }))}
      </div></div>
  </div>`
  return shell('Dashboard', inner, {})
}
