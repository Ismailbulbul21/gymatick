// GYMATICK — owner-only user administration.
//
// Creating sign-ins, setting temporary passwords and blocking sign-in need the Supabase
// admin API, so they run here with the service role — never in the browser. The caller's
// JWT is verified, and every change is re-checked in the database (active owner of the gym,
// not changing their own access) and written to the audit log.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BAN_FOREVER = '876000h' // 100 years

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

type Body = Record<string, unknown>

interface MemberTarget {
  member_id: string
  user_id: string
  business_id: string
  status: 'active' | 'inactive'
  full_name: string | null
}

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function reply(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** 14 characters with upper and lower case letters and digits; look-alike characters left out. */
function temporaryPassword(): string {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789']
  const random = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max
  const pick = (chars: string) => chars[random(chars.length)]
  const all = groups.join('')
  const chars = [...groups.map(pick), ...Array.from({ length: 11 }, () => pick(all))]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Database functions raise coded errors: message = CODE, details = a sentence for the person. */
async function rpc<T>(fn: string, args: Body): Promise<T> {
  const { data, error } = await admin.rpc(fn, args)
  if (error) {
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'UNEXPECTED'
    if (code === 'UNEXPECTED') {
      console.error(fn, error)
      throw new HttpError(500, code, 'Something went wrong. Please try again.')
    }
    const status = code === 'PERMISSION_DENIED' ? 403 : code === 'NOT_FOUND' ? 404 : 409
    throw new HttpError(status, code, error.details ?? '')
  }
  return data as T
}

async function createMember(actorId: string, body: Body) {
  const businessId = String(body.business_id ?? '')
  const fullName = String(body.full_name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const role = body.role === 'owner' ? 'owner' : 'staff'
  const title = typeof body.title === 'string' ? body.title : null
  const permissionKeys = Array.isArray(body.permission_keys)
    ? body.permission_keys.filter((key): key is string => typeof key === 'string').slice(0, 100)
    : []

  if (!UUID.test(businessId)) throw new HttpError(400, 'INVALID_INPUT', 'Unknown gym.')
  if (!fullName || fullName.length > 120) throw new HttpError(400, 'INVALID_INPUT', "Enter the person's full name.")
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address.')

  // Refuse before creating a sign-in, so a rejected request leaves nothing behind.
  await rpc('admin_assert_owner', { p_actor_id: actorId, p_business_id: businessId })

  const password = temporaryPassword()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) {
    if (error?.code === 'email_exists' || /already/i.test(error?.message ?? '')) {
      throw new HttpError(409, 'EMAIL_IN_USE', 'This email already has a GYMATICK account.')
    }
    console.error('createUser', error)
    throw new HttpError(400, 'INVALID_INPUT', 'The sign-in could not be created. Check the email address.')
  }

  try {
    const member = await rpc<{ member_id: string; user_id: string }>('admin_attach_member', {
      p_actor_id: actorId,
      p_business_id: businessId,
      p_user_id: data.user.id,
      p_full_name: fullName,
      p_role: role,
      p_title: title,
      p_permission_keys: permissionKeys,
    })
    return { ...member, temporary_password: password }
  } catch (attachError) {
    // Remove the half-created sign-in so the email can be used again.
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id)
    if (deleteError) console.error('deleteUser after failed attach', deleteError)
    throw attachError
  }
}

async function resetPassword(actorId: string, body: Body) {
  const memberId = String(body.member_id ?? '')
  if (!UUID.test(memberId)) throw new HttpError(400, 'INVALID_INPUT', 'Unknown user.')
  const target = await rpc<MemberTarget>('admin_member_target', { p_actor_id: actorId, p_member_id: memberId })

  const password = temporaryPassword()
  const { error } = await admin.auth.admin.updateUserById(target.user_id, { password })
  if (error) {
    console.error('updateUserById(password)', error)
    throw new HttpError(500, 'UNEXPECTED', 'The password could not be reset. Please try again.')
  }
  // Flag after the change: the database clears the flag whenever a password changes.
  await rpc('admin_flag_password_reset', { p_actor_id: actorId, p_member_id: memberId })
  return { member_id: memberId, temporary_password: password }
}

async function setMemberStatus(actorId: string, body: Body) {
  const memberId = String(body.member_id ?? '')
  const status = body.status === 'active' || body.status === 'inactive' ? body.status : null
  if (!UUID.test(memberId) || !status) throw new HttpError(400, 'INVALID_INPUT', 'Unknown user or status.')
  const target = await rpc<MemberTarget>('admin_member_target', { p_actor_id: actorId, p_member_id: memberId })

  // Block (or restore) sign-in first; the database already refuses an inactive member's requests.
  const ban = (inactive: boolean) =>
    admin.auth.admin.updateUserById(target.user_id, { ban_duration: inactive ? BAN_FOREVER : 'none' })
  const { error } = await ban(status === 'inactive')
  if (error) {
    console.error('updateUserById(ban)', error)
    throw new HttpError(500, 'UNEXPECTED', 'Sign-in access could not be changed. Nothing was changed.')
  }
  try {
    await rpc('admin_set_member_status', { p_actor_id: actorId, p_member_id: memberId, p_status: status })
  } catch (statusError) {
    await ban(target.status === 'inactive')
    throw statusError
  }
  return { member_id: memberId, status }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return reply(origin, 403, { code: 'PERMISSION_DENIED', message: 'This site is not allowed to manage GYMATICK users.' })
  }
  if (req.method !== 'POST') return reply(origin, 405, { code: 'INVALID_INPUT', message: 'Use POST.' })

  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (!token) throw new HttpError(401, 'PERMISSION_DENIED', 'Sign in again to continue.')
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) throw new HttpError(401, 'PERMISSION_DENIED', 'Sign in again to continue.')

    const body = ((await req.json().catch(() => null)) ?? {}) as Body
    switch (body.action) {
      case 'create_member':
        return reply(origin, 200, await createMember(auth.user.id, body))
      case 'reset_password':
        return reply(origin, 200, await resetPassword(auth.user.id, body))
      case 'set_member_status':
        return reply(origin, 200, await setMemberStatus(auth.user.id, body))
      default:
        throw new HttpError(400, 'INVALID_INPUT', 'Unknown request.')
    }
  } catch (error) {
    if (error instanceof HttpError) return reply(origin, error.status, { code: error.code, message: error.message })
    console.error(error)
    return reply(origin, 500, { code: 'UNEXPECTED', message: 'Something went wrong. Please try again.' })
  }
})
