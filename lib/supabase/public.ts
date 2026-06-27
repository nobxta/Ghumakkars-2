import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

/**
 * Cookie-free anon Supabase client for PUBLIC, cacheable server reads.
 *
 * Because it never touches cookies/headers, pages using it stay statically
 * generatable and can use ISR (`export const revalidate`). It runs as the anon
 * role, so RLS still applies — only publicly visible rows are returned. Never
 * use this for user-specific or admin data.
 */
export function createPublicClient() {
  return createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
