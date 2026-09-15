import { icon } from '../icons.mjs'
import { shell, pageHeader, btn, badge, avatar, filterBtn, statCard } from '../components.mjs'
import { CLOSING_LINES, CLOSING_TOTALS, CLOSINGS, money } from '../data.mjs'

const calcRow = (sign, label, detail, value, { big = false, tone = '' } = {}) =>
  `<div class="row" style="gap:16px;padding:${big ? '16px 0 4px' : '12px 0'}">
    <span style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none;font-weight:800;font-size:16px;${sign === '=' ? 'background:var(--brand);color:#fff' : sign === '+' ? 'background:var(--income-50);color:var(--income)' : sign === '−' ? 'background:var(--expense-50);color:var(--expense)' : 'background:var(--neutral-50);color:var(--text-2)'}">${sign}</span>
    <div class="col grow"><span class="${big ? 'md w7' : 'md w6'}">${label}</span><span class="xs muted">${detail}</span></div>
    <span class="num ${tone}" style="font-weight:${big ? 800 : 700};font-size:${big ? 28 : 18}px;line-height:${big ? 36 : 26}px;letter-spacing:-.01em">${value}</span>
  </div>`

function stepTitle(n, title, sub, right = '') {
  return `<div class="card-h" style="padding-top:20px"><div class="row" style="gap:12px"><span style="width:28px;height:28px;border-radius:99px;background:var(--brand-50);color:var(--brand);display:grid;place-items:center;font-weight:800;font-size:13px">${n}</span><div><h3 class="card-t">${title}</h3><div class="xs muted">${sub}</div></div></div>${right}</div>`
}

function countTable() {
  const diffCell = (d) =>
    d === 0
      ? `<span class="row pos w6" style="gap:6px;justify-content:flex-end">${icon('circle-check', 16)}$0.00</span>`
      : `<span class="row neg w7" style="gap:6px;justify-content:flex-end">${icon('triangle-alert', 16)}${money(d, { sign: true })}<span class="xs w6">short</span></span>`
  const rows = CLOSING_LINES.map((l) => {
    const d = Math.round((l.actual - l.expected) * 100) / 100
    return `<tr><td><span class="row t-main" style="gap:10px"><span class="ico neutral" style="width:30px;height:30px;border-radius:8px">${icon(l.method === 'Cash' ? 'banknote' : l.method === 'Bank' ? 'landmark' : 'smartphone', 16)}</span>${l.method}</span></td>
      <td class="amt" style="font-weight:500">${money(l.opening)}</td><td class="amt pos" style="font-weight:500">+${money(l.in)}</td><td class="amt neg" style="font-weight:500">−${money(l.out)}</td>
      <td class="amt ink">${money(l.expected)}</td>
      <td style="width:190px"><div class="row" style="gap:6px"><div class="input ${d !== 0 ? 'focus' : ''}" style="height:38px;flex:1;justify-content:flex-end"><span class="muted">$</span><span class="num w6">${l.actual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>${d === 0 ? `<span class="icon-btn" style="width:30px;height:30px;color:var(--income);border-color:var(--income-100);background:var(--income-50)" title="Matches expected">${icon('check', 16, 2.4)}</span>` : `<span class="icon-btn" style="width:30px;height:30px" title="Copy expected">${icon('copy', 15)}</span>`}</div></td>
      <td class="amt">${diffCell(d)}</td></tr>`
  }).join('')
  return `<table class="tbl"><thead><tr><th>Payment method</th><th class="r">Opening</th><th class="r">In</th><th class="r">Out</th><th class="r">Expected</th><th class="r">Counted</th><th class="r">Difference</th></tr></thead><tbody>${rows}
  <tr><td class="t-main w7" style="background:var(--surface-2)">Total</td><td class="amt ink" style="background:var(--surface-2)">$4,512.90</td><td style="background:var(--surface-2)"></td><td style="background:var(--surface-2)"></td><td class="amt ink" style="background:var(--surface-2)">$5,010.40</td><td class="amt ink" style="background:var(--surface-2);padding-right:52px">$4,995.40</td><td class="amt neg" style="background:var(--surface-2)">−$15.00</td></tr></tbody></table>`
}

