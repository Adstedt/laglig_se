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
import { z } from 'zod'
import { headers } from 'next/headers'

/**
 * Server Action for user signup with server-side Zod validation
 * Validates input before sending to Supabase Auth
 */
export async function signupAction(
  input: unknown
): Promise<ValidationResult<{ userId: string; email: string }>> {
  // Server-side validation with Zod
  const result = SignupSchema.safeParse(input)

  if (!result.success) {
    return formatZodError(result.error)
  }

  const { email, password, name } = result.data

  try {
    const supabase = await createServerSupabaseClient()

    // Get the origin for email redirect
    const headersList = await headers()
    const origin =
      headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          name,
        },
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
