/**
 * Story 24.3 QA gate TEST-002: unit-test the `writeUsageEvent` helper that
 * records per-LLM-call telemetry to ChatUsageEvent. AC 20 specifies "Assert
 * ChatUsageEvent rows written for each LLM call" but the integration test
 * mocks `matchRowsBatch` so the live telemetry path isn't exercised. This
 * test verifies the helper's contract directly without paying for an
 * Anthropic round-trip.
 *
 * Kept in a separate file from `matcher.test.ts` so the prisma mock
 * surface stays clean across the existing 14 matcher tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted above `import`, so plain top-level `vi.fn()`
// declarations aren't available yet inside them. `vi.hoisted` lifts the
// helper declarations to the same hoisting tier.
const { mockCreate, mockEstimate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockEstimate: vi.fn(),
}))

// Mock @anthropic-ai/sdk so importing matcher.ts doesn't try to instantiate.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn() }
  },
}))

// Mock prisma — only ChatUsageEvent.create is exercised by writeUsageEvent.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatUsageEvent: { create: mockCreate },
  },
}))

// Mock estimateCostUsd so we can assert it was called with the right shape.
vi.mock('@/lib/usage/cost-estimator', () => ({
  estimateCostUsd: (input: unknown) => mockEstimate(input),
}))

import { __test__ } from '@/lib/import/matcher'
import { ChatContextType } from '@prisma/client'

const { writeUsageEvent } = __test__

beforeEach(() => {
  vi.clearAllMocks()
  mockEstimate.mockReturnValue(0.0042)
  mockCreate.mockResolvedValue({})
})

describe('writeUsageEvent', () => {
  it('writes a ChatUsageEvent row with correct fields + IMPORT_MATCHING context', async () => {
    await writeUsageEvent(
      { workspaceId: 'ws-1', userId: 'user-1' },
      {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 80,
        cacheWriteInputTokens: 0,
      }
    )

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace_id: 'ws-1',
        user_id: 'user-1',
        model: 'claude-sonnet-4-6',
        context_type: ChatContextType.IMPORT_MATCHING,
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 80,
        cache_write_input_tokens: 0,
        reasoning_tokens: 0,
        step_count: 1,
        cost_usd_estimate: 0.0042,
      }),
    })
  })

  it('passes the right shape to estimateCostUsd', async () => {
    await writeUsageEvent(
      { workspaceId: 'ws-2', userId: 'user-2' },
      {
        inputTokens: 200,
        outputTokens: 100,
        cacheReadInputTokens: 150,
        cacheWriteInputTokens: 50,
      }
    )

    expect(mockEstimate).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-6',
      inputTokens: 200,
      outputTokens: 100,
      cacheReadInputTokens: 150,
      cacheWriteInputTokens: 50,
      reasoningTokens: 0,
    })
  })

  it('does NOT throw when prisma.chatUsageEvent.create fails — fail-safe per Story 14.27 convention', async () => {
    mockCreate.mockRejectedValue(new Error('connection lost'))
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    // Must not throw
    await expect(
      writeUsageEvent(
        { workspaceId: 'ws-3', userId: 'user-3' },
        {
          inputTokens: 50,
          outputTokens: 25,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        }
      )
    ).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CHAT_USAGE_EVENT_WRITE_FAIL]',
      expect.any(Error)
    )

    consoleErrorSpy.mockRestore()
  })

  it('does NOT throw when estimateCostUsd throws — fail-safe', async () => {
    mockEstimate.mockImplementation(() => {
      throw new Error('estimator broken')
    })
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    await expect(
      writeUsageEvent(
        { workspaceId: 'ws-4', userId: 'user-4' },
        {
          inputTokens: 10,
          outputTokens: 5,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        }
      )
    ).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CHAT_USAGE_EVENT_WRITE_FAIL]',
      expect.any(Error)
    )
    expect(mockCreate).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
