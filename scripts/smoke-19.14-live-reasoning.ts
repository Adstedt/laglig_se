/* eslint-disable no-console */
/**
 * Story 19.14 — LIVE diagnostic: does the effort-only config actually produce
 * thinking on claude-sonnet-4-6, or did removing budgetTokens disable it?
 *
 * Sends the SAME reasoning-heavy prompt under three configs and reports whether
 * `reasoningText` comes back populated. Costs 3 small API calls.
 *
 * Usage (needs ANTHROPIC_API_KEY in .env.local):
 *   pnpm tsx scripts/smoke-19.14-live-reasoning.ts
 */
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { buildChatThinkingProviderOptions } from '@/lib/agent/thinking-effort'

const PROMPT =
  'Ett företag med 12 anställda i Sverige undrar om de måste utse skyddsombud ' +
  'och inrätta skyddskommitté enligt arbetsmiljölagen. Resonera steg för steg ' +
  'kring gränsvärdena innan du svarar.'

type Cfg = { label: string; providerOptions?: Record<string, unknown> }

const CONFIGS: Cfg[] = [
  {
    label: 'PRODUCTION builder, change→high (adaptive+summarized+effort)',
    providerOptions: buildChatThinkingProviderOptions('anthropic', 'change'),
  },
  {
    label: 'PRODUCTION builder, global→medium (adaptive+summarized+effort)',
    providerOptions: buildChatThinkingProviderOptions('anthropic', 'global'),
  },
  {
    label:
      'effort-only NEGATIVE control (no thinking block → off on Sonnet 4.6)',
    providerOptions: { anthropic: { effort: 'high' } },
  },
]

async function run(cfg: Cfg) {
  try {
    const res = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt: PROMPT,
      maxOutputTokens: 6000,
      ...(cfg.providerOptions && { providerOptions: cfg.providerOptions }),
    })
    const reasoningLen = (res.reasoningText ?? '').trim().length
    const usage = res.usage as unknown as {
      reasoningTokens?: number
      outputTokens?: number
      outputTokenDetails?: { reasoningTokens?: number }
    }
    console.log(`\n=== ${cfg.label} ===`)
    console.log(
      `  reasoningText chars : ${reasoningLen}  ${reasoningLen > 0 ? '✅ THINKING VISIBLE' : '❌ no visible thinking'}`
    )
    console.log(
      `  outputTokenDetails.reasoningTokens: ${usage.outputTokenDetails?.reasoningTokens ?? 'n/a'}  (the field route telemetry now reads)`
    )
    console.log(
      `  usage.reasoningTokens (deprecated): ${usage.reasoningTokens ?? 'n/a'}`
    )
    console.log(`  usage.outputTokens   : ${usage.outputTokens ?? 'n/a'}`)
    if (reasoningLen > 0) {
      console.log(
        `  reasoning preview    : ${(res.reasoningText ?? '').slice(0, 120).replace(/\n/g, ' ')}…`
      )
    }
  } catch (err) {
    console.log(`\n=== ${cfg.label} ===`)
    console.log(`  ⚠️  threw: ${(err as Error).message.split('\n')[0]}`)
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set in .env.local — cannot run.')
    process.exit(1)
  }
  for (const cfg of CONFIGS) await run(cfg)
  console.log(
    '\nInterpretation: if effort-only shows ❌ but budgetTokens shows ✅, the' +
      '\neffort-only shape disables thinking on @ai-sdk/anthropic@3.0.23 / Sonnet 4.6.'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
