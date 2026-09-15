import { icon } from '../icons.mjs'
import { shell, pageHeader, btn, badge, avatar, statCard, filterBtn } from '../components.mjs'
import { EMPLOYEES, money } from '../data.mjs'

const statusOf = (e) => (e.paid === null ? 'Inactive' : e.paid >= e.salary ? 'Paid' : e.paid > 0 ? 'Partial' : 'Unpaid')

function salariesInner() {
  const active = EMPLOYEES.filter((e) => e.status === 'Active')
  const rows = active
    .map((e) => {
      const st = statusOf(e)
      const remaining = e.salary - e.paid
      const pct = Math.round((e.paid / e.salary) * 100)
      return `<tr><td><div class="row" style="gap:12px">${avatar(e.initials, e.color)}<div class="col"><span class="t-main">${e.name}</span><span class="xs muted">${e.position}</span></div></div></td>
      <td class="amt ink">${money(e.salary)}</td><td class="amt" style="font-weight:500">${money(e.paid)}</td><td class="amt ${remaining ? 'ink' : 'pos'}">${money(remaining)}</td>
      <td style="width:160px"><div class="prog ${pct === 100 ? 'ok' : ''}"><span style="width:${pct}%"></span></div><span class="xs muted num">${pct}% paid</span></td>
      <td>${badge(st)}</td><td><span class="nowrap">${e.last}</span></td>
      <td class="r">${st === 'Paid' ? `<span class="btn btn-secondary btn-sm" disabled title="Fully paid for September 2026">Paid ${icon('check', 14, 2.4)}</span>` : btn('Pay', { size: 'sm', ic: 'badge-dollar-sign' })}</td></tr>`
    })
    .join('')
  return `
  ${pageHeader('Salaries', 'Mushahar · Monthly salary obligations and payments', `<div class="row" style="gap:4px;padding:3px;border:1px solid var(--border-strong);border-radius:12px;background:var(--surface)"><span class="icon-btn" style="border:none;width:34px;height:34px">${icon('chevron-left', 18)}</span><span class="row md w7" style="gap:8px;padding:0 10px">${icon('calendar-days', 16)}September 2026</span><span class="icon-btn" style="border:none;width:34px;height:34px">${icon('chevron-right', 18)}</span></div>${btn('Pay salary', { kind: 'primary', ic: 'badge-dollar-sign' })}`)}
  <div class="row" style="gap:24px;border-bottom:1px solid var(--border)"><span class="md w7" style="padding:0 2px 12px;border-bottom:2px solid var(--brand);color:var(--text)">Overview</span><span class="md w6 muted" style="padding:0 2px 12px">Payment history</span></div>
  <div class="grid g4">
    ${statCard({ label: 'Monthly obligations', value: '$1,920.00', ic: 'briefcase', tone: 'brand', caption: '6 active employees' })}
    ${statCard({ label: 'Paid so far', value: '<span class="pos">$520.00</span>', ic: 'circle-check', tone: 'in', caption: '27% of September', extra: '<div class="prog ok"><span style="width:27%"></span></div>' })}
    ${statCard({ label: 'Pending', value: '$1,400.00', ic: 'clock', tone: 'warn', caption: '5 employees not fully paid' })}
    ${statCard({ label: 'Arrears', value: '$0.00', ic: 'calendar-clock', tone: 'neutral', caption: 'August was fully paid' })}
  </div>
  <div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th>Employee</th><th class="r">Monthly salary</th><th class="r">Paid</th><th class="r">Remaining</th><th>Progress</th><th>Status</th><th>Last payment</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  <div class="pager"><span class="sm muted">Sagal Mire is inactive since 31 Jul and has no obligation this month.</span><span class="sm w6">Total remaining <span class="num" style="margin-left:8px">$1,400.00</span></span></div></div>`
}

export const salaries = () => shell('Salaries', salariesInner(), {})

