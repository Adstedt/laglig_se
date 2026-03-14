import { describe, it, expect } from 'vitest'
import { createSuggestFollowupsTool } from '@/lib/agent/tools/suggest-followups'

const toolOpts = {
  toolCallId: 'tc-1',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

describe('suggest_followups tool', () => {
  const tool = createSuggestFollowupsTool()

  it('returns valid ToolResponse shape with correct _meta', async () => {
    const result = await tool.execute(
      {
        questions: [
          { text: 'Vilka policyer behöver uppdateras?', category: 'action' },
          { text: 'När träder ändringen i kraft?', category: 'deadline' },
        ],
      },
      toolOpts
    )

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('_meta')
    expect(result._meta.tool).toBe('suggest_followups')
    expect(result._meta.executionTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('passes through questions array unchanged', async () => {
    const questions = [
      { text: 'Fråga 1', category: 'action' as const },
      { text: 'Fråga 2', category: 'context' as const },
      { text: 'Fråga 3' },
    ]

    const result = await tool.execute({ questions }, toolOpts)

    expect(result.data).toEqual(questions)
  })

  it('resultCount matches question count', async () => {
    const result = await tool.execute(
      {
        questions: [
          { text: 'Q1', category: 'action' },
          { text: 'Q2', category: 'deadline' },
          { text: 'Q3', category: 'clarification' },
        ],
      },
      toolOpts
    )

    expect(result._meta.resultCount).toBe(3)
  })

  it('handles questions without category', async () => {
    const result = await tool.execute(
      {
        questions: [{ text: 'Fråga utan kategori' }, { text: 'Ännu en fråga' }],
      },
      toolOpts
    )

    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.text).toBe('Fråga utan kategori')
  })
})
