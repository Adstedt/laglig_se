import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for client-side components (Client Components with 'use client')
 * Uses browser cookies for authentication state
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
