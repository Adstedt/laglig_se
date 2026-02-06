import { randomBytes } from 'crypto'

/**
 * Generate a cryptographically secure invitation token.
 * 32 bytes, URL-safe base64 encoded.
 * For future use by Story 5.3 (sending invitations).
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url')
}