function workspaceInner() {
  return `
  ${pageHeader('Xisaab Xir', `<div class="row" style="gap:10px;margin-top:2px"><span>Daily closing · Monday, 14 September 2026</span><span class="badge b-info">${icon('calendar-check', 13, 2.2)}Covers 14 Sep</span></div>`, `${btn('History', { ic: 'history' })}`)}
  <div class="grid g-main" style="align-items:start">
      <div class="card">${stepTitle(1, 'Review the day', 'Everything recorded for 14 Sep, calculated by the system', `<a class="sm w6 row" style="gap:4px">17 transactions ${icon('arrow-right', 16)}</a>`)}
        <div class="card-b" style="padding-top:8px">
          ${calcRow('', 'Opening balance', 'Counted at the last Xisaab Xir · Sun 13 Sep, 21:12', '$4,512.90')}
          <div class="divider"></div>
          ${calcRow('+', 'Money received', 'Income $700.50 · Owner deposits $0.00', '$700.50', { tone: 'pos' })}
          <div class="divider"></div>
          ${calcRow('−', 'Money used', 'Expenses $203.00 (incl. salaries $60.00) · Refunds $0.00 · Owner withdrawals $0.00', '$203.00', { tone: 'neg' })}
          <div style="height:2px;background:var(--text);opacity:.85;margin-top:4px;border-radius:2px"></div>
          ${calcRow('=', 'Expected closing balance', 'Opening + received − used', '$5,010.40', { big: true })}
        </div></div>
    <div class="col" style="gap:20px">
      <div class="card"><div class="card-h"><div><h3 class="card-t">Last closing</h3><div class="xs muted">Sun, 13 Sep · by Farhiya Omar</div></div>${badge('Balanced')}</div>
        <div class="card-b col" style="gap:8px"><div class="row sm" style="justify-content:space-between"><span class="muted">Expected</span><span class="w6 num">$4,512.90</span></div><div class="row sm" style="justify-content:space-between"><span class="muted">Counted</span><span class="w6 num">$4,512.90</span></div><div class="row sm" style="justify-content:space-between"><span class="muted">Difference</span><span class="w7 num pos">$0.00</span></div></div></div>
      <div class="card"><div class="card-h"><h3 class="card-t">Before you close</h3></div>
        <div class="card-b col" style="gap:12px">
          ${[['Count the cash drawer twice', true], ['Check EVC Plus, ZAAD and SAHAL balances in their apps', true], ['Check the bank balance', true], ['Record any expense still missing', false]].map(([t, on]) => `<div class="row sm" style="gap:10px"><span class="checkbox ${on ? 'on' : ''}">${on ? icon('check', 12, 3) : ''}</span><span class="${on ? '' : 'text-2'}">${t}</span></div>`).join('')}
        </div></div>
    </div>
  </div>
      <div class="card" style="overflow:hidden">${stepTitle(2, 'Count the money', 'Count cash in the drawer and check each mobile money and bank balance', `<span class="xs muted">In/Out include a $300.00 Cash → Bank transfer</span>`)}
        <div style="margin-top:14px">${countTable()}</div></div>
  <div class="grid g-main" style="align-items:start">
      <div class="card">${stepTitle(3, 'Confirm and close', 'A note is required when the count does not match')}
        <div class="card-b col" style="gap:16px">
          <div class="callout danger" style="align-items:center">${icon('triangle-alert', 20)}<div class="col grow"><span class="md w7" style="color:var(--expense)">Difference −$15.00</span><span class="sm text-2">Cash is short by $15.00. All other methods match.</span></div><span class="num w7" style="font-size:22px;color:var(--expense)">−$15.00</span></div>
          <div class="field"><span class="label">Note about the difference</span><div class="input textarea focus"><span>Cash drawer short by $15. Counted twice. Checking front-desk change with Mahad tomorrow morning.</span></div></div>
          <div class="row" style="justify-content:space-between"><span class="row sm muted" style="gap:8px">${avatar('AY', '#2449dc', 's')}Closing as Abdirahman Yusuf · 21:04</span>${btn('Xisaab Xir — Close 14 Sep', { kind: 'primary', ic: 'lock', size: 'lg' })}</div>
        </div></div>
      <div class="card"><div class="card-h"><h3 class="card-t">When you close</h3></div>
        <div class="card-b col" style="gap:12px">
          <div class="row sm text-2" style="gap:10px;align-items:flex-start">${icon('lock', 16)}Transactions dated 14 Sep are locked.</div>
          <div class="row sm text-2" style="gap:10px;align-items:flex-start">${icon('calendar-days', 16)}New entries go to 15 Sep.</div>
          <div class="row sm text-2" style="gap:10px;align-items:flex-start">${icon('wallet', 16)}Tomorrow starts from the money you counted.</div>
          <div class="row sm text-2" style="gap:10px;align-items:flex-start">${icon('shield-check', 16)}Only the owner can reopen the day.</div>
        </div></div>
  </div>
  </div>`
}

