/**
 * Story 3.3 + 14.7a: AI Chat API Route
 * Handles chat messages with streaming responses, rate limiting, and agent tools
 */

import {
  streamText,
  stepCountIs,
  type UIMessage,
  type ToolSet,
  type TextStreamPart,
} from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { Ratelimit } from '@upstash/ratelimit'
import * as Sentry from '@sentry/nextjs'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { getServerSession } from '@/lib/auth/session'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { createAgentTools } from '@/lib/agent/tools'
import { createWebSearchTool } from '@/lib/agent/web-search-config'
// Story 19.1: chat attachment → content blocks + last-message merge.
import { attachmentsToContent } from '@/lib/agent/attachments-to-content'
import { buildModelMessages } from '@/lib/agent/build-model-messages'
import { withLastMessageCached } from '@/lib/agent/prompt-cache'
// Story 19.5: role-based tool filter.
import type { WorkspaceRole } from '@prisma/client'
import {
  buildSystemPrompt,
  formatCompanyContext,
  formatEmployeeContext,
} from '@/lib/agent/system-prompt'
// Story 7.7: server-side re-gating of the client-supplied employeeId.
import { hasPermission } from '@/lib/auth/permissions'
// Story 19.7c: derive the context's primary skill to narrow the tool registry.
import { getPrimarySkillForContext } from '@/lib/agent/skill-loader'
import { buildPendingActionsContext } from '@/lib/agent/context-assembly'
// Story 19.14: adaptive thinking config (per-context effort) — single home for
// the effort map + provider-options builder, wired into this route below.
import {
  buildChatThinkingProviderOptions,
  type ChatContextType,
} from '@/lib/agent/thinking-effort'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import {
  extractSourcesFromToolResult,
  type SourceInfo,
  type ChatMessageMetadata,
} from '@/lib/ai/citations'
import { estimateCostUsd } from '@/lib/usage/cost-estimator'
import {
  assertWithinTokenQuota,
  TokenQuotaExceededError,
} from '@/lib/usage/check'

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