export function paySalaryReview() {
  const overlay = `<div class="scrim"></div>
  <div class="dialog" style="width:560px">
    <div class="overlay-h"><div class="col" style="gap:10px"><div class="row sm w6" style="gap:10px"><span class="row pos" style="gap:6px">${icon('circle-check', 16)}Details</span><span style="width:28px;height:1px;background:var(--border-strong)"></span><span class="row" style="gap:6px;color:var(--brand)"><span style="width:18px;height:18px;border-radius:99px;background:var(--brand);color:#fff;display:grid;place-items:center;font-size:11px">2</span>Review</span></div><h2 class="card-t" style="font-size:18px">Review salary payment</h2></div><span class="icon-btn">${icon('x', 18)}</span></div>
    <div class="overlay-b">
      <div class="row" style="gap:14px;padding:16px;border-radius:14px;border:1px solid var(--border);background:var(--surface-2)">${avatar('AH', '#2a78d6', 'l')}<div class="col grow"><span class="md w7">Abdi Hassan</span><span class="sm muted">Head Trainer · monthly salary $450.00</span></div><div class="col" style="align-items:flex-end"><span class="xs muted">Paying</span><span class="w7 num" style="font-size:26px;line-height:32px">$450.00</span></div></div>
      <div class="kv sm" style="grid-template-columns:150px minmax(0,1fr)">
        <div>Salary period</div><div class="w6">September 2026</div>
        <div>Payment type</div><div class="w6">Salary</div>
        <div>Paid from</div><div class="w6 row" style="gap:6px">${icon('smartphone', 15)}EVC Plus</div>
        <div>Payment date</div><div class="w6">Mon, 14 Sep 2026</div>
        <div>Note</div><div class="text-2">September salary paid early at the employee's request.</div>
      </div>
      <div class="col" style="gap:8px"><div class="row sm" style="justify-content:space-between"><span class="muted">After this payment</span><span class="w6">Paid $450.00 of $450.00 · remaining <span class="pos w7">$0.00</span></span></div><div class="prog ok"><span style="width:100%"></span></div></div>
      <div class="callout info">${icon('info', 18)}<div class="sm">This records <b>one $450.00 expense</b> in the <b>Salary</b> category, dated 14 Sep, paid from EVC Plus. It is counted once — in Expenses, Salaries and Reports.</div></div>
    </div>
    <div class="overlay-f" style="justify-content:space-between">${btn('Back', { kind: 'ghost', ic: 'arrow-left' })}<div class="row" style="gap:10px">${btn('Cancel')}${btn('Confirm payment', { kind: 'primary', ic: 'check' })}</div></div>
  </div>`
  return shell('Salaries', salariesInner(), { overlay })
}

export function employees() {
  const rows = EMPLOYEES.map((e) => {
    const st = statusOf(e)
    return `<tr style="${e.status === 'Inactive' ? 'opacity:.6' : ''}"><td><div class="row" style="gap:12px">${avatar(e.initials, e.color)}<div class="col"><span class="t-main">${e.name}</span><span class="xs muted num">+252 61 555 01${String(EMPLOYEES.indexOf(e) + 2).padStart(2, '0')}</span></div></div></td>
    <td>${e.position}</td><td class="amt ink">${money(e.salary)}</td><td class="nowrap">${e.start}</td>
    <td>${e.status === 'Active' ? badge(st) : '<span class="muted">—</span>'}</td><td>${e.status === 'Active' ? badge('Active') : `<div class="col">${badge('Inactive')}<span class="xs muted" style="margin-top:4px">Ended 31 Jul 2026</span></div>`}</td>
    <td class="r"><span class="muted">${icon('ellipsis', 18)}</span></td></tr>`
  }).join('')
  const inner = `
  ${pageHeader('Employees', 'Shaqaalaha · Trainers and staff who work at the gym', btn('Add employee', { kind: 'primary', ic: 'user-plus' }))}
  <div class="filters"><div class="search">${icon('search', 16)}Search name, phone or position…</div>${filterBtn('Status', 'All')}${filterBtn('Position', 'All')}<div class="grow"></div><span class="sm muted">6 active · 1 inactive · monthly payroll <b class="num" style="color:var(--text)">$1,920.00</b></span></div>
  <div class="card" style="overflow:hidden"><table class="tbl"><thead><tr><th>Employee</th><th>Position</th><th class="r">Monthly salary</th><th>Started</th><th>September salary</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="callout info">${icon('info', 18)}<div class="sm">Employees with salary history are never deleted. Deactivate them instead — their payments stay in the records.</div></div>`
  return shell('Employees', inner, {})
}

