import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}


/**
 * Who is signed in, read from the locally stored session — no network call.
 *
 * `auth.getUser()` makes a round trip to Supabase Auth on every call, and the
 * navbar, bottom nav and page each did it on every page load, which stalled
 * every data fetch behind 2–3 extra requests. For UI decisions (show/hide,
 * redirect to sign-in, filter by user id) the local session is enough: RLS and
 * the API routes still verify the JWT on the server for every real read/write.
 *
 * Returns the same `{ data: { user } }` shape as `auth.getUser()`.
 */
export async function getSessionUser(client: ReturnType<typeof createClient> = createClient()) {
  const {
    data: { session },
  } = await client.auth.getSession()
  return { data: { user: session?.user ?? null } }
}
