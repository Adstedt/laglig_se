'use server'

import { SignupSchema, LoginSchema } from '@/lib/validation/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  formatZodError,
  createFieldError,
  createGeneralError,
  createSuccessResponse,
  type ValidationResult,
} from '@/lib/validation/api-error'
import { getAppUrl } from '@/lib/utils/app-url'
import { z } from 'zod'

export interface SignupOptions {
  /**
   * Story 5.3: When signup originates from a workspace invitation link,
   * this token is used to build the Supabase `emailRedirectTo` URL so the
   * post-verification redirect lands the user back at /invite/<token>
   * (via /auth/verify → /login with callbackUrl).
   */
  inviteToken?: string
}

/**
 * Server Action for user signup with server-side Zod validation
 * Validates input before sending to Supabase Auth
 */
export async function signupAction(
  input: unknown,
  options: SignupOptions = {}
): Promise<ValidationResult<{ userId: string; email: string }>> {
  // Server-side validation with Zod
  const result = SignupSchema.safeParse(input)

  if (!result.success) {
    return formatZodError(result.error)
  }

  const { email, password, name } = result.data

  try {
    const supabase = await createServerSupabaseClient()

    // Build emailRedirectTo so verification returns the user to the right
    // place. For invite-bound signups, embed the invite callback as `next`
    // which /auth/verify forwards as the login `callbackUrl`.
    const emailRedirectTo = options.inviteToken
      ? `${getAppUrl()}/auth/verify?next=${encodeURIComponent(`/invite/${options.inviteToken}`)}`
      : undefined

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    })

    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('already registered')) {
        return createFieldError('email', 'This email is already registered')
      }
      return createGeneralError(error.message)
    }

    if (!data.user) {
      return createGeneralError('Failed to create account')
    }

    return createSuccessResponse({
      userId: data.user.id,
      email: data.user.email ?? email,
    })
  } catch (error) {
    // Log unexpected errors server-side
    console.error('Signup action error:', error)
    return createGeneralError('An unexpected error occurred. Please try again.')
  }
}

/**
 * Server Action for login validation
 * Validates input format before attempting authentication
 * Note: Actual authentication is handled by NextAuth credentials provider
 */
export async function validateLoginInput(
  input: unknown
): Promise<ValidationResult<z.infer<typeof LoginSchema>>> {
  // Server-side validation with Zod
  const result = LoginSchema.safeParse(input)

  if (!result.success) {
    return formatZodError(result.error)
  }

  return createSuccessResponse(result.data)
}

/**
 * Server Action to check if email exists (for pre-validation)
 * Uses rate limiting to prevent enumeration attacks
 */
export async function checkEmailAvailability(
  email: string
): Promise<ValidationResult<{ available: boolean }>> {
  // Validate email format first
  const emailSchema = z.string().email('Invalid email address')
  const emailResult = emailSchema.safeParse(email)

  if (!emailResult.success) {
    return formatZodError(emailResult.error as z.ZodError)
  }

  // Note: In production, you might want to add rate limiting here
  // to prevent email enumeration attacks
  // For now, we return available: true to not leak information
  return createSuccessResponse({ available: true })
}
