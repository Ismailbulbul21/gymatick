import { icon } from './icons.mjs'
import { CSS, FONT_LINK } from './styles.mjs'
import { OWNER } from './data.mjs'

/** Wraps screen markup as a Design Component artboard (.dc.html) and a plain preview page. */
export function artboard(body) {
  const dc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONT_LINK}
  <style>${CSS}</style>
</helmet>
${body}
</x-dc>
</body>
</html>
`
  const preview = `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>${CSS}</style></head><body>${body}</body></html>`
  return { dc, preview }
}

/** Placeholder GYMATICK mark: navy tile, blue G arc, red bar (replace with the real logo). */
export function logoMark(size = 32, { onDark = true } = {}) {
  const bg = onDark ? '#1b2a5c' : '#0b1533'
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-label="GYMATICK" style="flex:none;display:block"><rect width="64" height="64" rx="16" fill="${bg}"></rect><path d="M42.6 21.4A15 15 0 1 0 47 32" fill="none" stroke="#6f93ff" stroke-width="7" stroke-linecap="round"></path><path d="M34 32H47" fill="none" stroke="#f03b45" stroke-width="7" stroke-linecap="round"></path></svg>`
}

export function wordmark({ onDark = true, size = 19 } = {}) {
  return `<span class="wordmark" style="font-size:${size}px;color:${onDark ? '#ffffff' : '#0b1533'}">GYM<span style="color:#f03b45">ATICK</span></span>`
}

export const avatar = (initials, color, cls = '') => `<span class="av ${cls}" style="background:${color}">${initials}</span>`

export function badge(status, extra = '') {
  const map = {
    Paid: ['b-success', 'circle-check'], Balanced: ['b-success', 'circle-check'], Active: ['b-success', 'circle-check'],
    Difference: ['b-danger', 'triangle-alert'], Overdue: ['b-danger', 'triangle-alert'], Discrepancy: ['b-danger', 'triangle-alert'],
    Pending: ['b-warning', 'clock'], Unpaid: ['b-warning', 'clock'], Open: ['b-info', 'clock'],
    'Partially paid': ['b-info', 'circle-dashed'], Partial: ['b-info', 'circle-dashed'],
    Voided: ['b-neutral', 'ban'], Cancelled: ['b-neutral', 'ban'], Inactive: ['b-neutral', 'ban'], Reopened: ['b-neutral', 'rotate-ccw'],
    Corrected: ['b-info', 'info'], Owner: ['b-info', 'shield-check'], Staff: ['b-neutral', 'user-round'], Salary: ['b-neutral', 'badge-dollar-sign'],
    Advance: ['b-neutral', 'hand-coins'], Refund: ['b-neutral', 'undo-2'], Overpaid: ['b-info', 'info'],
  }
  const [cls, ic] = map[status] ?? ['b-neutral', 'info']
  return `<span class="badge ${cls}">${icon(ic, 13, 2.2)}${status}${extra}</span>`
}

export const btn = (label, { kind = 'secondary', ic = null, size = '', trail = null, disabled = false, style = '' } = {}) =>
  `<span class="btn btn-${kind} ${size ? 'btn-' + size : ''}" ${disabled ? 'disabled' : ''} style="${style}">${ic ? icon(ic, size === 'sm' ? 16 : 18) : ''}${label}${trail ? icon(trail, 16) : ''}</span>`

const NAV = [
  ['Overview', [['layout-dashboard', 'Dashboard']]],
  ['Money', [['arrow-down-left', 'Income'], ['arrow-up-right', 'Expenses'], ['arrow-left-right', 'Transactions'], ['calculator', 'Xisaab Xir']]],
  ['Billing', [['receipt-text', 'Invoices'], ['users-round', 'Customers']]],
  ['People', [['users', 'Employees'], ['badge-dollar-sign', 'Salaries']]],
  ['Insights', [['chart-column', 'Reports'], ['activity', 'Activity log']]],
  ['System', [['settings', 'Settings']]],
]
const STAFF_ALLOWED = new Set(['Dashboard', 'Income', 'Expenses', 'Invoices', 'Customers'])

