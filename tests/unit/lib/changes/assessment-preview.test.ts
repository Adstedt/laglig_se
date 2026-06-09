import { describe, it, expect } from 'vitest'
import {
  getAssessmentPreview,
  extractRecommendation,
  findLatestAssessmentRecommendation,
} from '@/lib/changes/assessment-preview'

const previewOutput = {
  confirmation_required: true,
  preview: {
    changeEventId: 'ce-1',
    lawListItemId: 'lli-1',
    impactLevel: 'NONE',
    recommendedStatus: 'NOT_APPLICABLE',
    analysis: 'Analys',
    recommendations: 'Inga åtgärder behövs.',
  },
}

describe('getAssessmentPreview', () => {
  it('returns the preview object for a confirmation envelope', () => {
    expect(getAssessmentPreview(previewOutput)).toMatchObject({
      recommendedStatus: 'NOT_APPLICABLE',
      impactLevel: 'NONE',
    })
  })

  it('returns null for non-confirmation or malformed output', () => {
    expect(getAssessmentPreview(null)).toBeNull()
    expect(getAssessmentPreview({ saved: true })).toBeNull()
    expect(getAssessmentPreview({ confirmation_required: true })).toBeNull()
  })
})

describe('extractRecommendation', () => {
  it('maps a complete preview to a form pre-fill', () => {
    expect(extractRecommendation(getAssessmentPreview(previewOutput))).toEqual({
      status: 'NOT_APPLICABLE',
      impactLevel: 'NONE',
      notes: 'Inga åtgärder behövs.',
    })
  })

  it('returns null when status or impact is missing', () => {
    expect(extractRecommendation({ impactLevel: 'HIGH' })).toBeNull()
    expect(extractRecommendation({ recommendedStatus: 'REVIEWED' })).toBeNull()
    expect(extractRecommendation(null)).toBeNull()
  })

  it('omits notes when recommendations is empty', () => {
    expect(
      extractRecommendation({
        recommendedStatus: 'REVIEWED',
        impactLevel: 'LOW',
      })
    ).toEqual({ status: 'REVIEWED', impactLevel: 'LOW' })
  })
})

describe('findLatestAssessmentRecommendation', () => {
  it('finds the most recent save_assessment preview across messages', () => {
    const messages = [
      { role: 'user', parts: [{ type: 'text', text: 'hej' }] },
      {
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Min bedömning...' },
          {
            type: 'tool-save_assessment',
            state: 'output-available',
            output: previewOutput,
          },
        ],
      },
    ]

    expect(findLatestAssessmentRecommendation(messages)).toEqual({
      status: 'NOT_APPLICABLE',
      impactLevel: 'NONE',
      notes: 'Inga åtgärder behövs.',
    })
  })

  it('supports the dynamic-tool part shape (toolName field)', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'save_assessment',
            state: 'output-available',
            output: previewOutput,
          },
        ],
      },
    ]

    expect(findLatestAssessmentRecommendation(messages)?.status).toBe(
      'NOT_APPLICABLE'
    )
  })

  it('ignores incomplete tool parts and other tools', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          { type: 'tool-search_laws', state: 'output-available', output: {} },
          {
            type: 'tool-save_assessment',
            state: 'input-available',
            output: undefined,
          },
        ],
      },
    ]

    expect(findLatestAssessmentRecommendation(messages)).toBeNull()
  })
})