// Maximum duration for streaming responses (300s). Story 19.14: adaptive thinking
// (per-context `effort`, capped at `high`) lets the model self-regulate think time
// within the effort ceiling. Effort values + the provider-options builder live in
// lib/agent/thinking-effort.ts, wired in below. Raised from 90s → 300s: heavy
// styrdokument drafts ("samtliga krav" policies) do ~8 search_laws then emit a
// large document as draft_styrdokument args, which overran the 90s wall and left
// the assistant stub empty forever (no onFinish → frozen "skriver utkast"). 300s
// is the Vercel Pro function-timeout ceiling.
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    // Authenticate user and resolve workspace
    const session = await getServerSession()
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = session.user.id

    let workspaceId: string
    let role: WorkspaceRole | undefined // Story 19.5: drives the tool-registry filter
    try {
      const ctx = await getWorkspaceContext()
      workspaceId = ctx.workspaceId
      role = ctx.role
    } catch {
      // Fallback if workspace context unavailable (unauthenticated edge). role
      // stays undefined → full set, but write server actions still enforce
      // withWorkspace (defense in depth) and a 'default' workspace can't persist.
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

    // Story 5.5c: AI token quota check. Runs after rate limits but before
    // streamText. On hard-cap overflow returns HTTP 402 with a structured
    // body so the client can surface an upgrade modal. Soft-warn at 80%
    // surfaces via X-AI-Usage-Warning response header (non-blocking).
    let quotaWarningHeader: string | undefined
    if (workspaceId !== 'default') {
      try {
        const quota = await assertWithinTokenQuota(workspaceId)
        if (quota.warning) {
          quotaWarningHeader = JSON.stringify(quota.warning)
        }
      } catch (error) {
        if (error instanceof TokenQuotaExceededError) {
          return new Response(
            JSON.stringify({
              error: 'AI-tokenkvot uppnådd',
              message: `Du har använt ${error.usage.toLocaleString('sv-SE')} av ${error.limit.toLocaleString('sv-SE')} tokens (${Math.round((error.usage / error.limit) * 100)}%) denna månad. Uppgradera planen för att fortsätta.`,
              code: 'AI_TOKEN_QUOTA_EXCEEDED',
              usage: error.usage,
              limit: error.limit,
              hardCap: error.hardCap,
              tier: error.tier,
            }),
            {
              status: 402,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
        throw error
      }
    }

    // Parse request body
    const body = await req.json()
    const {
      messages,
      contextType,
      contextId,
      lawListItemId,
      attachmentIds,
      employeeId,
      ...initialContext
    } = body as {
      messages: UIMessage[]
      contextType?: ChatContextType
      contextId?: string
      // Story 19.4a: active LawListItem id (CHANGE sends it explicitly; LAW falls
      // back to contextId, which that mount sets to the listItemId).
      lawListItemId?: string
      // Story 19.1: chat attachment file ids (top-level body field, not message parts)
      attachmentIds?: string[]
      // Story 7.7: pill-selected employee id (per-send body field). NEVER
      // trusted as-is — re-fetched below under workspace + employees:view.
      employeeId?: string
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

    const contextTypeUpper = (contextType ?? 'global').toUpperCase() as
      | 'GLOBAL'
      | 'TASK'
      | 'LAW'
      | 'CHANGE'

    // Story 19.4a: resolve the active law-list item id — prefer the explicit
    // body field (CHANGE sends it), else fall back to contextId for a LAW chat
    // (the LAW mount sets contextId = listItemId). Threaded into the system
    // prompt (surfaced to the agent) + the tool context (write-tool default).
    const resolvedLawListItemId =
      lawListItemId ??
      (contextTypeUpper === 'LAW' ? (contextId ?? undefined) : undefined)

    // Build system prompt with company context.
    // Fetch workspace.name alongside the profile so formatCompanyContext can
    // prefer the user-facing name on identity drift (the workspace was renamed
    // but the CompanyProfile.company_name was never re-synced — fired in prod
    // 2026-06-02 against the Nordviken test workspace; agent kept naming
    // drafts after stale Bolagsverket data).
    const [profile, workspaceRow] = await Promise.all([
      prisma.companyProfile.findFirst({ where: { workspace_id: workspaceId } }),
      workspaceId !== 'default'
        ? prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ])
    const companyContext = formatCompanyContext(
      profile,
      workspaceRow?.name ?? undefined
    )

    // Story 7.7: employee-in-focus context. The client's employeeId is NEVER
    // trusted — we re-fetch under the workspace filter AND re-gate on
    // `employees:view`. A foreign/unknown id (or an insufficient role) yields
    // null → no block, no bias, no error leak. Without an employeeId this
    // whole branch is skipped and the hot path is untouched.
    let employeeContext: string | undefined
    let biasAgreementId: string | undefined
    if (
      typeof employeeId === 'string' &&
      employeeId.length > 0 &&
      workspaceId !== 'default' &&
      role != null &&
      hasPermission(role, 'employees:view')
    ) {
      // ALLOWLIST select — the PII fields (personnummer, email, phone,
      // address, fortnox_raw) are never read on this path.
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, workspace_id: workspaceId },
        select: {
          first_name: true,
          last_name: true,
          employment_form: true,
          employment_date: true,
          personel_type: true,
          full_time_equivalent: true,
          inactive: true,
          collective_agreement: { select: { id: true, name: true } },
        },
      })
      if (employee) {
        employeeContext = formatEmployeeContext(employee)
        // AC 4: assigned agreement → hard CA-retrieval bias (closure default
        // in the search_collective_agreements tool factory).
        biasAgreementId = employee.collective_agreement?.id
      }
    }

    // Story 14.22: agent feedback loop — inject pending/decided action proposals
    // as workflow state. Built before the stub message so it reflects the
    // previous turn's state (the current stub is excluded by content != '').
    const pendingActionsBlock =
      workspaceId !== 'default'
        ? await buildPendingActionsContext({
            workspaceId,
            userId,
            contextType: contextTypeUpper,
            contextId: contextId ?? null,
          })
        : null

    // Story 14.37/14.38: provider gate. The prompt-caching changes (frozen
    // system prefix + tool-loop caching + cross-turn history caching) are
    // Anthropic-only; the OpenAI path is unchanged. On Anthropic we relocate
    // pendingActionsBlock OUT of the cached system prompt into a separate block
    // after the stable-history boundary (see buildModelMessages); on OpenAI it
    // stays in the system prompt exactly as before.
    const isAnthropic = (process.env.AI_CHAT_MODEL ?? 'openai') === 'anthropic'

    const systemPrompt = await buildSystemPrompt({
      companyContext,
      // Story 7.7: undefined on the no-employee path → no block, prompt
      // byte-identical to pre-7.7 output (hot-path inertness guard).
      employeeContext,
      contextType,
      contextId,
      lawListItemId: resolvedLawListItemId,
      // Story 19.14: reasoning is on for every context on the Anthropic path
      // (adaptive effort, incl. the newly-enabled `global` chat); the OpenAI
      // fallback emits no thinking. Re-derived from the provider signal, replacing
      // the removed `thinkingBudget > 0`. Drives both telemetry (thinkingEnabled)
      // and REASONING_GUIDANCE injection (system-prompt gates on this field).
      thinkingEnabled: isAnthropic,
      ...(!isAnthropic && pendingActionsBlock ? { pendingActionsBlock } : {}),
      // SEC-001 (QA 7.7): NEVER spread the raw body rest into the prompt
      // options — it used to spread LAST, letting any authenticated client
      // override server-computed fields (employeeContext, companyContext,
      // pendingActionsBlock, thinkingEnabled, …) straight from the request
      // body. Only the display-context strings the mounts legitimately send
      // (ChatContextInitial) pass through, type-checked, server values last.
      ...(typeof initialContext.title === 'string'
        ? { title: initialContext.title }
        : {}),
      ...(typeof initialContext.sfsNumber === 'string'
        ? { sfsNumber: initialContext.sfsNumber }
        : {}),
      ...(typeof initialContext.summary === 'string'
        ? { summary: initialContext.summary }
        : {}),
    })

    // Story 14.22 / ADR-14.22-A: preallocate the assistant message id and write
    // a STUB ChatMessage BEFORE streamText() so any PendingAgentAction created
    // mid-tool-loop has a valid chat_message_id FK target. Its content is filled
    // in onFinish (update, not create). The client no longer saves the assistant
    // message — route.ts is the sole writer. Skip for the synthetic 'default'
    // workspace fallback (FK to a non-existent workspace row would fail).
    const assistantMessageId = randomUUID()
    if (workspaceId !== 'default') {
      await prisma.chatMessage.create({
        data: {
          id: assistantMessageId,
          workspace_id: workspaceId,
          user_id: userId,
          role: 'ASSISTANT',
          content: '',
          context_type: contextTypeUpper,
          context_id: contextId ?? null,
        },
      })
    }

    // Select model up-front (Story 19.5) so the resolved name threads into both
    // the agent tools (AgentDecisionLog.model_version) and the model selection.
    const modelProvider = process.env.AI_CHAT_MODEL ?? 'openai'
    const modelName =
      modelProvider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4-turbo'

    // Create agent tools with workspace + user scoping + role filter (Story 19.5).
    // assistantMessageId + chat context are threaded so write tools can persist a
    // PendingAgentAction; modelVersion + role drive logging + the AUDITOR filter.
    // Story 19.7c: narrow the registry to the context's primary skill (+ the
    // ALWAYS_AVAILABLE baseline). Activation-only skills (gap_analysis) never
    // appear here — their tools are all baseline. Mid-conversation activate_skill
    // → activeSkills re-injection stays deferred (the live path is the tool result).
    const primarySkill = getPrimarySkillForContext(contextType)
    const activeSkills = primarySkill ? [primarySkill] : []

    const tools = createAgentTools(
      workspaceId,
      userId,
      {
        assistantMessageId,
        contextType: contextTypeUpper,
        contextId: contextId ?? null,
        lawListItemId: resolvedLawListItemId,
        modelVersion: modelName,
        // Story 7.7: the in-context employee's assigned agreement (undefined
        // without an employee) — CA tool's closure-level retrieval bias.
        biasAgreementId,
      },
      role,
      activeSkills
    )

    // Anthropic web search (Story 14.21). Story 19.5: AUDITOR is read-only — no web_search.
    const allTools =
      modelProvider === 'anthropic' && role !== 'AUDITOR'
        ? { ...tools, web_search: createWebSearchTool() }
        : tools
    const model =
      modelProvider === 'anthropic'
        ? anthropic('claude-sonnet-4-6')
        : openai('gpt-4-turbo')

    // Story 19.14: adaptive thinking via per-context effort (Anthropic path only).
    // Emits `{ thinking: { type:'adaptive', display:'summarized' }, effort }` —
    // the model self-regulates whether/how much to think per turn within the
    // effort ceiling (trivial turns skip thinking, hard ones think more), guided
    // by the per-context effort. Replaces the deprecated fixed
    // `{ thinking: { type:'enabled', budgetTokens } }`. Requires
    // @ai-sdk/anthropic >= 3.0.85 (3.0.23 rejected `type:'adaptive'`, and an
    // effort-only payload silently DISABLES thinking on Sonnet 4.6 — verified
    // live). The OpenAI path returns undefined (stays thinking-less — AC 4).
    const providerOptions = buildChatThinkingProviderOptions(
      modelProvider,
      contextType
    )

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

    // Story 19.1: convert chat attachments → Claude content blocks, merged into
    // the last user message only. Skip for the synthetic 'default' workspace.
    const attachmentBlocks =
      attachmentIds && attachmentIds.length > 0 && workspaceId !== 'default'
        ? await attachmentsToContent(attachmentIds, workspaceId)
        : []

    // Stream the response with tool use support. Word-by-word pacing is owned
    // entirely by the client (useSmoothStream in chat-message.tsx), which
    // re-paces network bursts into a steady one-word-at-a-time reveal. Pacing on
    // the server too would just add latency to text the client re-paces anyway,
    // so we stream tokens as fast as the model produces them.
    const result = streamText({
      model,
      system: systemMessage,
      messages: buildModelMessages(
        messages,
        attachmentBlocks,
        // Anthropic: relocate pending-actions workflow state to a separate block
        // after the stable-history boundary (keeps the cached system prefix AND
        // the projected text history byte-stable). OpenAI: null (block stays in
        // the system prompt, path unchanged).
        isAnthropic ? pendingActionsBlock : null,
        // Story 14.38 (bp2): mark the last stable-history message with an
        // ephemeral cache breakpoint so warm follow-up turns read the
        // accumulated conversation from cache (cross-turn reuse). With bp1
        // (system) + bp3 (moving last message, below) that's 3 of 4 breakpoints.
        // Anthropic only.
        { cacheHistory: isAnthropic }
      ),
      tools: allTools,
      stopWhen: stepCountIs(10),
      // Story 14.37: cache the growing tool-loop conversation by placing a moving
      // ephemeral cacheControl breakpoint (bp3) on the last message each step
      // (Anthropic only). With the system+tools breakpoint (bp1) and the 14.38
      // history breakpoint (bp2, set in buildModelMessages above) that's 3
      // breakpoints (≤ Anthropic's max of 4). No-op / omitted on the OpenAI path.
      ...(isAnthropic
        ? {
            prepareStep: ({ messages: stepMessages }) => ({
              messages: withLastMessageCached(stepMessages),
            }),
          }
        : {}),
      // Surface SDK-level streaming errors (AI SDK rejections, Zod input
      // validation failures, transport errors) at the route boundary so they
      // appear in dev/prod logs instead of being swallowed by the stream.
      // Per-step structured tool errors are intentionally NOT logged here —
      // tools that return `{error: true, message: ...}` (e.g. search "no
      // matches") are handled by the agent loop as normal control flow.
      onError: ({ error }) => {
        const e = error as
          | Error
          | { message?: string; cause?: unknown; issues?: unknown }
        console.error('[CHAT STREAM ERROR]', {
          name: (e as Error)?.name,
          message: e?.message ?? String(e),
          cause: e?.cause,
          issues: (e as { issues?: unknown })?.issues,
          stack: (e as Error)?.stack?.split('\n').slice(0, 5).join('\n'),
        })
      },
      // Story 14.27: persistent usage telemetry. Writes one ChatUsageEvent row per
      // successful chat turn. Fail-safe — telemetry write errors are logged but
      // never propagated to the stream response.
      onFinish: async ({ text, totalUsage, steps, sources }) => {
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
            outputTokenDetails?: { reasoningTokens?: number }
          }
          const cacheWriteInputTokens =
            usageAsRecord.cacheCreationInputTokens ??
            usageAsRecord.inputTokenDetails?.cacheWriteTokens ??
            0

          // Story 19.14: ai@6.0.209 moved reasoning tokens to
          // outputTokenDetails.reasoningTokens and deprecated the top-level
          // totalUsage.reasoningTokens. Read the new field first, fall back to the
          // deprecated one (AC 7 — reasoning-token capture continuity; keeps the
          // field reading the supported location once the deprecated one is removed).
          // NB: the Anthropic provider currently populates NEITHER (verified live —
          // both undefined even when summarized thinking is emitted), so this stays
          // 0 on the Anthropic path exactly as it did pre-bump — no regression, just
          // future-proofed. The trustworthy "did it think" signal is the streamed
          // reasoning block in the UI, not this counter.
          const reasoningTokens =
            usageAsRecord.outputTokenDetails?.reasoningTokens ??
            totalUsage.reasoningTokens ??
            0

          // Story 19.5: `modelName` is now resolved once at the top of the handler
          // (reused here + for AgentDecisionLog.model_version).
          const costUsdEstimate = estimateCostUsd({
            model: modelName,
            inputTokens,
            outputTokens,
            cacheReadInputTokens,
            cacheWriteInputTokens,
            reasoningTokens,
          })

          // Story 14.22 / ADR-14.22-A: derive the assistant message's citation
          // metadata from the completed steps + sources (deterministic at
          // onFinish — does NOT rely on the response-transform messageMetadata
          // callback, whose timing relative to onFinish is not guaranteed). This
          // is persisted on the stub so reloaded history renders citation pills
          // identically to the live turn (which still streams via messageMetadata).
          const finalCitationSources: Record<string, SourceInfo> = {}
          for (const src of sources ?? []) {
            const s = src as unknown as {
              sourceType?: string
              url?: string
              title?: string
            }
            if (s.sourceType === 'url' && s.url) {
              const key = `web:${s.url}`
              if (!(key in finalCitationSources)) {
                let domain: string
                try {
                  domain = new URL(s.url).hostname.replace(/^www\./, '')
                } catch {
                  domain = s.url
                }
                finalCitationSources[key] = {
                  documentNumber: domain,
                  title: s.title ?? null,
                  snippet: null,
                  slug: null,
                  path: null,
                  anchorId: null,
                  url: s.url,
                }
              }
            }
          }
          // Story 14.22: also collect any PendingAgentAction ids proposed this
          // turn so the inline approval card is rediscoverable on history reload
          // (tool parts are not persisted — only text + metadata are).
          const pendingActionIds: string[] = []
          for (const step of steps ?? []) {
            const toolResults =
              (
                step as unknown as {
                  toolResults?: Array<{
                    toolName?: string
                    output?: unknown
                    result?: unknown
                  }>
                }
              ).toolResults ?? []
            for (const tr of toolResults) {
              const out = tr.output ?? tr.result
              const extracted = extractSourcesFromToolResult(
                tr.toolName ?? '',
                out
              )
              for (const [key, info] of Object.entries(extracted)) {
                if (!(key in finalCitationSources)) {
                  finalCitationSources[key] = info
                }
              }
              const pid = (
                out as { data?: { pendingActionId?: unknown } } | undefined
              )?.data?.pendingActionId
              if (typeof pid === 'string') pendingActionIds.push(pid)
            }
          }

          // AI SDK v6: onFinish `text` is the FINAL step's text only (top-level
          // accumulation across all steps only lands in v7 — see migration guide
          // 7.0). When the model writes prose in the SAME step it calls a write
          // tool (e.g. an update_document proposal + explanation), that prose
          // lives in a non-final step and `text` comes back empty. Persisting
          // content '' then makes getChatHistory's empty-stub filter swallow the
          // whole turn — approval cards included — on reload. Join every step's
          // text so the proposal narrative survives the round-trip.
          const assistantText =
            (steps ?? [])
              .map((s) => (s as { text?: string }).text ?? '')
              .map((t) => t.trim())
              .filter((t) => t.length > 0)
              .join('\n\n') ||
            text ||
            ''

          const metaObj: Record<string, unknown> = {}
          if (Object.keys(finalCitationSources).length > 0) {
            metaObj.citationSources = finalCitationSources
          }
          if (pendingActionIds.length > 0) {
            metaObj.pendingActionIds = pendingActionIds
          }
          const assistantMetadata:
            | Prisma.InputJsonValue
            | typeof Prisma.JsonNull =
            Object.keys(metaObj).length > 0
              ? (metaObj as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull

          // Story 5.5c: ChatUsageEvent (Story 14.27 audit log) + WorkspaceUsage
          // (denormalised counter for quota check) MUST commit together so
          // they cannot drift. The hard cap reads from WorkspaceUsage; if the
          // counter were updated separately and one of the two writes failed,
          // the user could be either over-billed (if event missed counter) or
          // under-counted (if counter missed event).
          //
          // For the upsert's `create` branch we anchor period_started_at to
          // workspace.created_at — trial workspaces' first usage period IS
          // the trial window, not "from first chat turn". Skip the lookup
          // for the synthetic 'default' workspace fallback.
          //
          // Quota counts user-visible work only — input (conversation history
          // + tool definitions + new message) + model output. Cache reads /
          // writes are our infrastructure optimization (Story 14.26 prompt
          // caching) and shouldn't burn quota — the user didn't ask for them
          // and a wasted cache_write (e.g., session idles past the 5-min TTL
          // before the next turn) shouldn't penalise them. Cost-rate signal
          // for billing-side analysis is preserved separately on
          // ChatUsageEvent.cache_*_input_tokens columns + cost_usd_estimate.
          //
          // Anthropic's inputTokens is the TOTAL billed input — cache reads and
          // writes are subsets of it (same semantics as estimateCostUsd's
          // fresh_input carve-out). Subtract them so multi-step tool turns,
          // where the cached conversation prefix is re-billed every step, don't
          // inflate the counter ~8× (observed: ~120K charged vs ~15K fair per
          // turn, June 2026 production data).
          const totalTokens =
            Math.max(
              0,
              inputTokens - cacheReadInputTokens - cacheWriteInputTokens
            ) + outputTokens

          if (workspaceId === 'default') {
            // Synthetic fallback — write the event log only, no counter
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
          } else {
            const ws = await prisma.workspace.findUniqueOrThrow({
              where: { id: workspaceId },
              select: { created_at: true },
            })

            await prisma.$transaction([
              // ADR-14.22-A: fill the pre-loop stub assistant message with the
              // final content + citation metadata. Same transaction as the usage
              // writes so a turn either fully persists or fully rolls back.
              prisma.chatMessage.update({
                where: { id: assistantMessageId },
                data: { content: assistantText, metadata: assistantMetadata },
              }),
              prisma.chatUsageEvent.create({
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
              }),
              prisma.workspaceUsage.upsert({
                where: { workspace_id: workspaceId },
                create: {
                  workspace_id: workspaceId,
                  tokens_used_this_period: BigInt(totalTokens),
                  period_started_at: ws.created_at,
                },
                update: {
                  tokens_used_this_period: { increment: BigInt(totalTokens) },
                },
              }),
            ])
          }
        } catch (err) {
          // Fail-safe: log but never re-throw. A failed telemetry write must not
          // affect the user-facing chat response.
          //
          // Story 5.5c TOKEN-002: also surface to Sentry. The same-transaction
          // guarantee for ChatUsageEvent + WorkspaceUsage is preserved at the
          // DB level (both writes commit together OR both roll back), but any
          // throw here means the counter never updates — during a sustained
          // DB outage users could effectively bypass quota for the duration.
          // Sentry alert lets ops notice immediately instead of waiting for
          // log-aggregation review.
          console.error('[CHAT_USAGE_EVENT_WRITE_FAIL]', err)
          Sentry.captureException(err, {
            tags: {
              area: 'chat-usage',
              event: 'usage_write_failed',
              workspace_id: workspaceId,
            },
          })
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
      // ADR-14.22-A: pin the assistant UI-message id to the pre-loop stub id so
      // the client reconciles message.id to the persisted row — the inline
      // AgentActionCard (keyed off the tool output's pendingActionId) and history
      // reload both line up against the same ChatMessage.
      generateMessageId: () => assistantMessageId,
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
      // Story 5.5c: surface the soft-warn payload via response header so
      // the client can render a non-blocking "approaching limit" toast
      // without disturbing the streaming protocol.
      ...(quotaWarningHeader
        ? { headers: { 'X-AI-Usage-Warning': quotaWarningHeader } }
        : {}),
    })
  } catch (error) {
    // Without Sentry capture here, /api/chat 500s are invisible — the
    // generic JSON response bypasses Next.js's auto-instrumentation.
    // Without this, root-causing chat failures requires DevTools + DB
    // forensics (TreDoffice AB incident, May 2026).
    console.error('[CHAT API ERROR]', error)
    Sentry.captureException(error, {
      tags: { area: 'chat', event: 'chat_route_500' },
    })
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'Något gick fel. Försök igen senare.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
