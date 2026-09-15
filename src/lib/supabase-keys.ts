/**
 * Returns true when a Supabase API key grants privileged (server-only) access
 * and therefore must never be bundled into the browser.
 */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true

  // Legacy JWT-style keys: inspect the role claim without verifying the signature.
  const parts = key.split('.')
  if (parts.length === 3 && parts[1]) {
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(base64)) as { role?: unknown }
      return payload.role === 'service_role'
    } catch {
      return false
    }
  }
  return false
}
