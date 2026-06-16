/* eslint-disable no-console */
/**
 * Story 9.5 (QA fix) — determine the issuing authority for all 76 registry
 * föreskrifter from the AUTHORITATIVE publikation-page H1.
 *
 * The konsoliderade page H1 brands every entry "Socialstyrelsens föreskrifter…",
 * and an LLM reading the body can be fooled by cross-references (it mis-attributed
 * HSLF-FS 2018:43 to Läkemedelsverket via a citation). The grund-författning's
 * PUBLIKATION page, by contrast, states the true issuer in a fixed-grammar H1:
 *   "HSLF-FS 2015:31 Rättsmedicinalverkets föreskrifter om …"
 *   "HSLF-FS 2018:43 Socialstyrelsens föreskrifter om …"
 * → deterministic parse, no LLM, no cross-ref confusion.
 *
 * SOSFS → Socialstyrelsen (definitional). HSLF-FS → publikation-H1 issuer.
 * Output: data/socialstyrelsen-issuers.json  { [documentNumber]: { issuer, source } }
 * Usage: pnpm tsx scripts/resolve-socialstyrelsen-issuers.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { parseAgencyPrefix } from '../lib/agency/regulatory-bodies'
/* eslint-enable import/first */

const REGISTRY = resolve(
  process.cwd(),
  'data/socialstyrelsen-foreskrifter-registry.json'
)
const OUT = resolve(process.cwd(), 'data/socialstyrelsen-issuers.json')
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; LagligBot/1.0)' }

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: UA })
    return r.ok ? await r.text() : null
  } catch {
    return null
  }
}

/** Find the grund publikation URL on the konsoliderade page (slug contains the doc digits). */
function grundPublikationUrl(
  html: string,
  documentNumber: string
): string | null {
  const digits = documentNumber.replace(/[^0-9]/g, '')
  const slugs = [
    ...new Set(
      [...html.matchAll(/\/publikationer\/([a-z0-9-]+)\//g)].map((m) => m[1]!)
    ),
  ]
  const slug =
    slugs.find((s) => s.replace(/-/g, '').includes(digits)) ?? slugs[0]
  return slug ? `https://www.socialstyrelsen.se/publikationer/${slug}/` : null
}

/** "HSLF-FS 2018:43 Socialstyrelsens föreskrifter om …" → "Socialstyrelsen". */
function issuerFromPublikationH1(h1: string): string | null {
  const m = h1.match(/\d{4}:\d+\s+(.+?)s\s+(?:föreskrifter|allmänna råd)/i)
  return m ? m[1]!.trim() : null
}

async function main() {
  const reg: { documentNumber: string; sourceUrl: string; title: string }[] =
    JSON.parse(readFileSync(REGISTRY, 'utf8'))
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
      const konsHtml = await fetchHtml(e.sourceUrl)
      const pubUrl = konsHtml
        ? grundPublikationUrl(konsHtml, e.documentNumber)
        : null
      const pubHtml = pubUrl ? await fetchHtml(pubUrl) : null
      const h1 = pubHtml
        ? cheerio.load(pubHtml)('h1').first().text().trim()
        : null
      issuer = h1 ? issuerFromPublikationH1(h1) : null
      if (issuer) {
        source = `publikation-h1: "${h1}"`
      } else {
        // Some publikation H1s omit the issuer ("HSLF-FS NNNN:N <subject>"). On
        // Socialstyrelsen's own collection these are Socialstyrelsen-issued (the
        // sole confirmed co-signatory is Rättsmedicinalverket 2015:31). Default,
        // flagged, rather than guess from cross-references.
        issuer = 'Socialstyrelsen'
        source = `default-socialstyrelsen (publikation H1 omits issuer: "${h1 ?? 'n/a'}")`
        unresolved.push(e.documentNumber)
      }
    }
    out[e.documentNumber] = { issuer, source }
    dist.set(issuer, (dist.get(issuer) ?? 0) + 1)
    if (issuer !== 'Socialstyrelsen' && issuer !== '(unresolved)') {
      coSign.push(`  ${e.documentNumber}  →  ${issuer}`)
    }
    if ((i + 1) % 15 === 0) console.log(`  …${i + 1}/${reg.length}`)
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`\n=== Issuer distribution (all ${reg.length}) ===`)
  for (const [n, c] of [...dist.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(c).padStart(2)}  ${n}`)
  console.log(`\n=== Co-signatory (${coSign.length}) ===`)
  console.log(coSign.join('\n') || '  (none)')
  if (unresolved.length) console.log(`\nUnresolved: ${unresolved.join(', ')}`)
  console.log(`\n✓ Written ${OUT}`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
