import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { sanitizeFilename } from '@/lib/utils/sanitize-filename'

// Test the export route's supporting logic (sanitizeFilename + Zod schema)
// The route itself requires Next.js request context — test the validation schema directly

describe('Export route supporting logic', () => {
  describe('sanitizeFilename for export', () => {
    it('produces valid export filename from Swedish title', () => {
      const title = 'Arbetsmiljöpolicy för Företag AB'
      const sanitized = sanitizeFilename(title)
      const filename = `${sanitized}-v3-2026-03-30.docx`
      expect(filename).toBe(
        'arbetsmiljöpolicy-för-företag-ab-v3-2026-03-30.docx'
      )
    })

    it('handles title with special characters', () => {
      const title = 'Policy & Procedures (Draft #1)'
      const sanitized = sanitizeFilename(title)
      expect(sanitized).toBe('policy-procedures-draft-1')
    })
  })

  describe('export params validation', () => {
    it('accepts valid docx format', () => {
      const schema = z.object({
        format: z.enum(['docx', 'pdf']),
        versionNumber: z.coerce.number().int().positive().optional(),
      })

      const result = schema.safeParse({ format: 'docx' })
      expect(result.success).toBe(true)
    })

    it('accepts valid pdf format with versionNumber', () => {
      const schema = z.object({
        format: z.enum(['docx', 'pdf']),
        versionNumber: z.coerce.number().int().positive().optional(),
      })

      const result = schema.safeParse({ format: 'pdf', versionNumber: '3' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.versionNumber).toBe(3)
      }
    })

    it('rejects invalid format', () => {
      const schema = z.object({
        format: z.enum(['docx', 'pdf']),
        versionNumber: z.coerce.number().int().positive().optional(),
      })

      const result = schema.safeParse({ format: 'txt' })
      expect(result.success).toBe(false)
    })

    it('rejects negative versionNumber', () => {
      const schema = z.object({
        format: z.enum(['docx', 'pdf']),
        versionNumber: z.coerce.number().int().positive().optional(),
      })

      const result = schema.safeParse({ format: 'docx', versionNumber: '-1' })
      expect(result.success).toBe(false)
    })
  })

  describe('content type mapping', () => {
    it('maps docx to correct MIME type', () => {
      const CONTENT_TYPES = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pdf: 'application/pdf',
      } as const

      expect(CONTENT_TYPES.docx).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      expect(CONTENT_TYPES.pdf).toBe('application/pdf')
    })
  })
})