export const xisaabXir = () => shell('Xisaab Xir', workspaceInner(), {})

export function closeConfirm() {
  const overlay = `<div class="scrim"></div>
  <div class="dialog" style="width:520px">
    <div class="overlay-b" style="gap:20px;padding:28px 28px 22px">
      <span class="ico brand" style="width:48px;height:48px;border-radius:14px">${icon('lock', 24)}</span>
      <div><h2 class="h1" style="font-size:22px;line-height:30px">Close 14 Sep 2026?</h2><p class="sm muted" style="margin:6px 0 0">Check the numbers one last time. Closing locks the day.</p></div>
      <div class="grid g3" style="gap:10px">
        <div class="col" style="padding:12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);gap:2px"><span class="xs muted">Expected</span><span class="md w7 num">$5,010.40</span></div>
        <div class="col" style="padding:12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);gap:2px"><span class="xs muted">Counted</span><span class="md w7 num">$4,995.40</span></div>
        <div class="col" style="padding:12px;border-radius:12px;background:var(--expense-50);border:1px solid var(--expense-100);gap:2px"><span class="xs" style="color:var(--expense)">Difference</span><span class="md w7 num neg">−$15.00</span></div>
      </div>
      <div class="sm text-2" style="padding:12px 14px;border-radius:12px;border:1px dashed var(--border-strong)">“Cash drawer short by $15. Counted twice. Checking front-desk change with Mahad tomorrow morning.”</div>
      <div class="col" style="gap:10px">
        <div class="row sm" style="gap:10px">${icon('lock', 16)}Transactions dated 14 Sep will be locked.</div>
        <div class="row sm" style="gap:10px">${icon('calendar-days', 16)}Anything recorded after this goes to 15 Sep.</div>
        <div class="row sm" style="gap:10px">${icon('shield-check', 16)}Only the owner can reopen this day.</div>
      </div>
    </div>
    <div class="overlay-f">${btn('Go back')}${btn('Close the day', { kind: 'primary', ic: 'lock' })}</div>
  </div>`
  return shell('Xisaab Xir', workspaceInner(), { overlay })
}

