/* eslint-disable no-console */
/**
 * Story 19.14 — OFFLINE smoke: prove the outgoing Anthropic request body carries
 * adaptive `output_config.effort` and NO deprecated thinking budget.
 *
 * No API key and no cost: a custom `fetch` intercepts the request the AI SDK
 * builds, captures the JSON body, and aborts before anything leaves the machine.
 * This is the highest-signal check for AC 2 — it inspects the ACTUAL payload the
 * production provider-options produce, not a mock.
 *
 * Usage:
 *   pnpm tsx scripts/smoke-19.14-effort-payload.ts
 */
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import {
  buildChatThinkingProviderOptions,
  type ChatContextType,
} from '@/lib/agent/thinking-effort'

const SENTINEL = '__SMOKE_CAPTURED__'

async function capturePayload(
  contextType: ChatContextType | undefined
): Promise<Record<string, unknown>> {
  let captured: Record<string, unknown> | undefined
  const anthropic = createAnthropic({
    apiKey: 'sk-ant-offline-smoke',
    fetch: (async (_url: string, init?: { body?: string }) => {
      captured = JSON.parse(init?.body ?? '{}')
      throw new Error(SENTINEL)
    }) as unknown as typeof fetch,
  })

  const providerOptions = buildChatThinkingProviderOptions(
    'anthropic',
    contextType
  )

  try {
    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      prompt: 'Vilka lagar gäller för vår verksamhet?',
      ...(providerOptions && { providerOptions }),
      onError: () => {}, // swallow the sentinel abort
    })
    await result.consumeStream()
  } catch {
    /* sentinel abort expected */
  }

  if (!captured) throw new Error('request body was never captured')
  return captured
}

async function main() {
  const contexts: Array<ChatContextType | undefined> = [
    'change',
    'task',
    'law',
    'global',
    undefined,
  ]

  let allPass = true
  for (const ctx of contexts) {
    const body = await capturePayload(ctx)
    const effort = (body as { output_config?: { effort?: string } })
      .output_config?.effort
    const thinking = (
      body as { thinking?: { type?: string; display?: string } }
    ).thinking
    const label = ctx ?? '(absent→global)'

    const expected = ctx === 'change' ? 'high' : 'medium' // task/law/global/absent → medium
    // Adaptive: request must carry thinking.type='adaptive' (else thinking is
    // OFF on Sonnet 4.6) + display='summarized' + output_config.effort.
    const ok =
      effort === expected &&
      thinking?.type === 'adaptive' &&
      thinking?.display === 'summarized'
    allPass &&= ok

    console.log(
      `${ok ? '✅' : '❌'} ${label.padEnd(18)} thinking=${thinking?.type}/${
        thinking?.display
      } output_config.effort=${String(effort)}`
    )
    if (!ok) {
      console.log(
        `    expected thinking=adaptive/summarized effort=${expected}`
      )
      console.log(`    full body keys: ${Object.keys(body).join(', ')}`)
    }
  }

  // OpenAI path must emit nothing.
  const openaiOpts = buildChatThinkingProviderOptions('openai', 'change')
  const openaiOk = openaiOpts === undefined
  allPass &&= openaiOk
  console.log(
    `${openaiOk ? '✅' : '❌'} ${'openai path'.padEnd(18)} providerOptions=${String(
      openaiOpts
    )} (expected undefined)`
  )

  console.log(
    allPass
      ? '\n🟢 PASS — adaptive effort wired, no deprecated budget, OpenAI untouched.'
      : '\n🔴 FAIL — see mismatches above.'
  )
  process.exit(allPass ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
