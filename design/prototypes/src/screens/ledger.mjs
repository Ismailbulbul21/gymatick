import { icon } from '../icons.mjs'
import { shell, pageHeader, btn, badge, avatar, statCard, delta, catLabel, filterBtn } from '../components.mjs'
import { stackedBalance } from '../charts.mjs'
import { TODAY_TX, CAT_COLORS, METHOD_MONTH, CLOSING_LINES, money } from '../data.mjs'

const initials = (n) => n.split(' ').map((p) => p[0]).join('').slice(0, 2)
const people = { 'Farhiya Omar': '#7c3aed', 'Mahad Warsame': '#0e7490', 'Abdirahman Yusuf': '#2449dc' }
const by = (name) => `<span class="row" style="gap:8px">${avatar(initials(name), people[name] ?? '#475467', 's')}<span class="nowrap">${name.split(' ')[0]}</span></span>`

function incomeTable(rows) {
  return `<div class="card" style="overflow:hidden">
  <table class="tbl"><thead><tr><th>Date &amp; time</th><th>Reference</th><th>Description</th><th>Category</th><th>Method</th><th>Invoice</th><th>Recorded by</th><th class="r">Amount</th><th style="width:44px"></th></tr></thead><tbody>
  ${rows
    .map(
      (t) => `<tr><td class="nowrap"><div class="col"><span class="t-main w5">14 Sep</span><span class="xs muted num">${t.time}</span></div></td><td class="ref">${t.ref}</td><td><div class="col"><span class="t-main">${t.desc}</span><span class="xs muted">${t.who}</span></div></td><td>${catLabel(t.cat, CAT_COLORS[t.cat])}</td><td>${t.method}</td><td>${t.invoice ? `<a class="ref" style="color:var(--brand)">${t.invoice.replace('INV-2026-', 'INV-')}</a>` : '<span class="muted">—</span>'}</td><td>${by(t.by)}</td><td class="amt pos">+${money(t.amount)}</td><td><span class="muted">${icon('ellipsis', 18)}</span></td></tr>`,
    )
    .join('')}
  </tbody></table>
  <div class="pager"><span class="sm muted">Showing <b style="color:var(--text)">1–10</b> of 196 payments</span><div class="row" style="gap:8px"><span class="sm muted">Rows per page</span><span class="fbtn">25${icon('chevron-down', 14)}</span><span class="icon-btn">${icon('chevron-left', 16)}</span><span class="btn btn-secondary btn-sm" style="min-width:32px;padding:0">1</span><span class="sm muted">2 · 3 · … · 20</span><span class="icon-btn">${icon('chevron-right', 16)}</span></div></div>
  </div>`
}

function incomeInner() {
  const parts = METHOD_MONTH.map(([name, inAmt]) => ({ name, value: inAmt || 0.0001 }))
  return `
  ${pageHeader('Income', 'Lacagta Soo Gasha · All money received by the gym', `${btn('Export', { ic: 'download' })}${btn('Add income', { kind: 'primary', ic: 'plus' })}`)}
  <div class="filters">
    ${filterBtn('This month', '1–14 Sep 2026', 'calendar-days')}${filterBtn('Category', 'All')}${filterBtn('Payment method', 'All')}${filterBtn('Status', 'Posted')}
    <span class="fbtn">${icon('sliders-horizontal', 16)}More filters</span>
    <div class="grow"></div>
    <div class="search">${icon('search', 16)}Search description, TX-, customer, invoice…</div>
  </div>
  <div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr)) minmax(0,1.9fr)">
    ${statCard({ label: 'Income · this month', value: '$8,643.00', ic: 'arrow-down-left', tone: 'in', caption: 'vs 1–14 Aug', delta: delta('12.4%', true, true), extra: '<span class="xs muted" style="margin-top:-6px">Refunds $35.00 already deducted</span>' })}
    ${statCard({ label: 'Payments', value: '196', ic: 'receipt-text', tone: 'brand', caption: 'Average payment $44.10' })}
    ${statCard({ label: 'Top category', value: 'Membership', ic: 'tag', tone: 'neutral', caption: '$5,420.00 · 62.7% of income', valueClass: 'sm' })}
    <div class="card stat"><div class="stat-top"><span class="stat-l">By payment method</span><span class="xs muted">share of income</span></div>${stackedBalance(parts.map((p) => ({ ...p })), 'light', { legendCols: 5, stacked: true })}</div>
  </div>
  ${incomeTable(TODAY_TX.filter((t) => t.kind === 'in').slice(0, 10))}`
}

