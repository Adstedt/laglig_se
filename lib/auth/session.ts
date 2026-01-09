import { cache } from 'react'
import { getServerSession as getNextAuthSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

/**
 * Wrapper around NextAuth getServerSession with our auth options
 * Use this in Server Components and API Routes to get the current session
 *
 * Wrapped with React's cache() to deduplicate calls within a single request.
 */
export const getServerSession = cache(async () => {
  return getNextAuthSession(authOptions)
})

/**
 * Get the current user from the session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getServerSession()
  return session?.user || null
}
