// Inline SVG icons built from the exact lucide-react icon data the app will use.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.resolve(here, '../../../node_modules/lucide-react/dist/esm/icons')
const available = new Set(readdirSync(iconsDir).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)))
const cache = new Map()

// Alias modules re-export another icon (e.g. history → rotate-ccw-clock); follow them.
async function readNode(name) {
  const file = path.join(iconsDir, `${name}.mjs`)
  const mod = await import(pathToFileURL(file).href)
  if (mod.__iconData) return mod.__iconData.node
  const target = readFileSync(file, 'utf8').match(/from '\.\/([a-z0-9-]+)\.mjs'/)
  if (!target) throw new Error(`Cannot resolve lucide icon: ${name}`)
  return readNode(target[1])
}

export async function loadIcons(names) {
  for (const name of names) {
    if (cache.has(name)) continue
    if (!available.has(name)) throw new Error(`Unknown lucide icon: ${name}`)
    cache.set(name, await readNode(name))
  }
}

const attr = (obj) =>
  Object.entries(obj)
    .filter(([k]) => k !== 'key')
    .map(([k, v]) => `${k}="${String(v)}"`)
    .join(' ')

/** icon('wallet', 18) → inline <svg>; color follows currentColor. */
export function icon(name, size = 18, strokeWidth = 1.75) {
  const node = cache.get(name)
  if (!node) throw new Error(`Icon not loaded: ${name}`)
  const children = node.map(([tag, attrs]) => `<${tag} ${attr(attrs)}></${tag}>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">${children}</svg>`
}

export const ICON_NAMES = [
  'layout-dashboard', 'arrow-down-left', 'arrow-up-right', 'arrow-left-right', 'receipt-text', 'file-text',
  'users', 'user-round', 'badge-dollar-sign', 'wallet', 'banknote', 'smartphone', 'landmark', 'calendar',
  'calendar-days', 'chevron-down', 'chevron-right', 'chevron-left', 'chevron-up', 'plus', 'search', 'funnel',
  'sliders-horizontal', 'download', 'printer', 'check', 'circle-check', 'circle-check-big', 'triangle-alert',
  'circle-alert', 'clock', 'circle-dashed', 'ban', 'rotate-ccw', 'info', 'lock', 'log-out', 'log-in', 'settings',
  'activity', 'chart-column', 'chart-pie', 'trending-up', 'trending-down', 'calculator', 'scale', 'shield-check',
  'x', 'ellipsis', 'eye', 'eye-off', 'mail', 'key-round', 'copy', 'undo-2', 'briefcase', 'building-2', 'globe',
  'moon', 'sun', 'coins', 'hand-coins', 'piggy-bank', 'list-checks', 'history', 'square-pen', 'user-plus',
  'user-cog', 'arrow-right', 'arrow-left', 'clipboard-check', 'store', 'dumbbell', 'tag', 'tags', 'credit-card',
  'list', 'file-spreadsheet', 'refresh-cw', 'wifi-off', 'languages', 'calendar-check', 'calendar-clock', 'minus',
  'equal', 'circle-user', 'hash', 'phone', 'map-pin', 'upload', 'image', 'file-down', 'chart-line', 'lock-keyhole',
  'shield', 'users-round', 'user-check', 'user-x', 'scroll-text', 'vault',
]
