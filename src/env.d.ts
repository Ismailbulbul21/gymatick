/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://<ref>.supabase.co */
  readonly VITE_SUPABASE_URL: string
  /** Browser-safe publishable key (sb_publishable_...). Never a secret/service-role key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
