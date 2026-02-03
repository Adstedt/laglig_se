'use server'

import { cookies } from 'next/headers'
import { encode, decode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import {
  getAdminSession,
  getNextAuthCookieName,
  isImpersonating,
  ADMIN_IMPERSONATING_COOKIE,
} from '@/lib/admin/auth'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/auth/workspace-context'

export async function startImpersonation(
  userId: string
): Promise<{ success: boolean; error?: string | undefined }> {
  const adminSession = await getAdminSession()
  if (!adminSession) {
    return { success: false, error: 'Admin session required' }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  })

  if (!targetUser) {
    return { success: false, error: 'User not found' }
  }

  // Guard: self-impersonation
  if (adminSession.email.toLowerCase() === targetUser.email.toLowerCase()) {
    return { success: false, error: 'Cannot impersonate yourself' }
  }

  // Guard: already impersonating
  const alreadyImpersonating = await isImpersonating()
  if (alreadyImpersonating) {
    return {
      success: false,
      error: 'Already impersonating a user. Return to admin first.',
    }
  }

  // Create NextAuth-compatible session token (JWE via NextAuth encode)
  const sessionToken = await encode({
    token: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      sub: targetUser.id,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 3600, // 1 hour
  })

  // Log to AdminAuditLog BEFORE setting cookies — if DB write fails,
  // no orphaned impersonation session is created
  await prisma.adminAuditLog.create({
    data: {
      admin_email: adminSession.email,
      action: 'IMPERSONATION_START',
      target_type: 'USER',
      target_id: targetUser.id,
      metadata: {
        targetEmail: targetUser.email,
        targetName: targetUser.name,
      },
    },
  })

  const cookieName = getNextAuthCookieName()
  const cookieStore = await cookies()

  // Set the impersonated session cookie
  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })

  // Set impersonation marker cookie
  cookieStore.set(ADMIN_IMPERSONATING_COOKIE, targetUser.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })

  // Clear active workspace to force fresh resolution for impersonated user
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return { success: true }
}

export async function endImpersonation(): Promise<{
  success: boolean
  userId?: string | undefined
  error?: string | undefined
}> {
  const adminSession = await getAdminSession()
  if (!adminSession) {
    return { success: false, error: 'Admin session required' }
  }

  const cookieName = getNextAuthCookieName()
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(cookieName)?.value
  let impersonatedUserId: string | undefined

  if (sessionToken) {
    try {
      const decoded = await decode({
        token: sessionToken,
        secret: process.env.NEXTAUTH_SECRET!,
      })
      impersonatedUserId = decoded?.id as string | undefined
    } catch {
      // Token may be expired or invalid — continue with cleanup
    }
  }

  // Clear the session cookie
  cookieStore.set(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  // Clear impersonation marker cookie
  cookieStore.set(ADMIN_IMPERSONATING_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  // Clear active workspace cookie
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  // Log to AdminAuditLog
  await prisma.adminAuditLog.create({
    data: {
      admin_email: adminSession.email,
      action: 'IMPERSONATION_END',
      target_type: 'USER',
      target_id: impersonatedUserId ?? 'unknown',
      ...(impersonatedUserId ? { metadata: { impersonatedUserId } } : {}),
    },
  })

  return { success: true, userId: impersonatedUserId }
}
