import { so } from './so'

export type Language = 'en' | 'so'

const STORAGE_KEY = 'gymatick.language'

function readStored(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'so' || value === 'en' ? value : null
  } catch {
    return null
  }
}

let current: Language = readStored() ?? 'en'

export const getLanguage = (): Language => current

/** True when this device already has a saved language choice. */
export const hasStoredLanguage = (): boolean => readStored() !== null

/** Switches the language for everything rendered from now on and remembers it on this device. */
export function applyLanguage(language: Language): void {
  current = language
  document.documentElement.lang = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    /* storage blocked: the choice lasts until the page reloads */
  }
}

/** Translates an English interface text. The Somali text lives in so.ts, keyed by the English, and
 *  anything not translated yet shows in English. `{name}` placeholders are filled from `values`. */
export function tr(text: string, values?: Record<string, unknown>): string {
  const template = current === 'so' ? (so[text] ?? text) : text
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
