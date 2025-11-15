import { getServerSession } from './session'

/**
 * Require authentication for Server Actions
 * Throws an error if the user is not authenticated
 * Use this at the top of Server Actions to ensure the user is logged in
 *
 * @example
 * 'use server'
 * export async function updateProfile() {
 *   const user = await requireAuth();
 *   // ... rest of your Server Action
 * }
 */
export async function requireAuth() {
  const session = await getServerSession()

  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  return session.user
}

/**
 * Get the authenticated user's ID
 * Throws an error if not authenticated
 */
export async function requireUserId() {
  const user = await requireAuth()
  return user.id
}
