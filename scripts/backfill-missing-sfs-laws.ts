#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Backfill 618 missing SFS laws from Riksdag API.
 *
 * These were identified by comparing the full API listing (year by year)
 * against our DB SFS_LAW records (see scripts/tmp-find-gap.ts).
 *
 * Pipeline per doc:
 *   1. Look up doc in Riksdag API to get dok_id, title, dates
 *   2. Fetch raw HTML + full text
 *   3. cleanLawHtml → normalizeSfsLaw → canonical HTML
 *   4. linkifyHtmlContent (cross-reference links)
 *   5. classifyLawType (law classification metadata)
 *   6. Insert as SFS_LAW with DocumentVersion + ChangeEvent
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-sfs-laws.ts              # dry run
 *   npx tsx scripts/backfill-missing-sfs-laws.ts --apply       # write to DB
 *   npx tsx scripts/backfill-missing-sfs-laws.ts --apply --limit 50
 *   npx tsx scripts/backfill-missing-sfs-laws.ts --apply --offset 100
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import {
  PrismaClient,
  ContentType,
  DocumentStatus,
  ChangeType,
} from '@prisma/client'
import {
  fetchLawHTML,
  fetchLawFullText,
  generateSlug,
} from '../lib/external/riksdagen'
import { cleanLawHtml } from '../lib/sfs/clean-law-html'
import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'
import { classifyLawType, classificationToMetadata } from '../lib/sfs'
import { linkifyHtmlContent, buildSlugMap, type SlugMap } from '../lib/linkify'
import { parseUndertitel } from '../lib/sync/section-parser'

const prisma = new PrismaClient()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ============================================================================
// CLI
// ============================================================================

const DRY_RUN = !process.argv.includes('--apply')
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit')
  return idx !== -1 ? parseInt(process.argv[idx + 1]!, 10) : 0
})()
const OFFSET = (() => {
  const idx = process.argv.indexOf('--offset')
  return idx !== -1 ? parseInt(process.argv[idx + 1]!, 10) : 0
})()

// ============================================================================
// API lookup — resolve SFS number → dok_id + metadata
// ============================================================================

interface ApiDocInfo {
  dokId: string
  beteckning: string
  titel: string
  datum: string
  publicerad: string
  systemdatum: string
  undertitel?: string
}

