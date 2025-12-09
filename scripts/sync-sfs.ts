/* eslint-disable no-console */
/**
 * Daily SFS Laws Sync with Change Detection
 *
 * Enhanced sync script that:
 * - Detects BOTH new laws AND updates to existing laws
 * - Uses systemdatum (last update timestamp) for change detection
 * - Archives previous versions before updating
 * - Creates ChangeEvent records for all changes
 * - Supports early termination when caught up
 *
 * Usage:
 *   pnpm tsx scripts/sync-sfs.ts
 *
 * Options:
 *   --dry-run      Don't modify DB, just show what would be changed
 *   --verbose      Show detailed progress
 *   --no-early-stop  Don't stop early (process all pages)
 *   --max-pages=N  Maximum pages to fetch (default: 50)
 */

import { prisma } from '../lib/prisma'
import { fetchLawFullText, fetchLawHTML, generateSlug } from '../lib/external/riksdagen'
import { ContentType, DocumentStatus, ChangeType } from '@prisma/client'
import { archiveDocumentVersion } from '../lib/sync/version-archive'
import { detectChanges } from '../lib/sync/change-detection'
import { parseUndertitel } from '../lib/sync/section-parser'
import { createAmendmentFromChange } from '../lib/sync/amendment-creator'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  PAGE_SIZE: 100,
  DEFAULT_MAX_PAGES: 50, // Safety limit (5000 laws max per sync)
  DELAY_BETWEEN_REQUESTS: 250, // ms
  DELAY_BETWEEN_UPDATES: 100, // ms - faster for updates since less data
}

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const VERBOSE = args.includes('--verbose')
const NO_EARLY_STOP = args.includes('--no-early-stop')
const MAX_PAGES = parseInt(args.find(a => a.startsWith('--max-pages='))?.split('=')[1] || CONFIG.DEFAULT_MAX_PAGES.toString(), 10)

// ============================================================================
// Types
// ============================================================================

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  systemdatum: string // "2025-10-17 04:36:11" - last update timestamp
  undertitel?: string // "t.o.m. SFS 2025:732" - contains latest amendment
  dokument_url_html: string
}

interface SyncStats {
  apiCount: number
  fetched: number
  inserted: number
  updated: number
  skipped: number
  failed: number
  earlyTerminated: boolean
}

