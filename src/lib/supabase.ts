import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Shared singleton browser client. The app is almost entirely client-rendered,
// so the session is persisted in the browser and automatically attached to every
// query — which is what makes Row Level Security work for the signed-in user.
let browserClient: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return browserClient
}

// Plain client (kept for backwards-compatibility with existing imports).
export const supabase = getClient()

// Returns the shared singleton. Previously this created a new auth-helpers
// cookie client on every call; using one shared instance avoids session
// mismatches between the auth UI and the database service.
export const createSupabaseClient = () => getClient()