export const income = () => shell('Income', incomeInner(), {})

export function addIncome() {
  const chip = (label, on = false, ic = null) => `<span class="chip ${on ? 'on' : ''}">${ic ? icon(ic, 16) : ''}${label}${on ? icon('check', 14, 2.4) : ''}</span>`
  const overlay = `<div class="scrim"></div>
  <aside class="drawer">
    <div class="overlay-h"><div><div class="row" style="gap:10px"><span class="ico in" style="width:32px;height:32px">${icon('arrow-down-left', 18)}</span><h2 class="card-t" style="font-size:18px">Add income</h2></div><div class="sm muted" style="margin-top:6px">Lacagta Soo Gasha · record money received</div></div><span class="icon-btn" aria-label="Close">${icon('x', 18)}</span></div>
    <div class="overlay-b" style="flex:1">
      <div class="field"><span class="label">Amount</span><div class="input lg focus"><span style="color:var(--muted);font-weight:600">$</span><span class="num">35.00</span></div></div>
      <div class="field"><span class="label">Category</span><div class="chips">${chip('Membership', true)}${chip('Personal Training')}${chip('Registration')}${chip('Gym Services')}${chip('More', false, 'chevron-down')}</div></div>
      <div class="field"><span class="label">Payment method</span><div class="chips">${chip('Cash', false, 'banknote')}${chip('EVC Plus', true, 'smartphone')}${chip('ZAAD', false, 'smartphone')}${chip('SAHAL', false, 'smartphone')}${chip('Bank', false, 'landmark')}</div></div>
      <div class="grid g2" style="gap:14px">
        <div class="field"><span class="label">Date</span><div class="input">${icon('calendar-days', 16)}<span>Today, 14 Sep</span></div><span class="help">Business day · Africa/Mogadishu</span></div>
        <div class="field"><span class="label">Customer <span class="opt">(optional)</span></span><div class="input">${avatar('LA', '#2a78d6', 's')}<span class="grow">Liban Abdi</span>${icon('x', 14)}</div><span class="help">Member GYM-0231</span></div>
      </div>
      <div class="field"><span class="label">Description <span class="opt">(optional)</span></span><div class="input"><span class="ph">Monthly membership · Liban Abdi</span></div></div>
      <a class="sm w6 row" style="gap:6px">${icon('plus', 16)}Add a note</a>
      <div class="callout info" style="margin-top:auto">${icon('info', 18)}<div class="sm">Recorded as <b>+$35.00</b> in EVC Plus today. It appears on the dashboard and in tonight’s Xisaab Xir.</div></div>
    </div>
    <div class="overlay-f" style="justify-content:space-between"><label class="row sm text-2" style="gap:8px"><span class="checkbox"></span>Add another after saving</label><div class="row" style="gap:10px">${btn('Cancel')}${btn('Save income', { kind: 'primary', ic: 'check' })}</div></div>
  </aside>`
  return shell('Income', incomeInner(), { overlay, minHeight: 900 })
}

function expenseRows() {
  const today = TODAY_TX.filter((t) => t.kind === 'out')
  const earlier = [
    { ref: 'TX-004812', time: '19:10', day: '13 Sep', desc: 'Generator fuel', who: 'Fuel station', cat: 'Electricity', method: 'Cash', amount: 90.0, by: 'Farhiya Omar' },
    { ref: 'TX-004806', time: '15:40', day: '13 Sep', desc: 'Promo flyers & social ads', who: 'Print shop', cat: 'Marketing', method: 'EVC Plus', amount: 50.0, by: 'Abdirahman Yusuf' },
    { ref: 'TX-004797', time: '10:05', day: '13 Sep', desc: 'Towels & disinfectant', who: 'Local market', cat: 'Supplies', method: 'Cash', amount: 64.5, by: 'Mahad Warsame' },
  ]
  return [...today.map((t) => ({ ...t, day: '14 Sep' })), ...earlier]
}

