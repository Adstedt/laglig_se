/**
 * Zod Validation Schemas for Law API Routes
 * Story 2.13 QA Fix: VAL-001
 *
 * Per coding standards 17.6: Always validate user input with Zod
 */

import { z } from 'zod'

/**
 * SFS number validation
 * Accepts: "1977:1160", "SFS 1977:1160", "SFS%201977:1160" (URL encoded)
 */
export const SfsNumberSchema = z
  .string()
  .min(1, 'SFS number is required')
  .max(50, 'SFS number too long')
  .transform((val) => decodeURIComponent(val))
  .refine(
    (val) => /^(SFS\s*)?\d{4}:\d+$/.test(val),
    'Invalid SFS number format. Expected YYYY:NNN or SFS YYYY:NNN'
  )

/**
 * Date parameter validation (YYYY-MM-DD format)
 */
export const DateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => {
    const date = new Date(val)
    return !isNaN(date.getTime())
  }, 'Invalid date value')
  .transform((val) => new Date(val))

/**
 * Schema for /api/laws/[sfs]/version/[date] route params
 */
export const VersionRouteParamsSchema = z.object({
  sfs: SfsNumberSchema,
  date: DateParamSchema,
})

/**
 * Schema for /api/laws/[sfs]/history route params
 */
export const HistoryRouteParamsSchema = z.object({
  sfs: SfsNumberSchema,
})

/**
 * Schema for /api/laws/[sfs]/diff query params
 */
export const DiffQueryParamsSchema = z.object({
  from: DateParamSchema,
  to: DateParamSchema,
  changesOnly: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
})

/**
 * Schema for /api/laws/[sfs]/diff route params
 */
export const DiffRouteParamsSchema = z.object({
  sfs: SfsNumberSchema,
})

/**
 * Helper to format Zod errors for API responses
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
    .join('; ')
}
