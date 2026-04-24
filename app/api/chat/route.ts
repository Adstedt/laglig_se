/**
 * Story 3.3 + 14.7a: AI Chat API Route
 * Handles chat messages with streaming responses, rate limiting, and agent tools
 */

import {
  streamText,
  smoothStream,
  stepCountIs,
  type UIMessage,
  type ToolSet,
  type TextStreamPart,
} from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { getServerSession } from '@/lib/auth/session'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { createAgentTools } from '@/lib/agent/tools'
import { createWebSearchTool } from '@/lib/agent/web-search-config'
import {
  buildSystemPrompt,
  formatCompanyContext,
} from '@/lib/agent/system-prompt'
import { prisma } from '@/lib/prisma'
import {
  extractSourcesFromToolResult,
  type SourceInfo,
  type ChatMessageMetadata,
} from '@/lib/ai/citations'
import { estimateCostUsd } from '@/lib/usage/cost-estimator'

// Rate limiting configuration
// 10 requests per minute per user, 50 per workspace
const userRatelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'ratelimit:chat:user',
    })
  : null

const workspaceRatelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '1 m'),
      analytics: true,
      prefix: 'ratelimit:chat:workspace',
    })
  : null

// Maximum duration for streaming responses (90s to accommodate thinking tokens on tool-heavy assessments)
export const maxDuration = 90

// Per-context thinking budget map (tokens). Absent key = thinking disabled.
const THINKING_BUDGET: Record<string, number> = {
  change: 8_000,
  task: 3_000,
  law: 2_000,
}

