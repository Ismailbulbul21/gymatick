import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'

interface ThemeState {
  choice: ThemeChoice
  resolved: 'light' | 'dark'
  setChoice: (choice: ThemeChoice) => void
}

const ThemeCtx = createContext<ThemeState | null>(null)
const STORAGE_KEY = 'gymatick.theme'

const readStored = (): ThemeChoice => {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStored)
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode: the choice just does not persist */
    }
  }, [])

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice])
  return <ThemeCtx value={value}>{children}</ThemeCtx>
}

export function useTheme(): ThemeState {
  const ctx = use(ThemeCtx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
