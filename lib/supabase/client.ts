import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

/**
 * Supabase client for client-side components (Client Components with 'use client')
 * Uses browser cookies for authentication state
 */
export const supabase = createClientComponentClient()
