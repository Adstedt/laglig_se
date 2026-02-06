import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { decode } from 'next-auth/jwt'

export const ADMIN_SESSION_COOKIE = 'admin_session'
export const ADMIN_IMPERSONATING_COOKIE = 'admin_impersonating'

/**
 * Get the correct NextAuth session cookie name for the current environment.
 * Production uses __Secure- prefix (HTTPS required).
 */
export function getNextAuthCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'
}

const getSecret = () => new TextEncoder().encode(process.env.ADMIN_JWT_SECRET)

/**
 * Check if an email is in the ADMIN_EMAILS allowlist.
 * Comma-separated, trimmed, case-insensitive.
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS
  if (!adminEmails) return false

  const normalizedEmail = email.trim().toLowerCase()
  const allowedEmails = adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())

  return allowedEmails.includes(normalizedEmail)
}

/**
 * Create a signed JWT for an admin session (24h expiry).
 */
export async function createAdminToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

/**
 * Verify and decode an admin JWT. Returns null if invalid/expired.
 */
export async function verifyAdminToken(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { email: payload.email as string }
  } catch {
    return null
  }
}

/**
 * Read admin_session cookie, verify token, return decoded payload or null.
 */
export async function getAdminSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!token) return null

  return verifyAdminToken(token)
}

/**
 * Check if an admin is currently impersonating a user.
 * Uses a dedicated marker cookie set by startImpersonation().
 */
export async function isImpersonating(): Promise<boolean> {
  const cookieStore = await cookies()
  const marker = cookieStore.get(ADMIN_IMPERSONATING_COOKIE)?.value
  if (!marker) return false

  const adminSession = await getAdminSession()
  return adminSession !== null
}

/**
 * Get detailed impersonation info for rendering the banner.
 * Returns null if not impersonating.
 */
export async function getImpersonationInfo(): Promise<{
  adminEmail: string
  impersonatedUserId: string
  impersonatedEmail: string
} | null> {
  const cookieStore = await cookies()
  const marker = cookieStore.get(ADMIN_IMPERSONATING_COOKIE)?.value
  if (!marker) return null

  const adminSession = await getAdminSession()
  if (!adminSession) return null

  const sessionToken = cookieStore.get(getNextAuthCookieName())?.value
  if (!sessionToken) return null

  try {
    const decoded = await decode({
      token: sessionToken,
      secret: process.env.NEXTAUTH_SECRET!,
    })

    if (!decoded?.id || !decoded?.email) return null

    return {
      adminEmail: adminSession.email,
      impersonatedUserId: decoded.id as string,
      impersonatedEmail: decoded.email as string,
    }
  } catch {
    return null
  }
}
