import crypto from 'crypto'

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured')
  return secret
}

/**
 * Generate an HMAC-SHA256 signed unsubscribe token.
 * Payload format: base64url(`${userId}:${workspaceId}:${signature}`)
 * No expiry — GDPR/CAN-SPAM requires unsubscribe links to work indefinitely.
 */
export function generateUnsubscribeToken(
  userId: string,
  workspaceId: string
): string {
  const payload = `${userId}:${workspaceId}`
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url')

  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

/**
 * Verify an unsubscribe token using constant-time comparison.
 * Returns the decoded userId and workspaceId, or null if invalid.
 */
export function verifyUnsubscribeToken(
  token: string
): { userId: string; workspaceId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')

    // Expect exactly 3 parts: userId, workspaceId, signature
    if (parts.length !== 3) return null

    const [userId, workspaceId, providedSignature] = parts as [
      string,
      string,
      string,
    ]

    if (!userId || !workspaceId || !providedSignature) return null

    const expectedPayload = `${userId}:${workspaceId}`
    const expectedSignature = crypto
      .createHmac('sha256', getSecret())
      .update(expectedPayload)
      .digest('base64url')

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(providedSignature, 'utf-8')
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8')

    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null

    return { userId, workspaceId }
  } catch {
    return null
  }
}

/**
 * Generate a full unsubscribe URL for embedding in email footers.
 */
export function generateUnsubscribeUrl(
  userId: string,
  workspaceId: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'
  const token = generateUnsubscribeToken(userId, workspaceId)
  return `${baseUrl}/unsubscribe?token=${token}`
}
