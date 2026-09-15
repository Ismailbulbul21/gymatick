import type { Membership, SessionContext } from '@/types/db'

const PREFERRED_GYM_KEY = 'gymatick.business'

/** The gym the app opens: the one saved under `gymatick.business` when this person still has
 *  access to it, otherwise their first gym. */
export function activeMembership(context: SessionContext | null | undefined): Membership | null {
  const memberships = context?.memberships ?? []
  let preferred: string | null = null
  try {
    preferred = localStorage.getItem(PREFERRED_GYM_KEY)
  } catch {
    /* storage blocked: open the first gym */
  }
  return memberships.find((membership) => membership.business_id === preferred) ?? memberships[0] ?? null
}
