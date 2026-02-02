import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const ADMIN_SESSION_COOKIE = 'admin_session'

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
