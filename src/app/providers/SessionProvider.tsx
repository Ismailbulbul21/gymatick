import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-client'
import { activeMembership } from '@/lib/membership'
import type { Membership, SessionContext } from '@/types/db'
import { DEFAULT_CURRENCY, type Currency } from '@/lib/money'

type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

interface SessionState {
  status: AuthStatus
  session: Session | null
  context: SessionContext | null
  contextError: unknown
  membership: Membership | null
  currency: Currency
  timezone: string
  businessDate: string
  can: (permission: string) => boolean
  isOwner: boolean
  refreshContext: () => Promise<void>
  signOut: () => Promise<void>
  sessionExpired: boolean
}

const SessionCtx = createContext<SessionState | null>(null)

async function fetchContext(): Promise<SessionContext> {
  const { data, error } = await supabase.rpc('get_my_context')
  if (error) throw error
  return data as SessionContext
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signed_in' : 'signed_out')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setStatus(nextSession ? 'signed_in' : 'signed_out')
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSessionExpired(false)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  const contextQuery = useQuery({
    queryKey: queryKeys.context,
    queryFn: fetchContext,
    enabled: status === 'signed_in',
    staleTime: 60_000,
  })

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const refreshContext = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.context })
  }, [queryClient])

  const context = contextQuery.data ?? null
  const membership = activeMembership(context)

  const value = useMemo<SessionState>(() => {
    const permissions = new Set(membership?.permissions ?? [])
    const settings = membership?.settings
    return {
      status,
      session,
      context,
      contextError: contextQuery.error,
      membership,
      currency: settings
        ? {
            code: settings.currency_code,
            symbol: settings.currency_symbol,
            decimals: settings.currency_decimals,
            locale: settings.locale,
          }
        : DEFAULT_CURRENCY,
      timezone: settings?.timezone ?? 'Africa/Mogadishu',
      businessDate: membership?.business_date ?? new Date().toISOString().slice(0, 10),
      can: (permission: string) => permissions.has(permission),
      isOwner: membership?.role === 'owner',
      refreshContext,
      signOut,
      sessionExpired,
    }
  }, [status, session, context, contextQuery.error, membership, refreshContext, signOut, sessionExpired])

  return <SessionCtx value={value}>{children}</SessionCtx>
}

export function useSession(): SessionState {
  const ctx = use(SessionCtx)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}

/** The active gym; screens inside the app shell always have one. */
export function useBusiness(): Membership {
  const { membership } = useSession()
  if (!membership) throw new Error('No active gym for this user')
  return membership
}

export const usePermission = (permission: string): boolean => useSession().can(permission)
