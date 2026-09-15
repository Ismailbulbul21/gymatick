// SVG/HTML chart builders following the dataviz rules in spec §11.9:
// single y-axis, ≤24px columns with 4px rounded data ends, 2px gaps, 2px lines,
// 8px markers with a 2px surface ring, solid hairline grid, literal validated hex.
import { money } from './data.mjs'

export const THEME = {
  light: { income: '#0b6e36', expense: '#ee6368', net: '#2449dc', grid: '#e2e6ee', axis: '#cbd2de', label: '#667085', surface: '#ffffff', cross: '#98a2b3',
    methods: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] },
  dark: { income: '#23a863', expense: '#b93a42', net: '#5f84fb', grid: '#22304d', axis: '#2e3d5f', label: '#8a95ab', surface: '#111a2e', cross: '#5d6a84',
    methods: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] },
}

const f = (n) => Math.round(n * 100) / 100

function topRounded(x, yTop, w, h, r = 4) {
  if (h <= 0.5) return ''
  const rr = Math.min(r, h, w / 2)
  return `M${f(x)},${f(yTop + h)}V${f(yTop + rr)}Q${f(x)},${f(yTop)} ${f(x + rr)},${f(yTop)}H${f(x + w - rr)}Q${f(x + w)},${f(yTop)} ${f(x + w)},${f(yTop + rr)}V${f(yTop + h)}Z`
}
function bottomRounded(x, yBase, w, h, r = 4) {
  if (h <= 0.5) return ''
  const rr = Math.min(r, h, w / 2)
  return `M${f(x)},${f(yBase)}V${f(yBase + h - rr)}Q${f(x)},${f(yBase + h)} ${f(x + rr)},${f(yBase + h)}H${f(x + w - rr)}Q${f(x + w)},${f(yBase + h)} ${f(x + w)},${f(yBase + h - rr)}V${f(yBase)}Z`
}
const compact = (v) => {
  const s = v < 0 ? '−' : ''
  const a = Math.abs(v)
  return a >= 1000 ? `${s}$${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}K` : `${s}$${a}`
}

export function legend(items, t) {
  return `<div class="row" style="gap:16px;flex-wrap:wrap">${items
    .map(([kind, label]) => {
      const key =
        kind === 'net'
          ? `<span style="width:16px;height:2px;border-radius:2px;background:${t.net}"></span>`
          : `<span style="width:10px;height:10px;border-radius:3px;background:${t[kind]}"></span>`
      return `<span class="row xs w6 text-2" style="gap:7px">${key}${label}</span>`
    })
    .join('')}</div>`
}

