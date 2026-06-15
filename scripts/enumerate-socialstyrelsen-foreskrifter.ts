/* eslint-disable no-console */
/**
 * Story 9.5 — Task 2: enumerate Socialstyrelsen's consolidated föreskrifter.
 *
 * The listing page is JS-rendered, so a plain fetch under-counts — we render it
 * with headless chromium to harvest every konsoliderad-föreskrift URL, then
 * GET each (individual pages ARE server-rendered) to read the canonical document
 * number + title from the H1 ("Senaste version av <DOCNUM> <title>").
 *
 * Output: data/socialstyrelsen-foreskrifter-registry.json (the Task-3 ingester reads this).
 *
 * Usage: pnpm tsx scripts/enumerate-socialstyrelsen-foreskrifter.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { chromium } from '@playwright/test'
import * as cheerio from 'cheerio'
import { writeFileSync } from 'fs'
import { deriveAgencyAttribution } from '../lib/agency/regulatory-bodies'
/* eslint-enable import/first */

const BASE = 'https://www.socialstyrelsen.se'
const LISTING = `${BASE}/kunskapsstod-och-regler/regler-och-riktlinjer/foreskrifter-och-allmanna-rad/konsoliderade-foreskrifter/`
const OUT = resolve(
  process.cwd(),
  'data/socialstyrelsen-foreskrifter-registry.json'
)

interface RegistryEntry {
  documentNumber: string
  title: string
  sourceUrl: string
  agencyPrefix: string | null
  regulatoryBody: string | null
  /** Set when the canonical number was inferred from a malformed source H1 (prefix typo). */
  sourcePrefixTypo?: string
}

async function harvestUrls(): Promise<string[]> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(LISTING, { waitUntil: 'networkidle', timeout: 60_000 })
    // Trigger any lazy rendering
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(800)
    }
    const hrefs = await page.$$eval(
      'a[href*="/konsoliderade-foreskrifter/"]',
      (as) => as.map((a) => (a as HTMLAnchorElement).href)
    )
    return hrefs
  } finally {
    await browser.close()
  }
}

function extractDocNumberAndTitle(
  html: string
): { documentNumber: string; title: string; sourcePrefixTypo?: string } | null {
  const $ = cheerio.load(html)
  const h1 =
    $('#main-content h1').first().text().trim() || $('h1').first().text().trim()

  // Clean case: "Senaste version av SOSFS 2011:9 <title>" / "... HSLF-FS 2022:30 <title>"
  const clean = h1.match(/((?:SOSFS|HSLF-FS)\s+\d{4}:\d+)\s+(.*)/)
  if (clean) {
    return {
      documentNumber: clean[1]!.replace(/\s+/g, ' ').trim(),
      title: clean[2]!.trim(),
    }
  }

  // Typo-tolerant fallback: Socialstyrelsen's source H1 sometimes garbles the prefix
  // (observed: "SOFSFS 2009:8", "SOSF-FS 2012:20"). The YYYY:NN part is reliable;
  // infer the prefix from context (HSLF if present, else SOSFS — this is the
  // Socialstyrelsen konsoliderade page) and flag the inference for review.
  const garbled = h1.match(/\b(S[A-Z-]*FS|HSLF[A-Z-]*FS)\s+(\d{4}:\d+)\s+(.*)/i)
  if (garbled && /föreskrift|socialstyrelsen/i.test(h1)) {
    const numeric = garbled[2]!
    const prefix = /hslf/i.test(garbled[1]!) ? 'HSLF-FS' : 'SOSFS'
    return {
      documentNumber: `${prefix} ${numeric}`,
      title: garbled[3]!.trim(),
      sourcePrefixTypo: garbled[1]!,
    }
  }
  return null
}

async function main() {
  console.log('Rendering listing (headless chromium)…')
  const rawUrls = await harvestUrls()
  // Dedupe + drop the listing page itself + drop trailing fragments
  const urls = [...new Set(rawUrls.map((u) => u.split('#')[0]!))].filter(
    (u) =>
      u.includes('/konsoliderade-foreskrifter/') &&
      !u.replace(/\/$/, '').endsWith('/konsoliderade-foreskrifter')
  )
  console.log(`Harvested ${urls.length} candidate page URLs`)

  const entries: RegistryEntry[] = []
  const skipped: string[] = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LagligBot/1.0)' },
      })
      if (!res.ok) {
        skipped.push(`${url} (HTTP ${res.status})`)
        continue
      }
      const parsed = extractDocNumberAndTitle(await res.text())
      if (!parsed) {
        skipped.push(`${url} (no SOSFS/HSLF-FS H1)`)
        continue
      }
      const { agencyPrefix, regulatoryBody } = deriveAgencyAttribution(
        parsed.documentNumber
      )
      entries.push({ ...parsed, sourceUrl: url, agencyPrefix, regulatoryBody })
    } catch (e) {
      skipped.push(`${url} (${e instanceof Error ? e.message : String(e)})`)
    }
    if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${urls.length}`)
  }

  // Dedupe by documentNumber (listing can repeat)
  const byNum = new Map<string, RegistryEntry>()
  for (const e of entries) byNum.set(e.documentNumber, e)
  const registry = [...byNum.values()].sort((a, b) =>
    a.documentNumber.localeCompare(b.documentNumber)
  )

  writeFileSync(OUT, JSON.stringify(registry, null, 2) + '\n')

  const byPrefix = new Map<string, number>()
  for (const e of registry)
    byPrefix.set(
      e.agencyPrefix ?? '?',
      (byPrefix.get(e.agencyPrefix ?? '?') ?? 0) + 1
    )

  console.log(`\n✓ Registry written: ${OUT}`)
  console.log(`  unique föreskrifter: ${registry.length}`)
  console.log(
    `  by prefix: ${[...byPrefix.entries()].map(([p, n]) => `${p}=${n}`).join(', ')}`
  )
  console.log(`  skipped: ${skipped.length}`)
  for (const s of skipped.slice(0, 10)) console.log(`    - ${s}`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
