import { createContext, Fragment, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyLanguage, getLanguage, hasStoredLanguage, type Language } from '@/i18n'
import { updateMyProfile } from '@/lib/api'
import { useSession } from './SessionProvider'

interface LanguageState {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageCtx = createContext<LanguageState | null>(null)

/** Holds the interface language. Changing it redraws the whole app, so every text switches at once. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { context } = useSession()
  const [language, setLanguageState] = useState<Language>(getLanguage)
  const accountLanguage = context?.user.preferred_language
  const signedIn = Boolean(context)

  // A device without a saved choice follows the language saved on the account.
  useEffect(() => {
    if (accountLanguage && !hasStoredLanguage() && accountLanguage !== language) {
      applyLanguage(accountLanguage)
      setLanguageState(accountLanguage)
    }
  }, [accountLanguage, language])

  const setLanguage = useCallback(
    (next: Language) => {
      applyLanguage(next)
      setLanguageState(next)
      if (signedIn) updateMyProfile({ preferred_language: next }).catch(() => undefined)
    },
    [signedIn],
  )

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])
  return (
    <LanguageCtx value={value}>
      <Fragment key={language}>{children}</Fragment>
    </LanguageCtx>
  )
}

export function useLanguage(): LanguageState {
  const ctx = use(LanguageCtx)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
