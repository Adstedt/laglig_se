/* eslint-disable no-console */
/**
 * Story 9.5 — determine the issuing authority for ALL 76 registry föreskrifter,
 * independent of the ingest. SOSFS → Socialstyrelsen (definitional). HSLF-FS →
 * Haiku reads the consolidated page BODY (the operative "X föreskriver/beslutar
 * följande med stöd av…" clause is authoritative; the H1 "Socialstyrelsens…" brand
 * is ignored per prompt). Generous body context so no clause is missed.
 *
 * Output: data/socialstyrelsen-issuers.json  { [documentNumber]: { issuer, source } }
 * Usage: pnpm tsx scripts/resolve-socialstyrelsen-issuers.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { parseAgencyPrefix } from '../lib/agency/regulatory-bodies'
/* eslint-enable import/first */

const REGISTRY = resolve(
  process.cwd(),
  'data/socialstyrelsen-foreskrifter-registry.json'
)
const OUT = resolve(process.cwd(), 'data/socialstyrelsen-issuers.json')
const MODEL = 'claude-haiku-4-5-20251001'
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; LagligBot/1.0)' }

async function bodyText(url: string): Promise<string | null> {
  try {
    const $ = cheerio.load(await (await fetch(url, { headers: UA })).text())
    const $m = $('#main-content')
    $m.find(
      'nav, script, style, button, form, [class*="menu"], [class*="breadcrumb"]'
    ).remove()
    return $m.text().replace(/\s+/g, ' ').trim().slice(0, 12000)
  } catch {
    return null
  }
}

async function llmIssuer(
  anthropic: Anthropic,
  documentNumber: string,
  body: string
): Promise<string | null> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 60,
    messages: [
      {
        role: 'user',
        content: `Vilken svensk myndighet HAR UTFÄRDAT föreskriften ${documentNumber}? Den myndighet som "föreskriver" eller "beslutar" — INTE en myndighet som bara nämns "efter samråd med". Ignorera rubriken "Socialstyrelsens..." om brödtexten anger en annan utfärdande myndighet. Svara med ENBART myndighetens namn.\n\nTEXT:\n${body}`,
      },
    ],
  })
  const t = msg.content
    .find((b): b is Anthropic.TextBlock => b.type === 'text')
    ?.text.trim()
  return t && t.length > 2 && t.length < 80
    ? t.replace(/[."]+$/g, '').trim()
    : null
}

async function main() {
  const reg: { documentNumber: string; title: string; sourceUrl: string }[] =
    JSON.parse(readFileSync(REGISTRY, 'utf8'))
  const anthropic = new Anthropic()
  const out: Record<string, { issuer: string; source: string }> = {}
  const dist = new Map<string, number>()
  const coSign: string[] = []
  const unresolved: string[] = []

  for (let i = 0; i < reg.length; i++) {
    const e = reg[i]!
    let issuer: string | null
    let source: string
    if (parseAgencyPrefix(e.documentNumber) === 'SOSFS') {
      issuer = 'Socialstyrelsen'
      source = 'SOSFS-definitional'
    } else {
      const body = await bodyText(e.sourceUrl)
      issuer = body ? await llmIssuer(anthropic, e.documentNumber, body) : null
      source = issuer ? 'llm-body' : 'unresolved'
    }
    if (!issuer) {
      unresolved.push(e.documentNumber)
      issuer = '(unresolved)'
    }
    out[e.documentNumber] = { issuer, source }
    dist.set(issuer, (dist.get(issuer) ?? 0) + 1)
    if (issuer !== 'Socialstyrelsen' && issuer !== '(unresolved)') {
      coSign.push(
        `  ${e.documentNumber}  →  ${issuer}   (${e.title.slice(0, 55)})`
      )
    }
    if ((i + 1) % 15 === 0) console.log(`  …${i + 1}/${reg.length}`)
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`\n=== Issuer distribution (all ${reg.length}) ===`)
  for (const [n, c] of [...dist.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(c).padStart(2)}  ${n}`)
  console.log(`\n=== Co-signatory docs (${coSign.length}) ===`)
  console.log(coSign.join('\n') || '  (none)')
  if (unresolved.length) console.log(`\nUnresolved: ${unresolved.join(', ')}`)
  console.log(`\n✓ Written ${OUT}`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
