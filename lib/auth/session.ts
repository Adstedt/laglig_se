import { getServerSession as getNextAuthSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

/**
 * Wrapper around NextAuth getServerSession with our auth options
 * Use this in Server Components and API Routes to get the current session
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
