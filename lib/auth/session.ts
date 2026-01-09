import { getServerSession as getNextAuthSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

/**
 * Wrapper around NextAuth getServerSession with our auth options
 * Use this in Server Components and API Routes to get the current session
 *
 * Note: Not wrapped with cache() as it can interfere with auth flows.
 * NextAuth's JWT session decoding is already efficient.
 */
export async function getServerSession() {
  return getNextAuthSession(authOptions)
}

/**
 * Get the current user from the session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getServerSession()
  return session?.user || null
}
