/**
 * Zod Schema Validation for Canonical Document JSON
 * Story 14.1, Task 7 (AC: 16)
 *
 * Validates that a JSON object conforms to the CanonicalDocumentJson interface.
 * Enforces the mutual exclusivity of divisions/chapters.
 */

import { z } from 'zod'

// ============================================================================
// Zod Schemas
// ============================================================================

export const ContentRoleSchema = z.enum([
  'STYCKE',
  'LIST_ITEM',
  'ALLMANT_RAD',
  'PREAMBLE',
  'TABLE',
  'HEADING',
  'TRANSITION_PROVISION',
  'FOOTNOTE',
])

export const DocumentTypeSchema = z.enum([
  'SFS_LAW',
  'SFS_AMENDMENT',
  'AGENCY_REGULATION',
  'EU_REGULATION',
  'EU_DIRECTIVE',
])

export const CanonicalStyckeSchema = z.object({
  number: z.number().nullable(),
  text: z.string(),
  role: ContentRoleSchema,
  htmlContent: z.string().optional(),
})

export const CanonicalParagrafSchema = z.object({
  number: z.string(),
  heading: z.string().nullable(),
  content: z.string(),
  amendedBy: z.string().nullable(),
  stycken: z.array(CanonicalStyckeSchema),
})

export const CanonicalChapterSchema = z.object({
  number: z.string().nullable(),
  title: z.string().nullable(),
  paragrafer: z.array(CanonicalParagrafSchema),
})

export const CanonicalDivisionSchema = z.object({
  number: z.string(),
  title: z.string().nullable(),
  chapters: z.array(CanonicalChapterSchema),
})

export const CanonicalPreambleSchema = z.object({
  htmlContent: z.string(),
  text: z.string(),
})

export const CanonicalAppendixSchema = z.object({
  title: z.string().nullable(),
  htmlContent: z.string(),
  text: z.string(),
})

export const CanonicalDocumentJsonSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    documentType: DocumentTypeSchema,
    title: z.string().nullable(),
    documentNumber: z.string().nullable(),
    divisions: z.array(CanonicalDivisionSchema).nullable(),
    chapters: z.array(CanonicalChapterSchema),
    preamble: CanonicalPreambleSchema.nullable(),
    transitionProvisions: z.array(CanonicalStyckeSchema).nullable(),
    appendices: z.array(CanonicalAppendixSchema).nullable(),
    metadata: z.object({
      sfsNumber: z.string().nullable(),
      baseLawSfs: z.string().nullable(),
      effectiveDate: z.string().nullable(),
    }),
  })
  .refine(
    (doc) => {
      // Mutual exclusivity: when divisions is populated, chapters must be empty
      if (doc.divisions !== null && doc.divisions.length > 0) {
        return doc.chapters.length === 0
      }
      return true
    },
    {
      message:
        'divisions and chapters are mutually exclusive: when divisions is populated, chapters must be empty',
      path: ['chapters'],
    }
  )

// ============================================================================
// Validation Function
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a JSON object against the canonical document schema.
 * Returns human-readable error messages with paths.
 */
export function validateCanonicalJson(json: unknown): ValidationResult {
  const result = CanonicalDocumentJsonSchema.safeParse(json)

  if (result.success) {
    return { valid: true, errors: [] }
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })

  return { valid: false, errors }
}