async function lookupDoc(sfsNumber: string): Promise<ApiDocInfo | null> {
  // "SFS 1980:1021" → beteckning "1980:1021"
  const bet = sfsNumber.replace('SFS ', '')

  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=5&sok=${encodeURIComponent(bet)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Laglig.se/1.0' },
  })
  if (!res.ok) return null

  const data = await res.json()
  const docs = data.dokumentlista?.dokument || []

  // Find exact match on beteckning
  const match = docs.find((d: any) => d.beteckning === bet)
  if (!match) return null

  return {
    dokId: match.dok_id,
    beteckning: match.beteckning,
    titel: match.titel,
    datum: match.datum || '',
    publicerad: match.publicerad || '',
    systemdatum: match.systemdatum || '',
    undertitel: match.undertitel,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLYING TO DB'}`)
  if (LIMIT > 0) console.log(`Limit: ${LIMIT}`)
  if (OFFSET > 0) console.log(`Offset: ${OFFSET}`)
  console.log()

  // Load missing doc numbers
  const allMissing: string[] = JSON.parse(
    fs.readFileSync(
      resolve(process.cwd(), 'data/missing-sfs-laws.json'),
      'utf-8'
    )
  )
  console.log(`Total missing: ${allMissing.length}`)

  // Apply offset and limit
  let toProcess = allMissing.slice(OFFSET)
  if (LIMIT > 0) toProcess = toProcess.slice(0, LIMIT)
  console.log(`Processing: ${toProcess.length} (offset ${OFFSET})`)

  // Build slug map for linkification
  let slugMap: SlugMap | null = null
  if (!DRY_RUN) {
    console.log('Building slug map for linkification...')
    slugMap = await buildSlugMap()
    console.log(`Slug map: ${slugMap.size} entries`)
  }

  const stats = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    alreadyExists: 0,
    apiNotFound: 0,
    noContent: 0,
    failed: 0,
    emptyBody: 0,
  }

  const errors: Array<{ doc: string; error: string }> = []

  for (const sfsNumber of toProcess) {
    stats.processed++
    const progress = `[${stats.processed}/${toProcess.length}]`

    // Check if already exists (may have been added since gap analysis)
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: sfsNumber },
      select: { id: true },
    })
    if (existing) {
      stats.alreadyExists++
      console.log(`${progress} ${sfsNumber} — already exists, skipping`)
      continue
    }

    // Look up in API
    await sleep(250) // Be nice to API
    const info = await lookupDoc(sfsNumber)
    if (!info) {
      stats.apiNotFound++
      console.log(`${progress} ${sfsNumber} — NOT FOUND in API`)
      errors.push({ doc: sfsNumber, error: 'Not found in API' })
      continue
    }

    if (DRY_RUN) {
      console.log(
        `${progress} ${sfsNumber} — "${info.titel.substring(0, 60)}" (dok_id: ${info.dokId})`
      )
      stats.inserted++
      continue
    }

    // Fetch content
    await sleep(200)
    let htmlContent: string | null = null
    let fullText: string | null = null
    try {
      ;[htmlContent, fullText] = await Promise.all([
        fetchLawHTML(info.dokId),
        fetchLawFullText(info.dokId),
      ])
    } catch (err) {
      stats.failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`${progress} ${sfsNumber} — fetch failed: ${msg}`)
      errors.push({ doc: sfsNumber, error: `Fetch: ${msg}` })
      continue
    }

    if (!htmlContent && !fullText) {
      stats.noContent++
      console.log(`${progress} ${sfsNumber} — no content from API`)
      errors.push({ doc: sfsNumber, error: 'No content' })
      continue
    }

    // Pipeline: clean → normalize → linkify
    let processedHtml = htmlContent
    if (processedHtml) {
      processedHtml = cleanLawHtml(processedHtml)
      processedHtml = normalizeSfsLaw(processedHtml, {
        documentNumber: sfsNumber,
        title: info.titel,
      })

      if (slugMap) {
        processedHtml = linkifyHtmlContent(
          processedHtml,
          slugMap,
          sfsNumber
        ).html
      }
    }

    // Check for empty body after processing
    const bodyText = processedHtml
      ? processedHtml
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : ''
    const isEmpty = bodyText.length < 5

    // Classify
    const classification = classifyLawType(info.titel)
    const classificationMeta = classificationToMetadata(classification)
    const slug = generateSlug(info.titel, sfsNumber)
    const latestAmendment = parseUndertitel(info.undertitel || '')
    const apiSystemdatum = info.systemdatum
      ? new Date(info.systemdatum.replace(' ', 'T') + 'Z')
      : new Date()

    // Build metadata
    const metadata: Record<string, unknown> = {
      dokId: info.dokId,
      source: 'data.riksdagen.se',
      publicerad: info.publicerad,
      systemdatum: info.systemdatum,
      latestAmendment,
      versionCount: 1,
      fetchedAt: new Date().toISOString(),
      method: 'backfill-missing',
      ...classificationMeta,
    }

    if (isEmpty) {
      stats.emptyBody++
      // Flag like tmp-flag-empty-docs.ts did
      const bet = sfsNumber.replace('SFS ', '')
      metadata.contentAvailability = 'external'
      metadata.externalUrl = `http://rkrattsbaser.gov.se/sfst?bet=${encodeURIComponent(bet)}`
    }

    try {
      await prisma.$transaction(async (tx) => {
        const newDoc = await tx.legalDocument.create({
          data: {
            document_number: sfsNumber,
            title: info.titel,
            slug,
            content_type: ContentType.SFS_LAW,
            full_text: fullText,
            html_content: processedHtml,
            publication_date: info.datum ? new Date(info.datum) : null,
            status: DocumentStatus.ACTIVE,
            source_url: `https://data.riksdagen.se/dokument/${info.dokId}`,
            metadata,
          },
        })

        await tx.documentVersion.create({
          data: {
            document_id: newDoc.id,
            version_number: 1,
            full_text: fullText || '',
            html_content: processedHtml,
            amendment_sfs: latestAmendment,
            source_systemdatum: apiSystemdatum,
          },
        })

        await tx.changeEvent.create({
          data: {
            document_id: newDoc.id,
            content_type: ContentType.SFS_LAW,
            change_type: ChangeType.NEW_LAW,
          },
        })
      })

      stats.inserted++
      console.log(
        `${progress} ${sfsNumber} — INSERTED "${info.titel.substring(0, 50)}" ` +
          `(${classification.type}/${classification.category})` +
          (isEmpty ? ' [empty-body-flagged]' : '')
      )
    } catch (err) {
      stats.failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`${progress} ${sfsNumber} — INSERT FAILED: ${msg}`)
      errors.push({ doc: sfsNumber, error: `Insert: ${msg}` })
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('BACKFILL SUMMARY')
  console.log('='.repeat(60))
  console.log(`Processed:       ${stats.processed}`)
  console.log(`Inserted:        ${stats.inserted}`)
  console.log(`Already exists:  ${stats.alreadyExists}`)
  console.log(`API not found:   ${stats.apiNotFound}`)
  console.log(`No content:      ${stats.noContent}`)
  console.log(`Empty body:      ${stats.emptyBody} (flagged)`)
  console.log(`Failed:          ${stats.failed}`)

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`)
    for (const e of errors) {
      console.log(`  ${e.doc}: ${e.error}`)
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. Run with --apply to write to DB.')
  }

  // Get new DB count
  const dbCount = await prisma.legalDocument.count({
    where: { content_type: ContentType.SFS_LAW },
  })
  console.log(`\nDB SFS_LAW count: ${dbCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
