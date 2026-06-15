/* eslint-disable no-console */
/**
 * Story 14.38 — live smoke test for cross-turn Anthropic prompt caching.
 *
 * Runs a multi-turn (default 10) Swedish legal back-and-forth through the REAL
 * Anthropic API using the EXACT production code paths:
 *   - bp1: system message with `cacheControl` (Story 14.26)
 *   - bp2: `buildModelMessages(..., { cacheHistory: true })` marks the last
 *          stable-history message (Story 14.38, this story)
 *   - bp3: `prepareStep → withLastMessageCached` moving breakpoint (Story 14.37)
 *
 * It prints, per turn, the billed input / cache-read / cache-write tokens, the
 * per-turn cache_hit_pct and a cost estimate, then a summary. The headline
 * signal you're verifying (AC1/AC2): on warm follow-up turns `cacheRead` climbs
 * PAST the system-block floor (turn 1's cache write) — proof the accumulated
 * conversation is being read from cache, not re-billed — and `hit%` rises
 * turn-over-turn toward ≥65% (AC2).
 *
 * Usage:
 *   pnpm tsx scripts/smoke-cross-turn-cache.ts            # 10 turns
 *   pnpm tsx scripts/smoke-cross-turn-cache.ts --turns 6  # custom turn count
 *
 * Requires ANTHROPIC_API_KEY in .env.local. Costs a few cents (real API calls).
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { streamText, stepCountIs, type UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { buildModelMessages } from '../lib/agent/build-model-messages'
import { withLastMessageCached } from '../lib/agent/prompt-cache'
import { buildSystemPrompt } from '../lib/agent/system-prompt'
import { estimateCostUsd } from '../lib/usage/cost-estimator'
/* eslint-enable import/first */

const MODEL = 'claude-sonnet-4-6'

// A realistic warm multi-turn conversation (GLOBAL context). The model answers
// each; we append its reply to history and ask the follow-up, so the cached
// history prefix grows every turn — exactly the traffic shape AC2 targets.
const QUESTIONS = [
  'Vilka grundläggande arbetsmiljökrav gäller för ett litet svenskt bolag med 8 anställda?',
  'Vad innebär kravet på systematiskt arbetsmiljöarbete (SAM) i praktiken?',
  'Hur ofta ska riskbedömningar göras enligt SAM?',
  'Vilka regler gäller särskilt för ensamarbete?',
  'Behöver vi en skriftlig arbetsmiljöpolicy, och vad ska den innehålla?',
  'Vad gäller kring första hjälpen och krisstöd på arbetsplatsen?',
  'Vilka krav finns på ergonomi vid bildskärmsarbete?',
  'Hur hanterar vi tillbud och arbetsskador formellt?',
  'Vilket ansvar har vd respektive styrelsen för arbetsmiljön?',
  'Kan du sammanfatta de tre viktigaste åtgärderna vi bör börja med?',
]

