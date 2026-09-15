import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/** A new key per form session makes retries safe: the server returns the original record. */
export const newIdempotencyKey = (): string => crypto.randomUUID()

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

const AVATAR_COLORS = ['#2449dc', '#7c3aed', '#0e7490', '#b45309', '#be185d', '#0f766e', '#4338ca', '#a16207']

export const avatarColor = (seed: string): string => {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}

export const CATEGORY_COLORS: Record<string, string> = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  magenta: '#e87ba4',
  violet: '#4a3aa7',
  slate: '#64748b',
  sky: '#0ea5e9',
}

export const categoryColor = (key: string | null | undefined): string => CATEGORY_COLORS[key ?? 'slate'] ?? '#64748b'

/** CSV with RFC 4180 quoting; text cells are protected against spreadsheet formula injection. */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string; numeric?: boolean }[]): string {
  const escape = (value: unknown, numeric = false): string => {
    if (value === null || value === undefined) return ''
    let text = String(value)
    if (!numeric && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
    if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
    return text
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => escape(row[c.key], c.numeric)).join(',')).join('\r\n')
  return `﻿${header}\r\n${body}`
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Only internal paths may be used as a post-sign-in redirect. */
export const safeReturnTo = (value: string | null): string | null =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : null
