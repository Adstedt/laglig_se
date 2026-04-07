import { describe, it, expect } from 'vitest'
import { isDocumentEditable } from '@/lib/utils/document-editability'

describe('isDocumentEditable', () => {
  it('returns true for DRAFT', () => {
    expect(isDocumentEditable('DRAFT')).toBe(true)
  })

  it('returns true for IN_REVIEW', () => {
    expect(isDocumentEditable('IN_REVIEW')).toBe(true)
  })

  it('returns false for APPROVED', () => {
    expect(isDocumentEditable('APPROVED')).toBe(false)
  })

  it('returns false for SUPERSEDED', () => {
    expect(isDocumentEditable('SUPERSEDED')).toBe(false)
  })

  it('returns false for ARCHIVED', () => {
    expect(isDocumentEditable('ARCHIVED')).toBe(false)
  })
})