interface StoredMetadata {
  dokId?: string
  source?: string
  systemdatum?: string
  latestAmendment?: string
  versionCount?: number
  fetchedAt?: string
  method?: string
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchSFSBySystemdatum(
  page: number = 1
): Promise<{ documents: RiksdagenDocument[]; totalCount: number; hasMore: boolean }> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())
  url.searchParams.set('sort', 'systemdatum') // Sort by last update, not publication date
  url.searchParams.set('sortorder', 'desc') // Most recently updated first

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const totalCount = parseInt(data.dokumentlista['@traffar'], 10) || 0
  const totalPages = parseInt(data.dokumentlista['@sidor'], 10) || 1
  const documents: RiksdagenDocument[] = data.dokumentlista.dokument || []

  return {
    documents,
    totalCount,
    hasMore: page < totalPages && page < MAX_PAGES,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseSystemdatum(systemdatum: string): Date {
  // Format: "2025-10-17 04:36:11"
  return new Date(systemdatum.replace(' ', 'T') + 'Z')
}

// ============================================================================
// Main Sync
// ============================================================================

async function syncSFS() {
  const startTime = new Date()

  console.log('='.repeat(60))
  console.log('SFS Laws Sync with Change Detection')
  console.log('='.repeat(60))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log(`Early stop: ${!NO_EARLY_STOP}`)
  console.log(`Max pages: ${MAX_PAGES}`)
  console.log('')

  const stats: SyncStats = {
    apiCount: 0,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    earlyTerminated: false,
  }

  try {
    // Fetch first page to get count
    const firstPage = await fetchSFSBySystemdatum(1)
    stats.apiCount = firstPage.totalCount

    console.log(`Total SFS laws in API: ${stats.apiCount}`)
    console.log('')

    // Process page by page
    let page = 0
    let hasMore = true
    let documents = firstPage.documents
    let consecutiveSkips = 0
    const EARLY_STOP_THRESHOLD = 10 // Stop after 10 consecutive unchanged laws

    while (hasMore) {
      page++

      if (page > 1) {
        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
        const pageData = await fetchSFSBySystemdatum(page)
        documents = pageData.documents
        hasMore = pageData.hasMore
      } else {
        hasMore = firstPage.hasMore
      }

      if (VERBOSE) {
        console.log(`\nProcessing page ${page}...`)
      }

      // Process each document
      for (const doc of documents) {
        stats.fetched++
        const sfsNumber = `SFS ${doc.beteckning}`
        const apiSystemdatum = parseSystemdatum(doc.systemdatum)

        // Check if already exists
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
          select: {
            id: true,
            full_text: true,
            html_content: true,
            metadata: true,
          },
        })

        if (existing) {
          // Compare systemdatum for change detection
          const storedMeta = existing.metadata as StoredMetadata | null
          const storedSystemdatum = storedMeta?.systemdatum
            ? parseSystemdatum(storedMeta.systemdatum)
            : null

          if (storedSystemdatum && apiSystemdatum <= storedSystemdatum) {
            // No change - already up to date
            stats.skipped++
            consecutiveSkips++

            if (VERBOSE) {
              console.log(`  Skipped: ${sfsNumber} (no change)`)
            }

            // Early termination check
            if (!NO_EARLY_STOP && consecutiveSkips >= EARLY_STOP_THRESHOLD) {
              console.log(`\nEarly termination: ${consecutiveSkips} consecutive unchanged laws`)
              stats.earlyTerminated = true
              hasMore = false
              break
            }
            continue
          }

          // Law has been updated!
          consecutiveSkips = 0 // Reset counter

          if (DRY_RUN) {
            const amendment = parseUndertitel(doc.undertitel || '')
            console.log(`  Would update: ${sfsNumber}${amendment ? ` (${amendment})` : ''}`)
            stats.updated++
            continue
          }

          try {
            // Fetch new content
            const [newHtml, newFullText] = await Promise.all([
              fetchLawHTML(doc.dok_id),
              fetchLawFullText(doc.dok_id),
            ])

            if (!newFullText && !newHtml) {
              console.log(`  No content for ${sfsNumber} update`)
              stats.failed++
              continue
            }

            // Archive previous version and detect changes
            const latestAmendment = parseUndertitel(doc.undertitel || '')

            await prisma.$transaction(async (tx) => {
              // Archive old version
              const archivedVersion = await archiveDocumentVersion(tx, {
                documentId: existing.id,
                fullText: existing.full_text || '',
                htmlContent: existing.html_content || null,
                amendmentSfs: latestAmendment,
                sourceSystemdatum: apiSystemdatum,
              })

              // Detect and record changes
              await detectChanges(tx, {
                documentId: existing.id,
                contentType: ContentType.SFS_LAW,
                oldFullText: existing.full_text || '',
                newFullText: newFullText || '',
                amendmentSfs: latestAmendment,
                previousVersionId: archivedVersion?.id,
              })

              // Create Amendment record if we detected an amendment
              if (latestAmendment && newFullText) {
                await createAmendmentFromChange(tx, {
                  baseDocumentId: existing.id,
                  amendmentSfs: latestAmendment,
                  fullText: newFullText,
                  detectedFromVersionId: archivedVersion?.id,
                })
              }

              // Update document
              await tx.legalDocument.update({
                where: { id: existing.id },
                data: {
                  full_text: newFullText,
                  html_content: newHtml,
                  updated_at: new Date(),
                  metadata: {
                    ...(existing.metadata as object || {}),
                    systemdatum: doc.systemdatum,
                    latestAmendment,
                    versionCount: ((storedMeta?.versionCount || 1) + 1),
                    lastSyncAt: new Date().toISOString(),
                  },
                },
              })
            })

            console.log(`  Updated: ${sfsNumber}${latestAmendment ? ` (${latestAmendment})` : ''}`)
            stats.updated++
            await sleep(CONFIG.DELAY_BETWEEN_UPDATES)
          } catch (error) {
            console.error(`  Error updating ${sfsNumber}:`, error instanceof Error ? error.message : error)
            stats.failed++
          }
        } else {
          // New law - insert
          consecutiveSkips = 0 // Reset counter

          if (DRY_RUN) {
            console.log(`  Would insert: ${sfsNumber} - ${doc.titel.substring(0, 50)}...`)
            stats.inserted++
            continue
          }

          try {
            // Fetch content
            const [htmlContent, fullText] = await Promise.all([
              fetchLawHTML(doc.dok_id),
              fetchLawFullText(doc.dok_id),
            ])

            if (!fullText && !htmlContent) {
              console.log(`  No content for ${sfsNumber}`)
              stats.failed++
              continue
            }

            // Generate slug
            const slug = generateSlug(doc.titel, sfsNumber)
            const latestAmendment = parseUndertitel(doc.undertitel || '')

            // Insert with transaction to also create ChangeEvent
            await prisma.$transaction(async (tx) => {
              const newDoc = await tx.legalDocument.create({
                data: {
                  document_number: sfsNumber,
                  title: doc.titel,
                  slug,
                  content_type: ContentType.SFS_LAW,
                  full_text: fullText,
                  html_content: htmlContent,
                  publication_date: doc.datum ? new Date(doc.datum) : null,
                  status: DocumentStatus.ACTIVE,
                  source_url: `https://data.riksdagen.se/dokument/${doc.dok_id}`,
                  metadata: {
                    dokId: doc.dok_id,
                    source: 'data.riksdagen.se',
                    systemdatum: doc.systemdatum,
                    latestAmendment,
                    versionCount: 1,
                    fetchedAt: new Date().toISOString(),
                    method: 'sync-sfs',
                  },
                },
              })

              // Create initial version record
              await tx.documentVersion.create({
                data: {
                  document_id: newDoc.id,
                  version_number: 1,
                  full_text: fullText || '',
                  html_content: htmlContent,
                  amendment_sfs: latestAmendment,
                  source_systemdatum: apiSystemdatum,
                },
              })

              // Create ChangeEvent for new law
              await tx.changeEvent.create({
                data: {
                  document_id: newDoc.id,
                  content_type: ContentType.SFS_LAW,
                  change_type: ChangeType.NEW_LAW,
                  amendment_sfs: null,
                  new_version_id: null, // Link later if needed
                },
              })
            })

            console.log(`  Inserted: ${sfsNumber}`)
            stats.inserted++
            await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
          } catch (error) {
            console.error(`  Error inserting ${sfsNumber}:`, error instanceof Error ? error.message : error)
            stats.failed++
          }
        }
      }
    }

    // Final summary
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()
    const seconds = Math.floor(duration / 1000)

    console.log('')
    console.log('='.repeat(60))
    console.log('SYNC COMPLETE')
    console.log('='.repeat(60))
    console.log('')
    console.log(`API count:        ${stats.apiCount}`)
    console.log(`Fetched:          ${stats.fetched}`)
    console.log(`Inserted:         ${stats.inserted}`)
    console.log(`Updated:          ${stats.updated}`)
    console.log(`Skipped:          ${stats.skipped}`)
    console.log(`Failed:           ${stats.failed}`)
    console.log(`Early terminated: ${stats.earlyTerminated}`)
    console.log('')
    console.log(`Duration:         ${seconds}s`)

    // Log final DB count
    const finalCount = await prisma.legalDocument.count({
      where: { content_type: 'SFS_LAW' },
    })
    console.log(``)
    console.log(`Total SFS_LAW in DB: ${finalCount}`)

  } catch (error) {
    console.error('Sync failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run
syncSFS().catch(console.error)
