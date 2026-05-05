/**
 * Story 14.27: Integration test for the ChatUsageEvent write path.
 *
 * Verifies that:
 * 1. A ChatUsageEvent row is written with correct token values when streamText
 *    completes successfully (onFinish fires with stub totalUsage).
 * 2. The stream response still succeeds when the Prisma insert throws
 *    (fail-safe — AC 4 + AC 15).
 *
 * Strategy: mock `streamText` to capture the onFinish callback and invoke it
 * manually with a stub totalUsage shape. Verify prisma.chatUsageEvent.create
 * was called with the expected data shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const TEST_USER_ID = '11111111-1111-4111-a111-111111111111'
const TEST_WORKSPACE_ID = '22222222-2222-4222-a222-222222222222'

// Capture the onFinish callback passed to streamText
let capturedOnFinish:
  | ((_event: {
      totalUsage: Record<string, unknown>
      steps?: Array<unknown>
    }) => Promise<void> | void)
  | undefined

// Mock prisma
const mockChatUsageEventCreate = vi.fn().mockResolvedValue({ id: 'event-1' })
const mockWorkspaceFindUniqueOrThrow = vi
  .fn()
  .mockResolvedValue({ created_at: new Date('2026-04-13T00:00:00.000Z') })
const mockWorkspaceUsageUpsert = vi.fn().mockResolvedValue({})
// Story 5.5c: onFinish wraps ChatUsageEvent.create + WorkspaceUsage.upsert in
// prisma.$transaction. The mock executes the array sequentially so that the
// first element (chatUsageEvent.create) still fires and is observable to the
// existing assertions.
const mockTransaction = vi.fn().mockImplementation(async (ops: unknown) => {
  if (Array.isArray(ops)) return Promise.all(ops as Array<Promise<unknown>>)
  return ops
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyProfile: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    chatUsageEvent: {
      create: mockChatUsageEventCreate,
    },
    workspace: {
      findUniqueOrThrow: mockWorkspaceFindUniqueOrThrow,
    },
    workspaceUsage: {
      upsert: mockWorkspaceUsageUpsert,
    },
    $transaction: (arg: unknown) => mockTransaction(arg),
  },
}))

// Story 5.5c: chat route now imports assertWithinTokenQuota which transitively
// pulls @/lib/usage/seat-cache → @/lib/usage/seats → @/lib/stripe/config →
// server-only env. Short-circuit the gate so the test stays focused on the
// telemetry write path (Story 14.27 scope).
vi.mock('@/lib/usage/check', () => ({
  assertWithinTokenQuota: vi.fn().mockResolvedValue({}),
  TokenQuotaExceededError: class TokenQuotaExceededError extends Error {},
}))

// Story 5.5c TOKEN-002: chat route imports Sentry for telemetry-write
// alerting. Stub to a no-op so tests don't try to send real events.
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// Mock auth — return a stub authenticated session
vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: 'test@example.com' },
  }),
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  getWorkspaceContext: vi
    .fn()
    .mockResolvedValue({ workspaceId: TEST_WORKSPACE_ID }),
}))

// Mock redis/ratelimit — skip rate limiting
vi.mock('@/lib/cache/redis', () => ({
  redis: {},
  isRedisConfigured: () => false,
}))

// Mock agent tools — return empty tool set
vi.mock('@/lib/agent/tools', () => ({
  createAgentTools: vi.fn(() => ({})),
}))

vi.mock('@/lib/agent/web-search-config', () => ({
  createWebSearchTool: vi.fn(() => ({})),
}))

vi.mock('@/lib/agent/system-prompt', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue('Stub system prompt'),
  formatCompanyContext: vi.fn().mockReturnValue(undefined),
}))

vi.mock('@/lib/ai/citations', () => ({
  extractSourcesFromToolResult: vi.fn(() => ({})),
}))

// Mock @ai-sdk/anthropic and @ai-sdk/openai
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({ provider: 'anthropic' })),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => ({ provider: 'openai' })),
}))

// Mock the ai package — capture onFinish; return a stub result with a minimal
// toUIMessageStreamResponse that returns a basic Response.
vi.mock('ai', () => ({
  streamText: vi.fn((config: Record<string, unknown>) => {
    capturedOnFinish = config.onFinish as typeof capturedOnFinish
    return {
      toUIMessageStreamResponse: vi.fn(
        () => new Response('stream', { status: 200 })
      ),
    }
  }),
  smoothStream: vi.fn(() => vi.fn()),
  stepCountIs: vi.fn((n: number) => n),
}))

beforeEach(() => {
  vi.clearAllMocks()
  capturedOnFinish = undefined
})

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/chat — ChatUsageEvent telemetry (Story 14.27)', () => {
  it('writes a ChatUsageEvent row when onFinish fires with Anthropic totalUsage', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const response = await POST(
      createRequest({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hej' }] }],
        contextType: 'global',
      })
    )

    expect(response.status).toBe(200)
    expect(capturedOnFinish).toBeDefined()

    // Simulate AI SDK firing onFinish with a realistic Anthropic totalUsage
    await capturedOnFinish!({
      totalUsage: {
        inputTokens: 9500,
        outputTokens: 500,
        cachedInputTokens: 8000,
        reasoningTokens: 0,
        inputTokenDetails: {
          cacheWriteTokens: 0,
        },
      },
      steps: [{ step: 1 }],
    })

    expect(mockChatUsageEventCreate).toHaveBeenCalledTimes(1)
    const call = mockChatUsageEventCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(call.data).toMatchObject({
      workspace_id: TEST_WORKSPACE_ID,
      user_id: TEST_USER_ID,
      input_tokens: 9500,
      output_tokens: 500,
      cache_read_input_tokens: 8000,
      cache_write_input_tokens: 0,
      reasoning_tokens: 0,
      step_count: 1,
      context_type: 'GLOBAL',
    })
    // cost_usd_estimate is computed via estimateCostUsd — verify it's a positive number
    expect(call.data.cost_usd_estimate).toBeGreaterThan(0)
  })

  it('captures step_count from the steps array on multi-step turns', async () => {
    const { POST } = await import('@/app/api/chat/route')
    await POST(
      createRequest({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hej' }] }],
        contextType: 'change',
      })
    )

    await capturedOnFinish!({
      totalUsage: {
        inputTokens: 40000,
        outputTokens: 5000,
        cachedInputTokens: 30000,
        reasoningTokens: 3000,
        inputTokenDetails: { cacheWriteTokens: 0 },
      },
      steps: [{ s: 1 }, { s: 2 }, { s: 3 }, { s: 4 }],
    })

    const call = mockChatUsageEventCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(call.data.step_count).toBe(4)
    expect(call.data.context_type).toBe('CHANGE')
    expect(call.data.reasoning_tokens).toBe(3000)
  })

  it('reads cache-write tokens from top-level cacheCreationInputTokens when present', async () => {
    const { POST } = await import('@/app/api/chat/route')
    await POST(
      createRequest({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hej' }] }],
        contextType: 'law',
      })
    )

    await capturedOnFinish!({
      totalUsage: {
        inputTokens: 5000,
        outputTokens: 200,
        cachedInputTokens: 3000,
        reasoningTokens: 0,
        // Top-level field present — story says to prefer this path when present
        cacheCreationInputTokens: 1500,
      },
      steps: [{ s: 1 }],
    })

    const call = mockChatUsageEventCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(call.data.cache_write_input_tokens).toBe(1500)
  })

  it('falls back to inputTokenDetails.cacheWriteTokens when top-level is absent', async () => {
    const { POST } = await import('@/app/api/chat/route')
    await POST(
      createRequest({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hej' }] }],
        contextType: 'task',
      })
    )

    await capturedOnFinish!({
      totalUsage: {
        inputTokens: 5000,
        outputTokens: 200,
        cachedInputTokens: 3000,
        reasoningTokens: 0,
        inputTokenDetails: {
          cacheWriteTokens: 700,
        },
      },
      steps: [{ s: 1 }],
    })

    const call = mockChatUsageEventCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(call.data.cache_write_input_tokens).toBe(700)
  })

  it('writes zero for cache fields when OpenAI path (no cache parity)', async () => {
    const { POST } = await import('@/app/api/chat/route')
    // Simulate OpenAI path by leaving AI_CHAT_MODEL unset (default = openai)
    const originalEnv = process.env.AI_CHAT_MODEL
    delete process.env.AI_CHAT_MODEL

    await POST(
      createRequest({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hi' }] }],
      })
    )

    await capturedOnFinish!({
      totalUsage: {
        inputTokens: 2000,
        outputTokens: 500,
        // OpenAI doesn't populate cachedInputTokens or cache details
      },
      steps: [{ s: 1 }],
    })

    const call = mockChatUsageEventCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(call.data.cache_read_input_tokens).toBe(0)
    expect(call.data.cache_write_input_tokens).toBe(0)
    expect(call.data.reasoning_tokens).toBe(0)
    expect(call.data.model).toBe('gpt-4-turbo')

    // Restore
    if (originalEnv !== undefined) process.env.AI_CHAT_MODEL = originalEnv
  })

  it('does NOT propagate Prisma insert failures to the stream response (fail-safe)', async () => {
    // AC 4 + AC 15: stub Prisma.create to throw, confirm stream response still succeeds
    mockChatUsageEventCreate.mockRejectedValueOnce(new Error('DB down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(
      createRequest({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hej' }] }],
        contextType: 'global',
      })
    )

    // Invoke onFinish — Prisma throws — but the outer Response is already returned
    // so this purely tests the fail-safe swallow inside onFinish itself.
    await expect(
      capturedOnFinish!({
        totalUsage: {
          inputTokens: 100,
          outputTokens: 50,
          cachedInputTokens: 0,
        },
        steps: [{ s: 1 }],
      })
    ).resolves.not.toThrow()

    expect(response.status).toBe(200)
    expect(errorSpy).toHaveBeenCalledWith(
      '[CHAT_USAGE_EVENT_WRITE_FAIL]',
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })
})