export async function POST(req: Request) {
  try {
    // Authenticate user and resolve workspace
    const session = await getServerSession()
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = session.user.id

    let workspaceId: string
    try {
      const ctx = await getWorkspaceContext()
      workspaceId = ctx.workspaceId
    } catch {
      // Fallback if workspace context unavailable
      workspaceId = 'default'
    }

    // Rate limit check - user level
    if (userRatelimit) {
      const { success, limit, reset, remaining } =
        await userRatelimit.limit(userId)
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `För många förfrågningar. Vänta ${retryAfter} sekunder.`,
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
              'Retry-After': retryAfter.toString(),
            },
          }
        )
      }
    }

    // Rate limit check - workspace level
    if (workspaceRatelimit) {
      const { success } = await workspaceRatelimit.limit(workspaceId)
      if (!success) {
        return new Response(
          JSON.stringify({
            error: 'Workspace rate limit exceeded',
            message:
              'Din arbetsyta har nått gränsen för förfrågningar. Försök igen senare.',
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Parse request body
    const body = await req.json()
    const { messages, contextType, contextId, ...initialContext } = body as {
      messages: UIMessage[]
      contextType?: 'global' | 'task' | 'law' | 'change'
      contextId?: string
      title?: string
      description?: string
      sfsNumber?: string
      summary?: string
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Messages are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Resolve thinking budget for this context
    const thinkingBudget = contextType ? (THINKING_BUDGET[contextType] ?? 0) : 0

    // Build system prompt with company context
    const profile = await prisma.companyProfile.findFirst({
      where: { workspace_id: workspaceId },
    })
    const companyContext = formatCompanyContext(profile)
    const systemPrompt = await buildSystemPrompt({
      companyContext,
      contextType,
      contextId,
      thinkingEnabled: thinkingBudget > 0,
      ...initialContext,
    })

    // Create agent tools with workspace + user scoping
    const tools = createAgentTools(workspaceId, userId)

    // Select model based on environment variable
    const modelProvider = process.env.AI_CHAT_MODEL ?? 'openai'

    // Anthropic web search: conditionally add to tools (Story 14.21)
    const allTools =
      modelProvider === 'anthropic'
        ? { ...tools, web_search: createWebSearchTool() }
        : tools
    const model =
      modelProvider === 'anthropic'
        ? anthropic('claude-sonnet-4-6')
        : openai('gpt-4-turbo')

    // Build providerOptions for extended thinking (Anthropic only, omit entirely when disabled)
    const providerOptions =
      thinkingBudget > 0 && modelProvider === 'anthropic'
        ? {
            anthropic: {
              thinking: {
                type: 'enabled' as const,
                budgetTokens: thinkingBudget,
              },
            },
          }
        : undefined

    // Story 14.26: Anthropic prompt caching v1.
    // On the Anthropic path, wrap the system prompt in a SystemModelMessage so we can
    // attach `cacheControl: { type: 'ephemeral' }` (5-min TTL). The Anthropic provider
    // reads cache_control from message-level providerOptions, not top-level streamText
    // providerOptions — so this has to live on the system message itself.
    // Sonnet 4.6 requires ≥1024 tokens in the cached prefix; the joined system string is
    // ~5,000+ tokens (Swedish, ~3.3 chars/token on a 16k-char system-prompt.md), well above.
    // v1 scope: single breakpoint = within-workspace caching only. Cross-workspace sharing
    // requires structured-parts refactor of buildSystemPrompt (v2, deferred).
    const systemMessage =
      modelProvider === 'anthropic'
        ? {
            role: 'system' as const,
            content: systemPrompt,
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' as const },
              },
            },
          }
        : systemPrompt

    // Stream the response with tool use support
    // smoothStream buffers tokens and releases at word boundaries for smooth UI
    const result = streamText({
      model,
      system: systemMessage,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content:
          m.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => ('text' in p ? p.text : ''))
            .join('\n') ?? '',
      })),
      tools: allTools,
      stopWhen: stepCountIs(10),
      experimental_transform: smoothStream({
        chunking: /[\s\S]/,
        delayInMs: 8,
      }),
      // Story 14.27: persistent usage telemetry. Writes one ChatUsageEvent row per
      // successful chat turn. Fail-safe — telemetry write errors are logged but
      // never propagated to the stream response.
      onFinish: async ({ totalUsage, steps }) => {
        try {
          const inputTokens = totalUsage.inputTokens ?? 0
          const outputTokens = totalUsage.outputTokens ?? 0
          const cacheReadInputTokens = totalUsage.cachedInputTokens ?? 0

          // AI SDK v6 cache-write field location varies by provider/version.
          // Runtime evidence from Story 14.26 showed it nested under
          // inputTokenDetails.cacheWriteTokens on the Anthropic path. Also check
          // top-level cacheCreationInputTokens as fallback per Anthropic docs.
          const usageAsRecord = totalUsage as unknown as {
            cacheCreationInputTokens?: number
            inputTokenDetails?: { cacheWriteTokens?: number }
          }
          const cacheWriteInputTokens =
            usageAsRecord.cacheCreationInputTokens ??
            usageAsRecord.inputTokenDetails?.cacheWriteTokens ??
            0

          const reasoningTokens = totalUsage.reasoningTokens ?? 0

          const modelName =
            modelProvider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4-turbo'

          const costUsdEstimate = estimateCostUsd({
            model: modelName,
            inputTokens,
            outputTokens,
            cacheReadInputTokens,
            cacheWriteInputTokens,
            reasoningTokens,
          })

          const contextTypeUpper = (contextType ?? 'global').toUpperCase() as
            | 'GLOBAL'
            | 'TASK'
            | 'LAW'
            | 'CHANGE'

          await prisma.chatUsageEvent.create({
            data: {
              workspace_id: workspaceId,
              user_id: userId,
              model: modelName,
              context_type: contextTypeUpper,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cache_read_input_tokens: cacheReadInputTokens,
              cache_write_input_tokens: cacheWriteInputTokens,
              reasoning_tokens: reasoningTokens,
              step_count: steps?.length ?? 1,
              cost_usd_estimate: costUsdEstimate,
            },
          })
        } catch (err) {
          // Fail-safe: log but never re-throw. A failed telemetry write must not
          // affect the user-facing chat response.
          console.error('[CHAT_USAGE_EVENT_WRITE_FAIL]', err)
        }
      },
      ...(providerOptions && { providerOptions }),
    })

    // Accumulate citation sources from tool results, send as message metadata.
    // This makes sources available on the client via message.metadata.citationSources
    // without fragile client-side tool-part state matching.
    const citationSources: Record<string, SourceInfo> = {}

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
      messageMetadata: ({
        part,
      }: {
        part: TextStreamPart<ToolSet>
      }): ChatMessageMetadata | undefined => {
        // Story 14.21: Capture web search source events (Anthropic web_search)
        // TextStreamPart 'source' has top-level: sourceType, id, url, title
        if (part.type === 'source') {
          const src = part as {
            sourceType: string
            url: string
            title?: string
          }
          if (src.sourceType === 'url' && src.url) {
            const key = `web:${src.url}`
            if (!(key in citationSources)) {
              let domain: string
              try {
                domain = new URL(src.url).hostname.replace(/^www\./, '')
              } catch {
                domain = src.url
              }
              citationSources[key] = {
                documentNumber: domain,
                title: src.title ?? null,
                snippet: null,
                slug: null,
                path: null,
                anchorId: null,
                url: src.url,
              }
            }
            return { citationSources: { ...citationSources } }
          }
        }

        if (part.type === 'tool-result') {
          const p = part as { toolName?: string; output?: unknown }
          const toolName = p.toolName ?? ''
          const extracted = extractSourcesFromToolResult(toolName, p.output)

          if (Object.keys(extracted).length > 0) {
            // Merge new sources (first-write-wins)
            for (const [key, info] of Object.entries(extracted)) {
              if (!(key in citationSources)) {
                citationSources[key] = info
              }
            }
            // Send updated source map to client
            return { citationSources: { ...citationSources } }
          }
        }
        return undefined
      },
    })
  } catch (error) {
    console.error('[CHAT API ERROR]', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'Något gick fel. Försök igen senare.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
