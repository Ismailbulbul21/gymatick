/** User administration that needs the Supabase admin API (creating sign-ins, temporary
 *  passwords, blocking sign-in). It runs in the `admin-users` Edge Function with the
 *  caller's own session — the browser never holds a privileged key. */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Shaped like a database error, so parseAppError shows the same friendly messages. */
class AdminFunctionError extends Error {
  code = 'EDGE_FUNCTION'
  details: string
  hint = ''

  constructor(code: string, details: string) {
    super(code)
    this.name = 'AdminFunctionError'
    this.details = details
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', { body })
  if (!error) return data as T
  if (error instanceof FunctionsHttpError) {
    const payload = (await (error.context as Response).json().catch(() => ({}))) as { code?: string; message?: string }
    throw new AdminFunctionError(payload.code ?? 'UNEXPECTED', payload.message ?? '')
  }
  throw error
}

export interface CreatedMember {
  member_id: string
  user_id: string
  temporary_password: string
}

export const adminCreateMember = (args: {
  businessId: string
  fullName: string
  email: string
  role: 'owner' | 'staff'
  title: string | null
  permissionKeys?: string[]
}) =>
  invoke<CreatedMember>({
    action: 'create_member',
    business_id: args.businessId,
    full_name: args.fullName,
    email: args.email,
    role: args.role,
    title: args.title,
    permission_keys: args.permissionKeys ?? [],
  })

export const adminResetPassword = (memberId: string) =>
  invoke<{ member_id: string; temporary_password: string }>({ action: 'reset_password', member_id: memberId })

export const adminSetMemberStatus = (memberId: string, status: 'active' | 'inactive') =>
  invoke<{ member_id: string; status: 'active' | 'inactive' }>({ action: 'set_member_status', member_id: memberId, status })