/** Grouped income/expense columns per day with a net line on the same axis. */
export function cashflowChart(days, { width, height = 280, yMin, yMax, step, hover = null, theme = 'light', xLabel = (d) => d.d, todayLast = true }) {
  const t = THEME[theme]
  const L = 56, R = 8, T = 12, B = 30
  const pw = width - L - R, ph = height - T - B
  const y = (v) => T + ((yMax - v) / (yMax - yMin)) * ph
  const band = pw / days.length
  const cw = Math.min(24, (band - 18) / 2)
  let g = ''
  for (let v = yMin; v <= yMax + 0.001; v += step) {
    const yy = f(y(v))
    g += `<line x1="${L}" x2="${width - R}" y1="${yy}" y2="${yy}" stroke="${v === 0 ? t.axis : t.grid}" stroke-width="1"></line>`
    g += `<text x="${L - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="${t.label}" style="font-variant-numeric:tabular-nums">${compact(v)}</text>`
  }
  const y0 = y(0)
  let bars = '', pts = [], marks = '', labels = ''
  days.forEach((d, i) => {
    const cx = L + band * (i + 0.5)
    if (hover === i) g += `<rect x="${f(cx - band / 2 + 4)}" y="${T}" width="${f(band - 8)}" height="${f(ph)}" rx="8" fill="${t.grid}" opacity="0.45"></rect>`
    bars += `<path d="${topRounded(cx - 1 - cw, y(d.income), cw, y0 - y(d.income))}" fill="${t.income}"></path>`
    bars += `<path d="${topRounded(cx + 1, y(d.expenses), cw, y0 - y(d.expenses))}" fill="${t.expense}"></path>`
    pts.push(`${f(cx)},${f(y(d.net))}`)
    marks += `<circle cx="${f(cx)}" cy="${f(y(d.net))}" r="4" fill="${t.net}" stroke="${t.surface}" stroke-width="2"></circle>`
    const isToday = todayLast && i === days.length - 1
    labels += `<text x="${f(cx)}" y="${height - 9}" text-anchor="middle" font-size="11" font-weight="${isToday ? 700 : 500}" fill="${isToday ? (theme === 'dark' ? '#e8ecf4' : '#101828') : t.label}">${isToday ? 'Today' : xLabel(d)}</text>`
  })
  let cross = ''
  if (hover !== null) {
    const cx = L + band * (hover + 0.5)
    cross = `<line x1="${f(cx)}" x2="${f(cx)}" y1="${T}" y2="${f(T + ph)}" stroke="${t.cross}" stroke-width="1"></line>`
  }
  const line = `<polyline points="${pts.join(' ')}" fill="none" stroke="${t.net}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>`
  let tip = ''
  if (hover !== null) {
    const d = days[hover]
    const cx = L + band * (hover + 0.5)
    const left = Math.min(width - 190, cx + 16)
    const row = (color, label, val, isLine) =>
      `<div class="row" style="justify-content:space-between;gap:14px"><span class="row" style="gap:8px"><span style="width:12px;height:${isLine ? 2 : 8}px;border-radius:2px;background:${color}"></span><span class="muted">${label}</span></span><span class="w7 num" style="color:var(--text)">${val}</span></div>`
    tip = `<div class="tooltip" style="left:${f(left)}px;top:6px;width:178px;display:flex;flex-direction:column;gap:6px"><div class="xs w7" style="color:var(--text)">${d.w}, ${d.d}</div>${row(t.income, 'Income', money(d.income))}${row(t.expense, 'Expenses', money(d.expenses))}${row(t.net, 'Net', money(d.net, { sign: true }), true)}</div>`
  }
  return `<div style="position:relative;width:${width}px;height:${height}px"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;font-family:inherit">${g}${cross}${bars}${line}${marks}${labels}</svg>${tip}</div>`
}

/** Diverging columns around zero: green above, red below; labels only on extremes. */
export function netBars(days, { width, height = 220, yMin, yMax, step, theme = 'light' }) {
  const t = THEME[theme]
  const L = 56, R = 8, T = 18, B = 30
  const pw = width - L - R, ph = height - T - B
  const y = (v) => T + ((yMax - v) / (yMax - yMin)) * ph
  const band = pw / days.length
  const cw = Math.min(24, band - 16)
  let g = ''
  for (let v = yMin; v <= yMax + 0.001; v += step) {
    const yy = f(y(v))
    g += `<line x1="${L}" x2="${width - R}" y1="${yy}" y2="${yy}" stroke="${v === 0 ? t.axis : t.grid}" stroke-width="1"></line><text x="${L - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="${t.label}">${compact(v)}</text>`
  }
  const y0 = y(0)
  const max = days.reduce((a, d) => (d.net > a.net ? d : a), days[0])
  const min = days.reduce((a, d) => (d.net < a.net ? d : a), days[0])
  let bars = '', labels = ''
  days.forEach((d, i) => {
    const cx = L + band * (i + 0.5)
    const x = cx - cw / 2
    if (d.net >= 0) bars += `<path d="${topRounded(x, y(d.net), cw, y0 - y(d.net))}" fill="${t.income}"></path>`
    else bars += `<path d="${bottomRounded(x, y0, cw, y(d.net) - y0)}" fill="${t.expense}"></path>`
    labels += `<text x="${f(cx)}" y="${height - 9}" text-anchor="middle" font-size="11" fill="${t.label}">${d.d.replace(' Sep', '')}</text>`
    if (d === max) labels += `<text x="${f(cx)}" y="${f(y(d.net) - 6)}" text-anchor="middle" font-size="11" font-weight="700" fill="${theme === 'dark' ? '#e8ecf4' : '#101828'}">${money(d.net, { sign: true })}</text>`
    if (d === min) labels += `<text x="${f(cx)}" y="${f(y(d.net) + 14)}" text-anchor="middle" font-size="11" font-weight="700" fill="${theme === 'dark' ? '#e8ecf4' : '#101828'}">${money(d.net, { sign: true })}</text>`
  })
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;font-family:inherit">${g}${bars}${labels}</svg>`
}

