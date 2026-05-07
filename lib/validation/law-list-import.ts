/**
 * Story 24.1: Zod Validation Schemas for Law List Import operations.
 * Server Action input validation for the Epic 24 import pipeline.
 *
 * Subsequent stories implement the actions these schemas guard:
 *  - 24.2: createImport, parseImportFile (uses CreateImportInput, ParseImportInput)
 *  - 24.3: runMatching (no input schema; takes importId only)
 *  - 24.4: acceptRow / replaceRowMatch / rejectRow / requestCatalogAdd / commitImport
 *          (uses RowDecisionInput + CommitImportInput)
 *  - 24.5: fulfillCatalogRequest (uses FulfillCatalogRequestInput)
 */

import { z } from 'zod'

// ============================================================================
// ENUMS - Match Prisma schema
// ============================================================================

export const ImportSourceTypeEnum = z.enum(['xlsx', 'csv', 'paste'])

// ============================================================================
// CREATE IMPORT (Story 24.2)
// ============================================================================

export const CreateImportSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filnamn krävs')
    .max(255, 'Filnamnet får vara max 255 tecken'),
  source_type: ImportSourceTypeEnum,
})

export type CreateImportInput = z.infer<typeof CreateImportSchema>

// ============================================================================
// PARSE IMPORT (Story 24.2)
// ============================================================================

// Story 24.2 AC 20: 5 MB binary cap → ~6.7 MB base64-encoded.
// First-line guard so an oversized payload never enters Prisma; the server
// action also re-checks decoded byte length defensively.
const MAX_BASE64_FILE_BUFFER_LENGTH = 7 * 1024 * 1024

export const ParseImportSchema = z.object({
  importId: z.string().uuid('Ogiltigt import-ID'),
  // base64-encoded file buffer; the parser decodes server-side
  fileBuffer: z
    .string()
    .min(1, 'Filinnehåll krävs')
    .max(
      MAX_BASE64_FILE_BUFFER_LENGTH,
      'Filen är större än 5 MB. Vi importerar för närvarande max 5 MB.'
    ),
})

export type ParseImportInput = z.infer<typeof ParseImportSchema>

// ============================================================================
// ROW DECISION (Story 24.4) — discriminated union
// ============================================================================

export const RowDecisionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('accept'),
    rowId: z.string().uuid('Ogiltigt rad-ID'),
  }),
  z.object({
    type: z.literal('replace'),
    rowId: z.string().uuid('Ogiltigt rad-ID'),
    candidateDocId: z.string().uuid('Ogiltigt dokument-ID'),
  }),
  z.object({
    type: z.literal('reject'),
    rowId: z.string().uuid('Ogiltigt rad-ID'),
  }),
  z.object({
    type: z.literal('request'),
    rowId: z.string().uuid('Ogiltigt rad-ID'),
    note: z
      .string()
      .max(1000, 'Noteringen får vara max 1000 tecken')
      .optional(),
  }),
])

export type RowDecisionInput = z.infer<typeof RowDecisionSchema>

// ============================================================================
// COMMIT IMPORT (Story 24.4)
// ============================================================================

export const CommitImportSchema = z.object({
  importId: z.string().uuid('Ogiltigt import-ID'),
  listName: z
    .string()
    .min(1, 'Namn på laglista krävs')
    .max(100, 'Namnet får vara max 100 tecken'),
})

export type CommitImportInput = z.infer<typeof CommitImportSchema>

// ============================================================================
// FULFILL CATALOG REQUEST (Story 24.5 — admin)
// ============================================================================

export const FulfillCatalogRequestSchema = z.object({
  requestId: z.string().uuid('Ogiltigt förfrågnings-ID'),
  fulfilledWithDocumentId: z.string().uuid('Ogiltigt dokument-ID'),
  adminNote: z
    .string()
    .max(1000, 'Noteringen får vara max 1000 tecken')
    .optional(),
})

export type FulfillCatalogRequestInput = z.infer<
  typeof FulfillCatalogRequestSchema
>

// ============================================================================
// REJECT CATALOG REQUEST (Story 24.5 — admin)
// ============================================================================

export const RejectCatalogRequestSchema = z.object({
  requestId: z.string().uuid('Ogiltigt förfrågnings-ID'),
  adminNote: z
    .string()
    .max(1000, 'Noteringen får vara max 1000 tecken')
    .optional(),
})

export type RejectCatalogRequestInput = z.infer<
  typeof RejectCatalogRequestSchema
>

// ============================================================================
// LIST CATALOG REQUESTS (Story 24.5 — admin)
// ============================================================================

export const ListCatalogRequestsSchema = z.object({
  status: z
    .enum(['pending', 'fulfilled', 'rejected', 'all'])
    .default('pending'),
  rangeDays: z.number().int().min(1).max(365).default(30),
})

export type ListCatalogRequestsInput = z.infer<typeof ListCatalogRequestsSchema>
