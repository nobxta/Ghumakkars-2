import { createClient } from '@supabase/supabase-js'

/**
 * Admin client with service role key - bypasses RLS
 * ⚠️ WARNING: Only use this in server-side code (API routes, Server Actions, etc.)
 * Never expose this key to the client!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase admin environment variables. SUPABASE_SERVICE_ROLE_KEY is required for admin operations.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