/** Single-series area trend with an end dot and end label. */
export function areaTrend(values, { width, height = 150, color, yMax, theme = 'light', firstLabel, lastLabel }) {
  const t = THEME[theme]
  const L = 8, R = 64, T = 14, B = 24
  const pw = width - L - R, ph = height - T - B
  const x = (i) => L + (pw * i) / (values.length - 1)
  const y = (v) => T + ((yMax - v) / yMax) * ph
  const pts = values.map((v, i) => `${f(x(i))},${f(y(v))}`)
  const area = `M${f(x(0))},${f(y(0))}L${pts.join('L')}L${f(x(values.length - 1))},${f(y(0))}Z`
  let grid = ''
  for (let k = 0; k <= 2; k++) {
    const yy = f(T + (ph * k) / 2)
    grid += `<line x1="${L}" x2="${width - R + 8}" y1="${yy}" y2="${yy}" stroke="${k === 2 ? t.axis : t.grid}" stroke-width="1"></line>`
  }
  const last = values[values.length - 1]
  const lx = x(values.length - 1), ly = y(last)
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;font-family:inherit">${grid}<path d="${area}" fill="${color}" opacity="0.1"></path><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline><circle cx="${f(lx)}" cy="${f(ly)}" r="4" fill="${color}" stroke="${t.surface}" stroke-width="2"></circle><text x="${f(lx + 10)}" y="${f(ly + 4)}" font-size="11" font-weight="700" fill="${theme === 'dark' ? '#e8ecf4' : '#101828'}">${money(last)}</text><text x="${L}" y="${height - 6}" font-size="11" fill="${t.label}">${firstLabel}</text><text x="${f(width - R)}" y="${height - 6}" text-anchor="end" font-size="11" fill="${t.label}">${lastLabel}</text></svg>`
}

/** Horizontal single-hue bars, sorted; value at the tip, share in its own column. */
export function barList(rows, { color, labelWidth = 150 }) {
  const max = Math.max(...rows.map((r) => r[1]))
  return `<div class="col" style="gap:12px">${rows
    .map(([label, value, pct]) => {
      const w = Math.max(1.5, (value / max) * 100)
      return `<div style="display:grid;grid-template-columns:${labelWidth}px minmax(0,1fr) 48px;align-items:center;gap:12px"><span class="sm text-2 nowrap" style="overflow:hidden;text-overflow:ellipsis">${label}</span><div class="row" style="gap:8px;min-width:0"><span style="display:block;height:12px;width:calc(${f(w * 0.78)}%);border-radius:0 4px 4px 0;background:${color}"></span><span class="sm w6 num nowrap">${money(value)}</span></div><span class="xs muted num" style="text-align:right">${pct.toFixed(1)}%</span></div>`
    })
    .join('')}</div>`
}

/** Part-to-whole bar for balances by payment method, with legend and amounts. */
export function stackedBalance(parts, theme = 'light', { legendCols = 2, stacked = false } = {}) {
  const t = THEME[theme]
  const total = parts.reduce((a, p) => a + p.value, 0)
  const bar = `<div style="display:flex;gap:2px;height:8px;border-radius:99px;overflow:hidden">${parts
    .filter((p) => p.value >= 0.01)
    .map((p) => `<span style="display:block;height:100%;width:${f((p.value / total) * 100)}%;background:${t.methods[parts.indexOf(p)]}"></span>`)
    .join('')}</div>`
  const shown = (v) => (v < 0.01 ? '$0.00' : money(v))
  const leg = stacked
    ? `<div style="display:grid;grid-template-columns:repeat(${legendCols},minmax(0,1fr));gap:8px 10px">${parts
        .map((p, i) => `<div class="col" style="gap:2px;min-width:0"><span class="row xs text-2 nowrap" style="gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:${t.methods[i]};flex:none"></span>${p.name}</span><span class="sm w6 num nowrap" style="color:var(--text)">${shown(p.value)}</span></div>`)
        .join('')}</div>`
    : `<div style="display:grid;grid-template-columns:repeat(${legendCols},minmax(0,1fr));gap:6px 12px">${parts
        .map((p, i) => `<div class="row xs" style="gap:6px;justify-content:space-between"><span class="row text-2" style="gap:6px"><span style="width:8px;height:8px;border-radius:2px;background:${t.methods[i]}"></span>${p.name}</span><span class="w6 num" style="color:var(--text)">${shown(p.value)}</span></div>`)
        .join('')}</div>`
  return `<div class="col" style="gap:10px">${bar}${leg}</div>`
}