export function expensesVoid() {
  const rows = expenseRows()
  const table = `<div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th>Date &amp; time</th><th>Reference</th><th>Description</th><th>Category</th><th>Method</th><th>Recorded by</th><th class="r">Amount</th><th style="width:44px"></th></tr></thead><tbody>
  ${rows
    .map(
      (t) => `<tr class="${t.ref === 'TX-004829' ? 'sel' : ''}"><td class="nowrap"><div class="col"><span class="t-main w5">${t.day}</span><span class="xs muted num">${t.time}</span></div></td><td class="ref">${t.ref}</td><td><div class="col"><span class="t-main row" style="gap:8px">${t.desc}${t.salary ? badge('Salary') : ''}</span><span class="xs muted">${t.who}${t.salary ? ' · September 2026' : ''}</span></div></td><td>${catLabel(t.cat, CAT_COLORS[t.cat])}</td><td>${t.method}</td><td>${by(t.by)}</td><td class="amt neg">−${money(t.amount)}</td><td><span class="muted">${icon('ellipsis', 18)}</span></td></tr>`,
    )
    .join('')}</tbody></table>
  <div class="pager"><span class="sm muted">Showing <b style="color:var(--text)">1–8</b> of 42 expenses</span><div class="row" style="gap:8px"><span class="icon-btn">${icon('chevron-left', 16)}</span><span class="btn btn-secondary btn-sm" style="min-width:32px;padding:0">1</span><span class="sm muted">2 · 3 · 4 · 5 · 6</span><span class="icon-btn">${icon('chevron-right', 16)}</span></div></div></div>`

  const inner = `
  ${pageHeader('Expenses', 'Lacagta Baxda · All money spent by the gym', `${btn('Export', { ic: 'download' })}${btn('Add expense', { kind: 'primary', ic: 'plus' })}`)}
  <div class="filters">${filterBtn('This month', '1–14 Sep 2026', 'calendar-days')}${filterBtn('Category', 'All')}${filterBtn('Payment method', 'All')}${filterBtn('Status', 'All')}<span class="fbtn">${icon('sliders-horizontal', 16)}More filters</span><div class="grow"></div><div class="search">${icon('search', 16)}Search description, paid to, TX-…</div></div>
  <div class="grid g4">
    ${statCard({ label: 'Expenses · this month', value: '$3,848.50', ic: 'arrow-up-right', tone: 'out', caption: 'vs 1–14 Aug', delta: delta('3.1%', true, false) })}
    ${statCard({ label: 'Number of expenses', value: '41', ic: 'receipt-text', tone: 'brand', caption: '1 voided entry not counted' })}
    ${statCard({ label: 'Largest category', value: 'Rent', ic: 'tag', tone: 'neutral', caption: '$1,200.00 · 31.2% of expenses', valueClass: 'sm' })}
    ${statCard({ label: 'Salaries', value: '$520.00', ic: 'badge-dollar-sign', tone: 'warn', caption: 'Included in expenses · 13.5%' })}
  </div>
  ${table}`

  const overlay = `<div class="scrim"></div>
  <div class="dialog" style="width:540px">
    <div class="overlay-h"><div class="row" style="gap:12px;align-items:flex-start"><span class="ico out" style="width:40px;height:40px;border-radius:12px">${icon('ban', 20)}</span><div><h2 class="card-t" style="font-size:18px">Void this expense?</h2><div class="sm muted" style="margin-top:4px">Use void only for entries recorded by mistake.</div></div></div><span class="icon-btn">${icon('x', 18)}</span></div>
    <div class="overlay-b">
      <div class="row" style="gap:12px;padding:14px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border)"><span class="ico out" style="width:36px;height:36px">${icon('arrow-up-right', 18)}</span><div class="col grow"><span class="sm w6">Cleaning supplies · Local market</span><span class="xs muted">TX-004829 · Cleaning · Cash · 14 Sep 12:16 · by Mahad Warsame</span></div><span class="w7 num neg">−$18.00</span></div>
      <div class="field"><span class="label">Reason for voiding</span><div class="input textarea focus"><span>Entered twice — duplicate of TX-004828 recorded one minute earlier.</span></div><span class="help">Required · visible in the activity log</span></div>
      <div class="col" style="gap:8px">
        <div class="row sm text-2" style="gap:10px">${icon('minus', 16)}It stops counting in expenses, balances and reports.</div>
        <div class="row sm text-2" style="gap:10px">${icon('history', 16)}The entry stays in history with your name and reason.</div>
        <div class="row sm text-2" style="gap:10px">${icon('calendar-check', 16)}14 Sep is still open, so no Xisaab Xir is affected.</div>
      </div>
    </div>
    <div class="overlay-f">${btn('Cancel')}${btn('Void expense', { kind: 'danger', ic: 'ban' })}</div>
  </div>`
  return shell('Expenses', inner, { overlay })
}