export function dayClosed() {
  const inner = `
  ${pageHeader('Xisaab Xir', 'Daily closing · Monday, 14 September 2026', `${btn('History', { ic: 'history' })}`)}
  <div class="grid g-main" style="align-items:start">
    <div class="card" style="padding:36px 36px 30px">
      <div class="row" style="gap:18px;align-items:flex-start">
        <span style="width:64px;height:64px;border-radius:20px;background:var(--brand);color:#fff;display:grid;place-items:center;flex:none;box-shadow:0 12px 24px -12px rgba(36,73,220,.9)">${icon('lock', 30)}</span>
        <div class="col grow" style="gap:4px"><h2 class="h1" style="font-size:26px;line-height:34px">14 Sep is closed</h2><span class="md muted">Closed by Abdirahman Yusuf at 21:04 · Africa/Mogadishu</span><div class="row" style="gap:8px;margin-top:8px">${badge('Difference', ' −$15.00')}<span class="badge b-outline">${icon('banknote', 13, 2.2)}Cash short $15.00</span></div></div>
      </div>
      <div class="grid g3" style="gap:14px;margin-top:28px">
        <div class="col" style="padding:16px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border);gap:4px"><span class="sm muted">Expected</span><span class="w7 num" style="font-size:22px;line-height:30px">$5,010.40</span></div>
        <div class="col" style="padding:16px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border);gap:4px"><span class="sm muted">Counted</span><span class="w7 num" style="font-size:22px;line-height:30px">$4,995.40</span></div>
        <div class="col" style="padding:16px;border-radius:14px;background:var(--expense-50);border:1px solid var(--expense-100);gap:4px"><span class="sm" style="color:var(--expense)">Difference</span><span class="w7 num neg" style="font-size:22px;line-height:30px">−$15.00</span></div>
      </div>
      <div class="col" style="gap:6px;margin-top:22px"><span class="label">Note</span><span class="md text-2">Cash drawer short by $15. Counted twice. Checking front-desk change with Mahad tomorrow morning.</span></div>
      <div class="callout info" style="margin-top:24px">${icon('info', 18)}<div class="sm"><b>Tomorrow opens with $4,995.40</b> — the money you counted. Anything recorded from now on goes to <b>15 Sep</b>.</div></div>
      <div class="row" style="gap:10px;margin-top:24px">${btn('View closing', { kind: 'primary', ic: 'file-text' })}${btn('Print summary', { ic: 'printer' })}<div class="grow"></div>${btn('Reopen day', { kind: 'ghost', ic: 'rotate-ccw' })}</div>
    </div>
    <div class="card"><div class="card-h"><h3 class="card-t">Counted by method</h3></div>
      <div class="card-b col" style="gap:12px">
        ${CLOSING_LINES.map((l) => { const d = Math.round((l.actual - l.expected) * 100) / 100; return `<div class="row" style="gap:10px"><span class="ico neutral" style="width:30px;height:30px;border-radius:8px">${icon(l.method === 'Cash' ? 'banknote' : l.method === 'Bank' ? 'landmark' : 'smartphone', 16)}</span><span class="sm w6 grow">${l.method}</span><span class="sm num w6">${money(l.actual)}</span><span class="xs num w7 ${d ? 'neg' : 'pos'}" style="width:58px;text-align:right">${d ? money(d, { sign: true }) : '✓'}</span></div>` }).join('')}
        <div class="divider"></div>
        <div class="row" style="justify-content:space-between"><span class="sm w6">Total counted</span><span class="w7 num">$4,995.40</span></div>
      </div></div>
  </div>`
  return shell('Xisaab Xir', inner, { closing: 'closed' })
}

export function closingHistory() {
  const statusCell = (c) => {
    if (c.status === 'Reopened') return badge('Reopened')
    const main = c.status === 'Balanced' ? badge('Balanced') : badge('Difference')
    return `<div class="row" style="gap:6px">${main}${c.corrected ? badge('Corrected') : ''}</div>`
  }
  const rows = CLOSINGS.map((c) => {
    const muted = c.status === 'Reopened'
    const diff = c.diff === 0 ? `<span class="${c.note ? 'text-2' : 'pos'}">$0.00</span>${c.note ? `<div class="xs neg w6">${c.note}</div>` : ''}` : `<span class="${c.diff < 0 ? 'neg' : 'warn'}">${money(c.diff, { sign: true })}</span>`
    return `<tr style="${muted ? 'opacity:.55' : ''}"><td class="nowrap"><div class="col"><span class="t-main">${c.day} ${c.date}</span>${muted ? '<span class="xs muted">replaced</span>' : ''}</div></td><td class="amt" style="font-weight:500">${money(c.opening)}</td><td class="amt pos" style="font-weight:500">+${money(c.income)}</td><td class="amt neg" style="font-weight:500">−${money(c.expenses)}</td><td class="amt ink">${money(c.expected)}</td><td class="amt ink">${money(c.actual)}</td><td class="amt">${diff}</td><td>${statusCell(c)}</td><td><div class="col"><span class="nowrap">${c.by}</span><span class="xs muted num">${c.at}</span></div></td></tr>`
  }).join('')
  const inner = `
  ${pageHeader('Closing history', 'Xisaab Xir · Every closed day, what was expected and what was counted', `${btn('Export CSV', { ic: 'file-down' })}${btn('Go to Xisaab Xir', { kind: 'primary', ic: 'calculator' })}`)}
  <div class="filters">${filterBtn('This month', '1–14 Sep 2026', 'calendar-days')}${filterBtn('Status', 'All')}${filterBtn('Closed by', 'Anyone')}</div>
  <div class="grid g4">
    ${statCard({ label: 'Days closed', value: '14', ic: 'calendar-check', tone: 'brand', caption: 'No days skipped this month' })}
    ${statCard({ label: 'Balanced days', value: '10', ic: 'circle-check', tone: 'in', caption: '71% of closings' })}
    ${statCard({ label: 'Days with a difference', value: '4', ic: 'triangle-alert', tone: 'out', caption: '1 corrected after closing' })}
    ${statCard({ label: 'Net of differences', value: '<span class="neg">−$18.00</span>', ic: 'scale', tone: 'neutral', caption: 'Short $20.00 · over $2.00' })}
  </div>
  <div class="card" style="overflow:hidden"><table class="tbl compact"><thead><tr><th>Date</th><th class="r">Opening</th><th class="r">Income</th><th class="r">Expenses</th><th class="r">Expected</th><th class="r">Counted</th><th class="r">Difference</th><th>Status</th><th>Closed by</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="pager"><span class="sm muted">Showing <b style="color:var(--text)">1–11</b> of 15 closings</span><div class="row" style="gap:8px"><span class="icon-btn">${icon('chevron-left', 16)}</span><span class="btn btn-secondary btn-sm" style="min-width:32px;padding:0">1</span><span class="sm muted">2</span><span class="icon-btn">${icon('chevron-right', 16)}</span></div></div></div>`
  return shell('Xisaab Xir', inner, { closing: 'closed' })
}