function userMsg(text: string): UIMessage {
  return {
    id: `u-${text.length}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  } as UIMessage
}
function assistantMsg(text: string): UIMessage {
  return {
    id: `a-${text.length}`,
    role: 'assistant',
    parts: [{ type: 'text', text }],
  } as UIMessage
}

function pad(s: string | number, n: number): string {
  return String(s).padStart(n)
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      '✗ ANTHROPIC_API_KEY missing in .env.local — cannot run the live smoke test.'
    )
    process.exit(1)
  }

  const turnsArgIdx = process.argv.indexOf('--turns')
  const turns =
    turnsArgIdx >= 0 ? Number(process.argv[turnsArgIdx + 1]) : QUESTIONS.length
  const nTurns = Math.min(
    Math.max(1, turns || QUESTIONS.length),
    QUESTIONS.length
  )

  // Build the real system prompt (GLOBAL context — no DB). Wrap with cacheControl
  // exactly like the route's systemMessage (bp1).
  const systemText = await buildSystemPrompt({
    companyContext:
      'Företag: Smoke Test AB. Bransch: tillverkning. Anställda: 8.',
    contextType: 'global',
    thinkingEnabled: false,
  })
  const systemMessage = {
    role: 'system' as const,
    content: systemText,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' as const } },
    },
  }

  const model = anthropic(MODEL)
  const ui: UIMessage[] = []

  console.log(
    `\n🔬 Story 14.38 cross-turn cache smoke test — model=${MODEL}, ${nTurns} turns`
  )
  console.log(`   system prompt ≈ ${systemText.length} chars (bp1)\n`)
  console.log(
    'turn │   input │  cacheRead │ cacheWrite │  output │  hit% │   $/turn'
  )
  console.log(
    '─────┼─────────┼────────────┼────────────┼─────────┼───────┼─────────'
  )

  let totalRead = 0
  let totalInput = 0
  let firstWarmRead = 0
  let lastWarmRead = 0

  for (let t = 0; t < nTurns; t++) {
    ui.push(userMsg(QUESTIONS[t]!))

    const result = streamText({
      model,
      system: systemMessage,
      // bp2: cache the stable-history boundary (this story). No pending block in
      // this smoke run (normal Q&A) → null. cacheHistory only matters from turn 2.
      messages: buildModelMessages(ui, [], null, { cacheHistory: true }),
      stopWhen: stepCountIs(3),
      // bp3: moving last-message breakpoint (Story 14.37).
      prepareStep: ({ messages }) => ({
        messages: withLastMessageCached(messages),
      }),
    })

    // Drain the stream, then read final usage.
    const text = await result.text
    const usage = (await result.totalUsage) as unknown as {
      inputTokens?: number
      outputTokens?: number
      cachedInputTokens?: number
      reasoningTokens?: number
      cacheCreationInputTokens?: number
      inputTokenDetails?: { cacheWriteTokens?: number }
    }

    const input = usage.inputTokens ?? 0
    const output = usage.outputTokens ?? 0
    const cacheRead = usage.cachedInputTokens ?? 0
    const cacheWrite =
      usage.cacheCreationInputTokens ??
      usage.inputTokenDetails?.cacheWriteTokens ??
      0
    const reasoning = usage.reasoningTokens ?? 0

    // Cache-hit % = fraction of billed input served from cache = cacheRead / input.
    // NOTE (Story 14.38): Anthropic's `inputTokens` is INCLUSIVE of `cacheRead`, so
    // the correct denominator is `input` alone. The legacy chat_usage_events
    // `cache_hit_pct` SQL used `cacheRead + input`, which double-counts cacheRead
    // and is mathematically capped at 50%. This reports the corrected metric.
    const hitPct = input > 0 ? (100 * cacheRead) / input : 0
    const cost = estimateCostUsd({
      model: MODEL,
      inputTokens: input,
      outputTokens: output,
      cacheReadInputTokens: cacheRead,
      cacheWriteInputTokens: cacheWrite,
      reasoningTokens: reasoning,
    })

    totalRead += cacheRead
    totalInput += input
    if (t === 1) firstWarmRead = cacheRead
    if (t >= 1) lastWarmRead = cacheRead

    console.log(
      `${pad(t + 1, 4)} │${pad(input, 8)} │${pad(cacheRead, 11)} │${pad(
        cacheWrite,
        11
      )} │${pad(output, 8)} │${pad(hitPct.toFixed(1), 6)} │${pad(
        '$' + cost.toFixed(4),
        9
      )}`
    )

    ui.push(assistantMsg(text))
  }

  const aggregateHit = totalInput > 0 ? (100 * totalRead) / totalInput : 0

  console.log(
    '─────┴─────────┴────────────┴────────────┴─────────┴───────┴─────────'
  )
  console.log(`\n📊 Summary`)
  console.log(`   Aggregate cache_hit_pct : ${aggregateHit.toFixed(1)}%`)
  console.log(
    `   Warm read (turn 2)      : ${firstWarmRead.toLocaleString('sv-SE')} tokens`
  )
  console.log(
    `   Warm read (last turn)   : ${lastWarmRead.toLocaleString('sv-SE')} tokens`
  )
  console.log(
    `\n   ✅ AC1/AC2 indicator: cacheRead should CLIMB across warm turns (history`
  )
  console.log(
    `      read grows past the system-block floor); aggregate hit% should trend ≥65%.`
  )
  console.log(
    `   ⚠️  Run turns < 5 min apart — the ephemeral cache TTL is 5 minutes.\n`
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Smoke test failed:', err)
    process.exit(1)
  })