export function transactions() {
  const kindBadge = (t) =>
    t.kind === 'transfer' ? `<span class="badge b-neutral">${icon('arrow-left-right', 13, 2.2)}Transfer</span>`
      : t.salary ? `<span class="badge b-neutral">${icon('badge-dollar-sign', 13, 2.2)}Salary</span>`
        : t.kind === 'in' ? `<span class="badge b-success">${icon('arrow-down-left', 13, 2.2)}Income</span>`
          : `<span class="badge b-danger">${icon('arrow-up-right', 13, 2.2)}Expense</span>`
  const amount = (t) =>
    t.kind === 'transfer' ? `<span class="row" style="gap:6px;justify-content:flex-end;color:var(--text-2)">${icon('arrow-left-right', 14)}${money(t.amount)}</span>`
      : `${t.kind === 'in' ? '+' : '−'}${money(t.amount)}`
  const rows = TODAY_TX.slice(0, 12)
  const balances = CLOSING_LINES.map(
    (l, i) => `<div class="col" style="gap:4px;padding:0 18px;${i ? 'border-left:1px solid var(--border)' : ''}"><span class="row xs w6 text-2" style="gap:6px"><span style="width:8px;height:8px;border-radius:2px;background:var(--m${i + 1})"></span>${l.method}</span><span class="w7 num" style="font-size:18px;line-height:26px">${money(l.expected)}</span></div>`,
  ).join('')
  const inner = `
  ${pageHeader('Transactions', 'Dhaqdhaqaaqa Lacagta · Every money movement, including transfers', `${btn('Export CSV', { ic: 'file-down' })}${btn('Owner deposit / withdrawal', { ic: 'hand-coins' })}${btn('Transfer money', { kind: 'primary', ic: 'arrow-left-right' })}`)}
  <div class="card row" style="padding:16px 4px;align-items:stretch"><div class="col" style="gap:4px;padding:0 20px;min-width:220px"><span class="xs w6 text-2">Current balance</span><span class="w7 num" style="font-size:22px;line-height:28px">$5,010.40</span><span class="xs muted">Last count 13 Sep + movements since</span></div>${balances}</div>
  <div class="filters">${filterBtn('Today', '14 Sep 2026', 'calendar-days')}${filterBtn('Kind', 'All')}${filterBtn('Method', 'All')}${filterBtn('Recorded by', 'Anyone')}${filterBtn('Status', 'All')}<div class="grow"></div><div class="search">${icon('search', 16)}Search…</div></div>
  <div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th>Time</th><th>Reference</th><th>Kind</th><th>Description</th><th>Method</th><th>Recorded by</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>
  ${rows
    .map(
      (t) => `<tr class="${t.voided ? 'voided' : ''}"><td class="num">${t.time}</td><td class="ref">${t.ref}</td><td>${kindBadge(t)}</td><td><div class="col"><span class="t-main" style="${t.voided ? 'color:var(--faint)' : ''}">${t.desc}</span><span class="xs muted">${t.who}${t.cat ? ` · ${t.cat}` : ''}</span></div></td><td class="nowrap">${t.method}</td><td>${by(t.by)}</td><td>${t.voided ? badge('Voided') : '<span class="xs muted">Posted</span>'}</td><td class="amt ${t.voided || t.kind === 'transfer' ? '' : t.kind === 'in' ? 'pos' : 'neg'}">${amount(t)}</td></tr>`,
    )
    .join('')}
  </tbody></table><div class="pager"><span class="sm muted">Showing <b style="color:var(--text)">1–12</b> of 18 entries today (17 posted, 1 voided)</span><span class="xs muted">A transfer pair shows as one row</span></div></div>`
  return shell('Transactions', inner, {})
}