export function closingDetail() {
  const lines = [
    ['Cash', 612.4, 248.5, 126.0, 734.9, 784.9],
    ['EVC Plus', 905.0, 310.0, 80.0, 1135.0, 1085.0],
    ['ZAAD', 214.0, 45.0, 0, 259.0, 259.0],
    ['SAHAL', 37.0, 35.0, 0, 72.0, 72.0],
    ['Bank', 650.0, 0, 0, 650.0, 650.0],
  ]
  const lineRows = lines.map(([m, o, i, out, e, a]) => {
    const d = Math.round((a - e) * 100) / 100
    return `<tr><td class="t-main">${m}</td><td class="amt" style="font-weight:500">${money(o)}</td><td class="amt pos" style="font-weight:500">+${money(i)}</td><td class="amt neg" style="font-weight:500">−${money(out)}</td><td class="amt ink">${money(e)}</td><td class="amt ink">${money(a)}</td><td class="amt ${d < 0 ? 'neg' : d > 0 ? 'warn' : 'pos'}">${d === 0 ? '$0.00' : money(d, { sign: true }) + (d > 0 ? ' over' : ' short')}</td></tr>`
  }).join('')
  const tx = [
    ['20:40', 'TX-004521', 'Monthly membership · Sagal Hirsi', 'Membership', 'EVC Plus', '+$35.00', 'pos', false],
    ['19:15', 'TX-004517/18', 'Transfer Cash → EVC Plus', 'Transfer', 'Cash → EVC Plus', '$50.00', '', true],
    ['18:02', 'TX-004515', 'Personal training · Omar Jama', 'Personal Training', 'Cash', '+$60.00', 'pos', false],
    ['13:30', 'TX-004509', 'Water bill · August', 'Water', 'EVC Plus', '−$30.00', 'neg', false],
    ['09:05', 'TX-004502', 'Monthly membership · Najma Hussein', 'Membership', 'Cash', '+$35.00', 'pos', false],
  ].map(([time, ref, desc, cat, method, amt, cls, voided]) => `<tr class="${voided ? 'voided' : ''}"><td class="num">${time}</td><td class="ref">${ref}</td><td class="t-main" style="${voided ? 'color:var(--faint)' : ''}">${desc}</td><td>${cat}</td><td class="nowrap">${method}</td><td>${voided ? badge('Voided') : '<span class="xs muted">Posted</span>'}</td><td class="amt ${cls}">${amt}</td></tr>`).join('')
  const inner = `
  ${pageHeader('Xisaab Xir · Monday, 7 Sep 2026', `<div class="row" style="gap:8px;margin-top:4px">${badge('Difference')}${badge('Corrected')}<span>Closed by Farhiya Omar · 21:02 · Africa/Mogadishu</span></div>`, `${btn('Previous day', { ic: 'chevron-left', kind: 'ghost' })}${btn('Next day', { trail: 'chevron-right', kind: 'ghost' })}${btn('Print', { ic: 'printer' })}`)}
  <div class="grid g-main" style="align-items:start">
    <div class="col" style="gap:20px">
      <div class="card"><div class="card-h"><div><h3 class="card-t">At closing time</h3><div class="xs muted">Snapshot saved when the day was closed — it never changes</div></div></div>
        <div class="card-b">
          <div class="grid g4" style="gap:12px">
            ${[['Opening', '$2,418.40', ''], ['Money received', '+$588.50', 'pos'], ['Money used', '−$156.00', 'neg'], ['Expected', '$2,850.90', '']].map(([l, v, c]) => `<div class="col" style="padding:14px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);gap:2px"><span class="xs muted">${l}</span><span class="md w7 num ${c}">${v}</span></div>`).join('')}
          </div>
          <div class="row" style="gap:12px;margin-top:12px;padding:14px;border-radius:12px;border:1px solid var(--expense-100);background:var(--expense-50)">${icon('triangle-alert', 20)}<div class="col grow"><span class="md w7">Counted $2,850.90 · total difference $0.00</span><span class="sm text-2">But two methods did not match: Cash over by $50.00, EVC Plus short by $50.00.</span></div></div>
        </div>
        <table class="tbl"><thead><tr><th>Method</th><th class="r">Opening</th><th class="r">In</th><th class="r">Out</th><th class="r">Expected</th><th class="r">Counted</th><th class="r">Difference</th></tr></thead><tbody>${lineRows}</tbody></table>
        <div class="card-b" style="border-top:1px solid var(--border)"><span class="label">Note from Farhiya Omar</span><p class="md text-2" style="margin:6px 0 0">Cash is $50 over and EVC Plus is $50 short — looks like a transfer that didn't really happen. Asked the owner to check.</p></div>
      </div>
    </div>
    <div class="col" style="gap:20px">
      <div class="card" style="border-color:var(--brand-100)"><div class="card-h"><div class="row" style="gap:10px"><span class="ico brand" style="width:32px;height:32px">${icon('rotate-ccw', 16)}</span><h3 class="card-t">Changed after closing</h3></div></div>
        <div class="card-b col" style="gap:14px">
          <div class="row" style="gap:10px;align-items:flex-start">${avatar('AY', '#2449dc')}<div class="col" style="gap:2px"><span class="sm"><b>Abdirahman Yusuf</b> voided transfer <b>TX-004517/18</b> (Cash → EVC Plus, $50.00)</span><span class="xs muted">Tue, 8 Sep 09:42</span><span class="sm text-2" style="margin-top:6px">“The transfer was never made — recorded by mistake.”</span></div></div>
          <div class="divider"></div>
          <span class="label">Recalculated with the correction</span>
          <div class="row sm" style="justify-content:space-between"><span class="muted">Cash expected</span><span class="num w6">$734.90 → $784.90</span></div>
          <div class="row sm" style="justify-content:space-between"><span class="muted">EVC Plus expected</span><span class="num w6">$1,135.00 → $1,085.00</span></div>
          <div class="row" style="justify-content:space-between;padding:10px 12px;border-radius:10px;background:var(--income-50)"><span class="sm w6 pos row" style="gap:6px">${icon('circle-check', 16)}Now balanced</span><span class="sm w7 num pos">$0.00</span></div>
          <span class="xs muted">The snapshot on the left keeps what was known on the night. Reports use the corrected ledger.</span>
        </div></div>
      <div class="card"><div class="card-h"><h3 class="card-t">Timeline</h3></div>
        <div class="card-b col" style="gap:14px">
          ${[['lock', 'Closed with a difference', 'Farhiya Omar · Mon 7 Sep, 21:02'], ['rotate-ccw', 'Correction: transfer voided', 'Abdirahman Yusuf · Tue 8 Sep, 09:42'], ['calendar-check', 'Next day closed', 'Tue 8 Sep · difference +$2.00']].map(([ic, t, s]) => `<div class="row" style="gap:12px;align-items:flex-start"><span class="ico neutral" style="width:30px;height:30px;border-radius:99px">${icon(ic, 15)}</span><div class="col"><span class="sm w6">${t}</span><span class="xs muted">${s}</span></div></div>`).join('')}
        </div></div>
    </div>
  </div>
  <div class="card"><div class="card-h"><div><h3 class="card-t">Transactions on 7 Sep</h3><div class="xs muted">24 entries · showing the 5 most recent</div></div><a class="sm w6 row" style="gap:4px">Open in Transactions ${icon('arrow-right', 16)}</a></div>
        <table class="tbl" style="margin-top:14px"><thead><tr><th>Time</th><th>Reference</th><th>Description</th><th>Category</th><th>Method</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>${tx}</tbody></table></div>

  return shell('Xisaab Xir', inner, { closing: 'closed', crumbs: ['Xisaab Xir', 'History', '7 Sep 2026'] })
}
