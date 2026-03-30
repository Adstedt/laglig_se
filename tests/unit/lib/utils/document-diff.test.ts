import { describe, it, expect } from 'vitest'
import { computeDiff } from '@/lib/utils/document-diff'

describe('computeDiff', () => {
  it('returns unchanged segment for identical texts', () => {
    const result = computeDiff('hello world', 'hello world')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      value: 'hello world',
      added: false,
      removed: false,
    })
  })

  it('detects added text', () => {
    const result = computeDiff('hello', 'hello world')
    const added = result.filter((s) => s.added)
    expect(added.length).toBeGreaterThan(0)
    expect(added.some((s) => s.value.includes('world'))).toBe(true)
  })

  it('detects removed text', () => {
    const result = computeDiff('hello world', 'hello')
    const removed = result.filter((s) => s.removed)
    expect(removed.length).toBeGreaterThan(0)
    expect(removed.some((s) => s.value.includes('world'))).toBe(true)
  })

  it('detects mixed changes', () => {
    const result = computeDiff('the quick brown fox', 'the slow red fox')
    const added = result.filter((s) => s.added)
    const removed = result.filter((s) => s.removed)
    expect(added.length).toBeGreaterThan(0)
    expect(removed.length).toBeGreaterThan(0)
  })

  it('handles empty strings', () => {
    const result = computeDiff('', 'new text')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      value: 'new text',
      added: true,
      removed: false,
    })
  })

  it('handles empty new text', () => {
    const result = computeDiff('old text', '')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      value: 'old text',
      added: false,
      removed: true,
    })
  })

  it('handles both empty strings', () => {
    const result = computeDiff('', '')
    expect(result).toHaveLength(0)
  })

  it('segments have only added/removed/unchanged flags', () => {
    const result = computeDiff('a b c', 'a d c')
    for (const seg of result) {
      expect(typeof seg.value).toBe('string')
      expect(typeof seg.added).toBe('boolean')
      expect(typeof seg.removed).toBe('boolean')
      // A segment cannot be both added and removed
      expect(seg.added && seg.removed).toBe(false)
    }
  })

  it('preserves whitespace in diff output', () => {
    const result = computeDiff('hello  world', 'hello  world')
    const combined = result.map((s) => s.value).join('')
    expect(combined).toBe('hello  world')
  })
})
