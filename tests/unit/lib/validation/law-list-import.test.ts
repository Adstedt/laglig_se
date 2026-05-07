/**
 * Story 24.1: Unit tests for Law List Import validation schemas.
 * Each schema asserts 1 valid + 3 invalid payloads (story AC 12).
 */

import { describe, it, expect } from 'vitest'
import {
  CreateImportSchema,
  ParseImportSchema,
  RowDecisionSchema,
  CommitImportSchema,
  FulfillCatalogRequestSchema,
} from '@/lib/validation/law-list-import'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'
const otherUUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

describe('CreateImportSchema', () => {
  it('accepts a valid xlsx import payload', () => {
    const result = CreateImportSchema.safeParse({
      filename: 'notisum-export-2026.xlsx',
      source_type: 'xlsx',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing filename (required field)', () => {
    const result = CreateImportSchema.safeParse({
      source_type: 'csv',
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong type for source_type (must be enum)', () => {
    const result = CreateImportSchema.safeParse({
      filename: 'data.xlsx',
      source_type: 'pdf',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty filename', () => {
    const result = CreateImportSchema.safeParse({
      filename: '',
      source_type: 'xlsx',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Filnamn krävs')
    }
  })
})

describe('ParseImportSchema', () => {
  it('accepts a valid payload', () => {
    const result = ParseImportSchema.safeParse({
      importId: validUUID,
      fileBuffer: 'UEsDBBQAAAAIAA==', // base64-shaped sample
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing importId', () => {
    const result = ParseImportSchema.safeParse({
      fileBuffer: 'UEsDBBQA',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid importId', () => {
    const result = ParseImportSchema.safeParse({
      importId: 'not-a-uuid',
      fileBuffer: 'UEsDBBQA',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Ogiltigt import-ID')
    }
  })

  it('rejects empty fileBuffer', () => {
    const result = ParseImportSchema.safeParse({
      importId: validUUID,
      fileBuffer: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('RowDecisionSchema (discriminated union)', () => {
  it('accepts a valid accept decision', () => {
    const result = RowDecisionSchema.safeParse({
      type: 'accept',
      rowId: validUUID,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid replace decision with candidateDocId', () => {
    const result = RowDecisionSchema.safeParse({
      type: 'replace',
      rowId: validUUID,
      candidateDocId: otherUUID,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid reject decision', () => {
    const result = RowDecisionSchema.safeParse({
      type: 'reject',
      rowId: validUUID,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid request decision with note', () => {
    const result = RowDecisionSchema.safeParse({
      type: 'request',
      rowId: validUUID,
      note: 'Saknar AFS 2024:1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown discriminator', () => {
    const result = RowDecisionSchema.safeParse({
      type: 'magical',
      rowId: validUUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects replace decision missing candidateDocId', () => {
    const result = RowDecisionSchema.safeParse({
      type: 'replace',
      rowId: validUUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects request decision with note over 1000 chars', () => {
    const result = RowDecisionSchema.safeParse({
      type: 'request',
      rowId: validUUID,
      note: 'a'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})

describe('CommitImportSchema', () => {
  it('accepts a valid payload', () => {
    const result = CommitImportSchema.safeParse({
      importId: validUUID,
      listName: 'Importerad lista 2026',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing listName', () => {
    const result = CommitImportSchema.safeParse({
      importId: validUUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid importId', () => {
    const result = CommitImportSchema.safeParse({
      importId: 'nope',
      listName: 'Lista',
    })
    expect(result.success).toBe(false)
  })

  it('rejects listName over 100 chars', () => {
    const result = CommitImportSchema.safeParse({
      importId: validUUID,
      listName: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })
})

describe('FulfillCatalogRequestSchema', () => {
  it('accepts a valid payload with admin note', () => {
    const result = FulfillCatalogRequestSchema.safeParse({
      requestId: validUUID,
      fulfilledWithDocumentId: otherUUID,
      adminNote: 'Ingestat från av.se',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing fulfilledWithDocumentId', () => {
    const result = FulfillCatalogRequestSchema.safeParse({
      requestId: validUUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid requestId', () => {
    const result = FulfillCatalogRequestSchema.safeParse({
      requestId: 'not-a-uuid',
      fulfilledWithDocumentId: otherUUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects adminNote over 1000 chars', () => {
    const result = FulfillCatalogRequestSchema.safeParse({
      requestId: validUUID,
      fulfilledWithDocumentId: otherUUID,
      adminNote: 'a'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})
