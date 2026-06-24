/* eslint-disable no-console */
/**
 * Story 19.14 — LIVE smoke: does thinking actually STREAM (the signal the UI
 * renders)? Uses `streamText` (the exact fn app/api/chat/route.ts uses) with the
 * production provider-options builder, then walks the full stream and counts the
 * `reasoning-*` parts. Those parts are what `isReasoningUIPart` keys off in
 * chat-message.tsx to show the "Tänkte klart" breadcrumb — so reasoning parts
 * present ⇒ thinking enabled AND visible in the UI.
 *
 * Costs a few small streamed API calls.
 *
 * Usage (needs ANTHROPIC_API_KEY in .env.local):
 *   pnpm tsx scripts/smoke-19.14-stream-reasoning.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import {
  buildChatThinkingProviderOptions,
  type ChatContextType,
} from '@/lib/agent/thinking-effort'

// A genuine multi-step applicability/threshold question — the kind that should
// make adaptive thinking engage even at medium effort.
const PROMPT =
  'Ett svenskt bolag med 12 anställda på kontor undrar: måste de utse ' +
  'skyddsombud OCH inrätta skyddskommitté enligt arbetsmiljölagen? Väg ' +
  'gränsvärdena mot varandra och motivera innan du svarar.'

async function probe(contextType: ChatContextType) {
  const providerOptions = buildChatThinkingProviderOptions(
    'anthropic',
    contextType
  )

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    prompt: PROMPT,
    maxOutputTokens: 6000,
    ...(providerOptions && { providerOptions }),
  })

  let reasoningDeltas = 0
  let reasoningChars = 0
  let sawReasoningStart = false
  let textChars = 0

  // fullStream carries every part type — the same stream the route forwards to
  // the client with sendReasoning: true.
  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'reasoning-start':
        sawReasoningStart = true
        break
      case 'reasoning-delta': {
        reasoningDeltas++
        const p = part as unknown as { text?: string; delta?: string }
        reasoningChars += (p.text ?? p.delta ?? '').length
        break
      }
      case 'text-delta': {
        const p = part as unknown as { text?: string; delta?: string }
        textChars += (p.text ?? p.delta ?? '').length
        break
      }
    }
  }

  const effort = providerOptions?.anthropic.effort
  const thinkingOn = sawReasoningStart || reasoningDeltas > 0
  console.log(`\n=== context=${contextType}  effort=${effort} ===`)
  console.log(
    `  reasoning parts : start=${sawReasoningStart} deltas=${reasoningDeltas} chars=${reasoningChars}`
  )
  console.log(`  answer text     : ${textChars} chars`)
  console.log(
    `  ${thinkingOn ? '✅ THINKING ENABLED — reasoning streamed (UI shows the breadcrumb)' : '⚠️  no reasoning parts this turn (adaptive may have skipped — try a harder prompt)'}`
  )
  return thinkingOn
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set in .env.local — cannot run.')
    process.exit(1)
  }
  const results: boolean[] = []
  for (const ctx of ['change', 'global'] as ChatContextType[]) {
    results.push(await probe(ctx))
  }
  const anyOn = results.some(Boolean)
  console.log(
    anyOn
      ? '\n🟢 Adaptive thinking is wired and streaming. `global` reasoning here = the Story 19.14 win.'
      : '\n🔴 No reasoning streamed on any context — investigate (config / dep version / model).'
  )
  process.exit(anyOn ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
