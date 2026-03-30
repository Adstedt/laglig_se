import { describe, it, expect } from 'vitest'
import { sanitizeFilename } from '@/lib/utils/sanitize-filename'

describe('sanitizeFilename', () => {
  it('lowercases the name', () => {
    expect(sanitizeFilename('HELLO')).toBe('hello')
  })

  it('preserves Swedish characters å, ä, ö', () => {
    expect(sanitizeFilename('Årsredovisning')).toBe('årsredovisning')
    expect(sanitizeFilename('Ärende')).toBe('ärende')
    expect(sanitizeFilename('Övrigt')).toBe('övrigt')
  })

  it('replaces special characters with hyphens', () => {
    expect(sanitizeFilename('hello world!')).toBe('hello-world')
  })

  it('replaces multiple special chars with single hyphen', () => {
    expect(sanitizeFilename('a & b @ c')).toBe('a-b-c')
  })

  it('strips leading and trailing hyphens', () => {
    expect(sanitizeFilename('--hello--')).toBe('hello')
  })

  it('handles spaces', () => {
    expect(sanitizeFilename('my document title')).toBe('my-document-title')
  })

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('')
  })
})
