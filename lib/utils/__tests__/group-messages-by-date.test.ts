import { describe, it, expect, vi, afterEach } from 'vitest'
import { groupMessagesByDate } from '../group-messages-by-date'
import type { UIMessage } from 'ai'

function makeMessage(
  id: string,
  createdAt: Date,
  role: 'user' | 'assistant' = 'user'
): UIMessage & { createdAt: Date } {
  return {
    id,
    role,
    parts: [{ type: 'text', text: `Message ${id}` }],
    createdAt,
  }
}

describe('groupMessagesByDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array for no messages', () => {
    expect(groupMessagesByDate([])).toEqual([])
  })

  it('groups messages from today under "Idag"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T14:00:00'))

    const messages = [
      makeMessage('1', new Date('2026-03-16T10:00:00')),
      makeMessage('2', new Date('2026-03-16T11:00:00')),
    ]

    const groups = groupMessagesByDate(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Idag')
    expect(groups[0]?.messages).toHaveLength(2)
  })

  it('groups messages from yesterday under "Igår"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T14:00:00'))

    const messages = [makeMessage('1', new Date('2026-03-15T10:00:00'))]

    const groups = groupMessagesByDate(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Igår')
  })

  it('groups messages from 2-7 days ago under "Förra veckan"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T14:00:00'))

    const messages = [
      makeMessage('1', new Date('2026-03-12T10:00:00')), // 4 days ago
    ]

    const groups = groupMessagesByDate(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Förra veckan')
  })

  it('formats older messages with full date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T14:00:00'))

    const messages = [
      makeMessage('1', new Date('2026-02-01T10:00:00')), // > 7 days ago
    ]

    const groups = groupMessagesByDate(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('1 februari 2026')
  })

  it('creates multiple groups for messages spanning multiple days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T14:00:00'))

    const messages = [
      makeMessage('1', new Date('2026-02-01T10:00:00')),
      makeMessage('2', new Date('2026-03-15T10:00:00')),
      makeMessage('3', new Date('2026-03-16T10:00:00')),
      makeMessage('4', new Date('2026-03-16T11:00:00')),
    ]

    const groups = groupMessagesByDate(messages)
    expect(groups).toHaveLength(3)
    expect(groups[0]?.label).toBe('1 februari 2026')
    expect(groups[0]?.messages).toHaveLength(1)
    expect(groups[1]?.label).toBe('Igår')
    expect(groups[1]?.messages).toHaveLength(1)
    expect(groups[2]?.label).toBe('Idag')
    expect(groups[2]?.messages).toHaveLength(2)
  })

  it('recalculates when messages array changes (pagination)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T14:00:00'))

    // Initial page
    const recent = [makeMessage('3', new Date('2026-03-16T10:00:00'))]
    let groups = groupMessagesByDate(recent)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Idag')

    // Prepend older messages
    const older = [
      makeMessage('1', new Date('2026-03-14T10:00:00')),
      makeMessage('2', new Date('2026-03-15T10:00:00')),
    ]
    groups = groupMessagesByDate([...older, ...recent])
    expect(groups).toHaveLength(3) // Förra veckan, Igår, Idag
  })
})