export function employeeDetail() {
  const pays = [
    ['August 2026', 'Salary', '31 Aug 2026', 'EVC Plus', 'TX-004402', 450],
    ['July 2026', 'Salary', '31 Jul 2026', 'EVC Plus', 'TX-003981', 450],
    ['June 2026', 'Salary', '30 Jun 2026', 'Cash', 'TX-003577', 450],
    ['May 2026', 'Salary', '31 May 2026', 'EVC Plus', 'TX-003160', 300],
    ['May 2026', 'Advance', '15 May 2026', 'Cash', 'TX-002968', 150],
    ['April 2026', 'Salary', '30 Apr 2026', 'EVC Plus', 'TX-002741', 450],
  ].map(([p, type, d, m, ref, a]) => `<tr><td class="t-main">${p}</td><td>${badge(type)}</td><td class="nowrap">${d}</td><td>${m}</td><td class="ref">${ref}</td><td class="amt ink">${money(a)}</td><td>${badge('Paid')}</td></tr>`).join('')
  const inner = `
  <div class="card" style="padding:24px"><div class="row" style="gap:20px">${avatar('AH', '#2a78d6', 'xl')}
    <div class="col grow" style="gap:6px"><div class="row" style="gap:10px"><h1 class="h1">Abdi Hassan</h1>${badge('Active')}</div>
      <div class="row md text-2" style="gap:18px;flex-wrap:wrap"><span class="row" style="gap:6px">${icon('briefcase', 16)}Head Trainer</span><span class="row" style="gap:6px">${icon('phone', 16)}+252 61 555 0102</span><span class="row" style="gap:6px">${icon('calendar-days', 16)}Started 3 Feb 2025 · 1 year 7 months</span></div></div>
    <div class="row" style="gap:10px">${btn('Edit', { ic: 'square-pen' })}${btn('Change salary', { ic: 'trending-up' })}${btn('Pay salary', { kind: 'primary', ic: 'badge-dollar-sign' })}<span class="icon-btn" style="width:40px;height:40px">${icon('ellipsis', 18)}</span></div></div></div>
  <div class="grid g4">
    ${statCard({ label: 'Current salary', value: '$450.00', ic: 'wallet', tone: 'brand', caption: 'Since January 2026' })}
    ${statCard({ label: 'Paid in 2026', value: '$3,600.00', ic: 'circle-check', tone: 'in', caption: 'January – August · 9 payments' })}
    ${statCard({ label: 'Last payment', value: '$450.00', ic: 'calendar-check', tone: 'neutral', caption: '31 Aug 2026 · EVC Plus' })}
    ${statCard({ label: 'September 2026', value: '$450.00', ic: 'clock', tone: 'warn', caption: 'Not paid yet' })}
  </div>
  <div class="grid g-main" style="align-items:start">
    <div class="card" style="overflow:hidden"><div class="card-h" style="padding-bottom:0"><div class="row" style="gap:22px"><span class="md w7" style="padding-bottom:12px;border-bottom:2px solid var(--brand)">Salary payments</span><span class="md w6 muted" style="padding-bottom:12px">Activity</span></div>${btn('Export', { ic: 'download', size: 'sm', kind: 'ghost' })}</div>
      <table class="tbl" style="border-top:1px solid var(--border)"><thead><tr><th>Period</th><th>Type</th><th>Paid on</th><th>Method</th><th>Reference</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>${pays}</tbody></table>
      <div class="pager"><span class="sm muted">Showing 6 of 20 payments since February 2025</span><a class="sm w6">View all</a></div></div>
    <div class="col" style="gap:20px">
      <div class="card"><div class="card-h"><h3 class="card-t">Salary changes</h3>${btn('Change', { size: 'sm' })}</div>
        <div class="card-b col" style="gap:16px">
          <div class="row" style="gap:12px;align-items:flex-start"><span class="ico in" style="width:32px;height:32px;border-radius:99px">${icon('trending-up', 16)}</span><div class="col grow"><div class="row" style="justify-content:space-between"><span class="sm w7">$450.00 / month</span><span class="xs w6 pos">+$50.00</span></div><span class="xs muted">From January 2026 · by Abdirahman Yusuf</span><span class="sm text-2" style="margin-top:4px">“Promoted to head trainer.”</span></div></div>
          <div class="row" style="gap:12px;align-items:flex-start"><span class="ico neutral" style="width:32px;height:32px;border-radius:99px">${icon('user-plus', 16)}</span><div class="col grow"><span class="sm w7">$400.00 / month</span><span class="xs muted">From February 2025 · starting salary</span></div></div>
        </div></div>
      <div class="card"><div class="card-h"><h3 class="card-t">Details</h3></div>
        <div class="card-b kv sm" style="grid-template-columns:110px minmax(0,1fr)"><div>Phone</div><div>+252 61 555 0102</div><div>Branch</div><div>Main branch</div><div>System user</div><div class="muted">No login</div><div>Notes</div><div class="text-2">Leads the morning strength classes.</div></div></div>
    </div>
  </div>`
  return shell('Employees', inner, { crumbs: ['Employees', 'Abdi Hassan'] })
}
