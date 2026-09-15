import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Single shared Supabase client for the browser.
 *
 * Authorization is enforced by Row Level Security and database functions —
 * this client only carries the signed-in user's session.
 */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
