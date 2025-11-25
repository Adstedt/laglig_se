import { z } from 'zod'

/**
 * Standardized API response types for validation errors
 * Consistent format: { success: false, errors: { field: string[] } }
 */

export type ValidationFieldErrors = Record<string, string[]>

export interface ValidationErrorResponse {
  success: false
  errors: ValidationFieldErrors
  message?: string
}

export interface ValidationSuccessResponse<T> {
  success: true
  data: T
}

export type ValidationResult<T> =
  | ValidationSuccessResponse<T>
  | ValidationErrorResponse

/**
 * Formats Zod validation errors into a consistent API response format
 * @param error - Zod error object
 * @returns Formatted error response with field-specific errors
 */
export function formatZodError(error: z.ZodError): ValidationErrorResponse {
  const fieldErrors = error.flatten().fieldErrors

  // Convert undefined values to empty arrays for type safety
  const errors: ValidationFieldErrors = {}
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (Array.isArray(value)) {
      errors[key] = value
    }
  }

  return {
    success: false,
    errors,
    message: 'Validation failed',
  }
}

/**
 * Creates a validation error response for a single field
 * @param field - Field name
 * @param message - Error message
 * @returns Formatted error response
 */
export function createFieldError(
  field: string,
  message: string
): ValidationErrorResponse {
  return {
    success: false,
    errors: { [field]: [message] },
    message,
  }
}

/**
 * Creates a general validation error response (not field-specific)
 * @param message - Error message
 * @returns Formatted error response
 */
export function createGeneralError(message: string): ValidationErrorResponse {
  return {
    success: false,
    errors: { _form: [message] },
    message,
  }
}

/**
 * Creates a success response with data
 * @param data - Response data
 * @returns Formatted success response
 */
export function createSuccessResponse<T>(
  data: T
): ValidationSuccessResponse<T> {
  return {
    success: true,
    data,
  }
}

/**
 * Type guard to check if a response is an error
 */
export function isValidationError<T>(
  response: ValidationResult<T>
): response is ValidationErrorResponse {
  return !response.success
}