export function sidebar(active, { user = OWNER, staff = false, closing = 'open' } = {}) {
  const groups = NAV.map(([label, items]) => {
    const visible = items.filter(([, name]) => !staff || STAFF_ALLOWED.has(name))
    if (!visible.length) return ''
    return `<div class="sb-group"><div class="sb-label">${label}</div>${visible
      .map(([ic, name]) => `<div class="nav ${name === active ? 'on' : ''}">${icon(ic, 18)}<span>${name}</span></div>`)
      .join('')}</div>`
  }).join('')

  const closingCard = staff
    ? `<div class="sb-close"><div class="row" style="gap:8px"><span class="dot" style="background:#6f93ff"></span><span class="sm w6" style="color:#fff">Today is open</span></div><div class="xs" style="color:var(--sidebar-muted)">The manager closes the day with Xisaab Xir.</div></div>`
    : closing === 'closed'
      ? `<div class="sb-close"><div class="xs w6" style="color:var(--sidebar-muted);letter-spacing:.06em;text-transform:uppercase">Today · 14 Sep</div><div class="row" style="gap:8px;color:#fff">${icon('circle-check', 16)}<span class="sm w6">Closed 21:04</span></div><div class="row" style="gap:6px;color:#ff9aa0" ><span class="xs w6">Difference −$15.00</span></div></div>`
      : `<div class="sb-close"><div class="xs w6" style="color:var(--sidebar-muted);letter-spacing:.06em;text-transform:uppercase">Today · 14 Sep</div><div class="row" style="gap:8px"><span class="dot" style="background:#6f93ff;box-shadow:0 0 0 3px rgba(111,147,255,.2)"></span><span class="sm w6" style="color:#fff">Open · not closed yet</span></div><span class="btn btn-primary btn-sm" style="width:100%">${icon('calculator', 16)}Close day</span></div>`

  return `<aside class="sb">
  <div class="sb-brand">${logoMark(34)}${wordmark()}</div>
  <div class="sb-biz"><div class="col"><span class="sm w6" style="color:#fff">GYMATICK</span><span class="xs" style="color:var(--sidebar-muted)">Main branch · Mogadishu</span></div>${icon('chevron-down', 16)}</div>
  <nav class="col" style="gap:14px">${groups}</nav>
  ${closingCard}
  <div class="sb-user">${avatar(user.initials, user.color)}<div class="col grow"><span class="sm w6" style="color:#fff">${user.name}</span><span class="xs" style="color:var(--sidebar-muted)">${user.role}</span></div>${icon('ellipsis', 18)}</div>
</aside>`
}

export function topbar({ crumbs = null, newMenu = true } = {}) {
  const left = crumbs
    ? `<div class="crumbs">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<span>${c}</span>${icon('chevron-right', 14)}` : `<span class="w6" style="color:var(--text)">${c}</span>`)).join('')}</div>`
    : `<div class="row" style="gap:10px"><span class="fbtn" style="border-color:var(--border)">${icon('calendar-days', 16)}Mon, 14 Sep 2026</span><span class="xs muted">Africa/Mogadishu</span></div>`
  return `<header class="topbar">${left}<div class="grow"></div>${newMenu ? `<span class="btn btn-secondary btn-sm">${icon('plus', 16)}New${icon('chevron-down', 14)}</span>` : ''}<span class="icon-btn" aria-label="Help">${icon('circle-alert', 18)}</span></header>`
}

export function pageHeader(title, subtitle, actions = '') {
  return `<div class="page-h"><div><h1 class="h1">${title}</h1><div class="sub">${subtitle}</div></div><div class="row" style="gap:10px">${actions}</div></div>`
}

export function shell(active, inner, { crumbs = null, user, staff = false, closing = 'open', dark = false, overlay = '', minHeight = 900 } = {}) {
  // Screens with an overlay are fixed to one 900px viewport so drawers and dialogs sit inside the frame.
  const size = overlay ? 'height:900px' : `min-height:${minHeight}px`
  return `<div class="gm ${dark ? 'dark' : ''}"><div class="app" style="${size}">${sidebar(active, { user, staff, closing })}<div class="main">${topbar({ crumbs })}<main class="content">${inner}</main></div>${overlay}</div></div>`
}

export function statCard({ label, value, ic, tone = 'brand', caption = '', delta = '', valueClass = '', extra = '' }) {
  return `<div class="card stat"><div class="stat-top"><span class="stat-l">${label}</span><span class="ico ${tone}">${icon(ic, 20)}</span></div><div class="stat-v ${valueClass}">${value}</div><div class="row" style="gap:8px;min-height:20px">${delta}<span class="xs muted">${caption}</span></div>${extra}</div>`
}

export const delta = (text, good = true, up = true) =>
  `<span class="delta ${good ? 'good' : 'bad'}">${icon(up ? 'trending-up' : 'trending-down', 13, 2.2)}${text}</span>`

export function filterBtn(label, value = '', ic = null) {
  return `<span class="fbtn">${ic ? icon(ic, 16) : ''}${label}${value ? `<span class="v">${value}</span>` : ''}${icon('chevron-down', 14)}</span>`
}

export const methodIcon = (name) => (name === 'Cash' ? 'banknote' : name === 'Bank' ? 'landmark' : 'smartphone')

export function catLabel(name, color) {
  return `<span class="row" style="gap:8px"><span class="dot" style="background:${color}"></span><span class="nowrap">${name}</span></span>`
}
