import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for server-side components (Server Components, API Routes)
 * Uses server-side cookies for authentication state
 * Must be called within an async function due to cookies() being async
 */
export function createServerSupabaseClient() {
  return createServerComponentClient({ cookies })
}
