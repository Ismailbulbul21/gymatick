import { isPrivilegedKey } from './supabase-keys'

/**
 * Validated, browser-safe runtime configuration.
 *
 * Only VITE_* variables reach the browser bundle, so they must never hold secrets.
 * This module fails fast if configuration is missing or if a privileged key is
 * accidentally exposed to the client.
 */

function readRequired(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value.trim()
}

const supabaseUrl = readRequired('VITE_SUPABASE_URL')
const supabasePublishableKey = readRequired('VITE_SUPABASE_PUBLISHABLE_KEY')

if (isPrivilegedKey(supabasePublishableKey)) {
  throw new Error(
    'VITE_SUPABASE_PUBLISHABLE_KEY contains a secret/service-role key. ' +
      'Secret keys must never be shipped to the browser — use the publishable key instead.',
  )
}

export const env = {
  supabaseUrl,
  supabasePublishableKey,
} as const
