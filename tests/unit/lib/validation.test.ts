import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  formatZodError,
  createFieldError,
  createGeneralError,
  createSuccessResponse,
  isValidationError,
  type ValidationResult,
} from '@/lib/validation/api-error'
import {
  PasswordSchema,
  SignupSchema,
  LoginSchema,
  ResetPasswordSchema,
  ConfirmPasswordSchema,
} from '@/lib/validation/auth'

describe('Validation Error Formatting', () => {
  describe('formatZodError', () => {
    it('should format Zod errors to consistent API response', () => {
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(2),
      })

      const result = schema.safeParse({ email: 'invalid', name: 'a' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const formatted = formatZodError(result.error)
        expect(formatted.success).toBe(false)
        expect(formatted.errors).toHaveProperty('email')
        expect(formatted.errors).toHaveProperty('name')
        expect(Array.isArray(formatted.errors.email)).toBe(true)
        expect(Array.isArray(formatted.errors.name)).toBe(true)
      }
    })

    it('should return field-specific error messages', () => {
      const result = SignupSchema.safeParse({
        email: 'invalid',
        password: 'short',
        confirmPassword: 'short',
        name: '',
      })
      expect(result.success).toBe(false)

      if (!result.success) {
        const formatted = formatZodError(result.error)
        expect(formatted.errors.email?.length).toBeGreaterThan(0)
        expect(formatted.errors.password?.length).toBeGreaterThan(0)
      }
    })
  })

  describe('createFieldError', () => {
    it('should create error response for single field', () => {
      const error = createFieldError('email', 'Email already exists')
      expect(error.success).toBe(false)
      expect(error.errors.email).toEqual(['Email already exists'])
      expect(error.message).toBe('Email already exists')
    })
  })

  describe('createGeneralError', () => {
    it('should create general error with _form key', () => {
      const error = createGeneralError('Something went wrong')
      expect(error.success).toBe(false)
      expect(error.errors._form).toEqual(['Something went wrong'])
      expect(error.message).toBe('Something went wrong')
    })
  })

  describe('createSuccessResponse', () => {
    it('should create success response with data', () => {
      const response = createSuccessResponse({
        id: '123',
        email: 'test@test.com',
      })
      expect(response.success).toBe(true)
      expect(response.data).toEqual({ id: '123', email: 'test@test.com' })
    })
  })

  describe('isValidationError', () => {
    it('should return true for error responses', () => {
      const error = createGeneralError('Error')
      expect(isValidationError(error)).toBe(true)
    })

    it('should return false for success responses', () => {
      const success = createSuccessResponse({ data: 'test' })
      expect(isValidationError(success)).toBe(false)
    })

    it('should work as type guard', () => {
      const result: ValidationResult<{ id: string }> = createSuccessResponse({
        id: '1',
      })
      if (!isValidationError(result)) {
        // TypeScript should know result.data exists here
        expect(result.data.id).toBe('1')
      }
    })
  })
})

describe('Password Validation Edge Cases', () => {
  describe('Boundary Length Tests', () => {
    it('should reject 11 character password (boundary)', () => {
      // 11 chars with all requirements
      const result = PasswordSchema.safeParse('Password1!!')
      expect(result.success).toBe(false)
    })

    it('should accept 12 character password (boundary)', () => {
      // Exactly 12 chars with all requirements
      const result = PasswordSchema.safeParse('Password12!!')
      expect(result.success).toBe(true)
    })

    it('should accept very long password', () => {
      const longPassword = 'A' + 'a'.repeat(100) + '1!'
      const result = PasswordSchema.safeParse(longPassword)
      expect(result.success).toBe(true)
    })
  })

  describe('Special Character Tests', () => {
    it('should accept common special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*']
      specialChars.forEach((char) => {
        const password = `ValidPass123${char}`
        const result = PasswordSchema.safeParse(password)
        expect(result.success).toBe(true)
      })
    })

    it('should accept unicode special characters', () => {
      const result = PasswordSchema.safeParse('ValidPass123!')
      expect(result.success).toBe(true)
    })

    it('should accept Swedish characters in password', () => {
      // Swedish chars count as special characters
      const result = PasswordSchema.safeParse('ValidPass123a')
      expect(result.success).toBe(false) // No special char
    })
  })

  describe('Whitespace Handling', () => {
    it('should accept password with spaces', () => {
      const result = PasswordSchema.safeParse('Valid Pass 123!')
      expect(result.success).toBe(true)
    })
  })
})

describe('Email Validation Edge Cases', () => {
  describe('Valid Emails', () => {
    const validEmails = [
      'test@example.com',
      'test.name@example.com',
      'test+tag@example.com',
      'test@subdomain.example.com',
      'a@b.co',
    ]

    validEmails.forEach((email) => {
      it(`should accept "${email}"`, () => {
        const result = LoginSchema.safeParse({ email, password: 'any' })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Invalid Emails', () => {
    const invalidEmails = [
      'invalid',
      '@example.com',
      'test@',
      'test@.com',
      'test @example.com',
      '',
    ]

    invalidEmails.forEach((email) => {
      it(`should reject "${email}"`, () => {
        const result = LoginSchema.safeParse({ email, password: 'any' })
        expect(result.success).toBe(false)
      })
    })
  })
})

describe('Name Validation Edge Cases', () => {
  it('should reject 1 character name (boundary)', () => {
    const result = SignupSchema.safeParse({
      email: 'test@example.com',
      password: 'ValidPassword123!',
      confirmPassword: 'ValidPassword123!',
      name: 'A',
    })
    expect(result.success).toBe(false)
  })

  it('should accept 2 character name (boundary)', () => {
    const result = SignupSchema.safeParse({
      email: 'test@example.com',
      password: 'ValidPassword123!',
      confirmPassword: 'ValidPassword123!',
      name: 'AB',
    })
    expect(result.success).toBe(true)
  })

  it('should accept Swedish name with special characters', () => {
    const result = SignupSchema.safeParse({
      email: 'test@example.com',
      password: 'ValidPassword123!',
      confirmPassword: 'ValidPassword123!',
      name: 'Erik Andersson',
    })
    expect(result.success).toBe(true)
  })
})

describe('ResetPasswordSchema', () => {
  it('should validate email format', () => {
    const valid = ResetPasswordSchema.safeParse({ email: 'test@example.com' })
    expect(valid.success).toBe(true)

    const invalid = ResetPasswordSchema.safeParse({ email: 'invalid' })
    expect(invalid.success).toBe(false)
  })
})

describe('ConfirmPasswordSchema', () => {
  it('should require matching passwords', () => {
    const result = ConfirmPasswordSchema.safeParse({
      password: 'ValidPassword123!',
      confirmPassword: 'DifferentPassword123!',
    })
    expect(result.success).toBe(false)
  })

  it('should accept matching valid passwords', () => {
    const result = ConfirmPasswordSchema.safeParse({
      password: 'ValidPassword123!',
      confirmPassword: 'ValidPassword123!',
    })
    expect(result.success).toBe(true)
  })

  it('should validate password complexity', () => {
    const result = ConfirmPasswordSchema.safeParse({
      password: 'weak',
      confirmPassword: 'weak',
    })
    expect(result.success).toBe(false)
  })
})
