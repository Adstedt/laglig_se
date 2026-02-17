#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '.env.local' })

/**
 * End-to-End SFS Amendment Pipeline Simulation
 *
 * Exercises the full amendment pipeline from change detection through
 * PDF parsing to notification delivery, using real data and optionally
 * a real Claude API call (~$0.05 cost).
 *
 * Usage:
 *   npx tsx scripts/simulate-sfs-amendment.ts
 *   npx tsx scripts/simulate-sfs-amendment.ts --dry-run
 *   npx tsx scripts/simulate-sfs-amendment.ts --sfs 1977:1160 --amendment 2025:732
 *   npx tsx scripts/simulate-sfs-amendment.ts --no-cleanup
 *   npx tsx scripts/simulate-sfs-amendment.ts --auto-cleanup
 *   npx tsx scripts/simulate-sfs-amendment.ts --send-email user@example.com
 */

import { prisma } from '@/lib/prisma'
import { ContentType, ParseStatus } from '@prisma/client'
import { archiveDocumentVersion } from '@/lib/sync/version-archive'
import { detectChanges } from '@/lib/sync/change-detection'
import { createAmendmentFromChange } from '@/lib/sync/amendment-creator'
import { fetchAndStorePdf } from '@/lib/sfs/pdf-fetcher'
import { parseAmendmentPdf } from '@/lib/external/llm-amendment-parser'
import { htmlToMarkdown, htmlToPlainText } from '@/lib/transforms'
import { htmlToJson } from '@/lib/transforms'
import { buildSlugMap } from '@/lib/linkify/build-slug-map'
import { linkifyHtmlContent } from '@/lib/linkify/linkify-html'
import { createLegalDocumentFromAmendment } from '@/lib/sfs/amendment-to-legal-document'
import { resolveAffectedRecipients } from '@/lib/notifications/recipient-resolution'
import { createChangeNotifications } from '@/lib/notifications/amendment-notifications'
import { deletePdf } from '@/lib/supabase/storage'
import { downloadPdf } from '@/lib/supabase/storage'
import { sendEmail } from '@/lib/email/email-service'
import { AmendmentNotificationEmail } from '@/emails/amendment-notification'
import React from 'react'
import * as readline from 'readline'

// ============================================================================
// Types
// ============================================================================

interface SimulationState {
  // Record IDs to clean up (in creation order)
  documentVersionId: string | null
  changeEventId: string | null
  amendmentId: string | null
  amendmentDocumentId: string | null
  sectionChangeIds: string[]
  legalDocumentId: string | null
  notificationIds: string[]
  // For PDF cleanup
  pdfStoragePath: string | null
  pdfSfsNumber: string | null
  // For restoring the base law
  originalDoc: {
    id: string
    full_text: string | null
    html_content: string | null
    metadata: unknown
    last_change_type: string | null
    last_change_ref: string | null
    last_change_at: Date | null
  } | null
}

interface StepResult {
  step: number
  name: string
  passed: boolean
  durationMs: number
  error?: string
  detail?: string
}

interface CLIArgs {
  sfs: string | null
  amendment: string | null
  dryRun: boolean
  noCleanup: boolean
  autoCleanup: boolean
  sendEmail: string | null
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseCLIArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const result: CLIArgs = {
    sfs: null,
    amendment: null,
    dryRun: false,
    noCleanup: false,
    autoCleanup: false,
    sendEmail: null,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sfs':
        result.sfs = args[++i] ?? null
        break
      case '--amendment':
        result.amendment = args[++i] ?? null
        break
      case '--dry-run':
        result.dryRun = true
        break
      case '--no-cleanup':
        result.noCleanup = true
        break
      case '--auto-cleanup':
        result.autoCleanup = true
        break
      case '--send-email':
        result.sendEmail = args[++i] ?? null
        break
      default:
        console.error(`Unknown argument: ${args[i]}`)
        console.error(
          'Usage: npx tsx scripts/simulate-sfs-amendment.ts [--sfs <number>] [--amendment <number>] [--dry-run] [--no-cleanup] [--auto-cleanup] [--send-email <address>]'
        )
        process.exit(1)
    }
  }

  return result
}

// ============================================================================
// Step Runner
// ============================================================================

async function runStep(
  step: number,
  name: string,
  fn: () => Promise<string | void>
): Promise<StepResult> {
  const start = performance.now()
  try {
    const detail = await fn()
    const durationMs = Math.round(performance.now() - start)
    console.log(
      `  Step ${String(step).padStart(2)}  ${name.padEnd(38)} PASS  (${durationMs}ms)${detail ? `  ${detail}` : ''}`
    )
    return { step, name, passed: true, durationMs, detail: detail ?? undefined }
  } catch (error) {
    const durationMs = Math.round(performance.now() - start)
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.log(
      `  Step ${String(step).padStart(2)}  ${name.padEnd(38)} FAIL  (${durationMs}ms)`
    )
    console.log(`         ${errorMsg}`)
    return { step, name, passed: false, durationMs, error: errorMsg }
  }
}

// ============================================================================
// Auto-Pick Helpers
// ============================================================================

/**
 * Find a law that exists in at least one LawList (so notifications can resolve).
 * Prefers laws with known recent amendments.
 */
async function pickBaseLaw(
  sfsNumber: string | null
): Promise<{
  id: string
  document_number: string
  title: string
  full_text: string
  html_content: string | null
}> {
  if (sfsNumber) {
    const docNumber = sfsNumber.startsWith('SFS ')
      ? sfsNumber
      : `SFS ${sfsNumber}`
    const doc = await prisma.legalDocument.findUnique({
      where: { document_number: docNumber },
      select: {
        id: true,
        document_number: true,
        title: true,
        full_text: true,
        html_content: true,
      },
    })
    if (!doc || !doc.full_text) {
      throw new Error(
        `Law ${docNumber} not found or has no full_text. Pick a different --sfs.`
      )
    }
    return doc as {
      id: string
      document_number: string
      title: string
      full_text: string
      html_content: string | null
    }
  }

  // Auto-pick: find a law that's in a law list for notification resolution
  const candidate = await prisma.legalDocument.findFirst({
    where: {
      content_type: ContentType.SFS_LAW,
      full_text: { not: null },
      law_list_items: { some: {} },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      full_text: true,
      html_content: true,
    },
    orderBy: { updated_at: 'desc' },
  })

  if (!candidate || !candidate.full_text) {
    // Fallback: any law with full_text
    const fallback = await prisma.legalDocument.findFirst({
      where: {
        content_type: ContentType.SFS_LAW,
        full_text: { not: null },
      },
      select: {
        id: true,
        document_number: true,
        title: true,
        full_text: true,
        html_content: true,
      },
      orderBy: { updated_at: 'desc' },
    })
    if (!fallback || !fallback.full_text) {
      throw new Error('No SFS_LAW with full_text found in the database.')
    }
    return fallback as {
      id: string
      document_number: string
      title: string
      full_text: string
      html_content: string | null
    }
  }

  return candidate as {
    id: string
    document_number: string
    title: string
    full_text: string
    html_content: string | null
  }
}

/**
 * Pick or generate an amendment SFS number.
 * Uses 9999:XXXX to avoid collisions with real amendments.
 */
function pickAmendmentSfs(userAmendment: string | null): string {
  if (userAmendment) {
    return userAmendment.startsWith('SFS ')
      ? userAmendment
      : `SFS ${userAmendment}`
  }
  // Use a simulation namespace: SFS 9999:NNNN
  const n = Math.floor(Math.random() * 9000) + 1000
  return `SFS 9999:${n}`
}

/**
 * Simulate a text change by appending a marker paragraph.
 * This ensures detectChanges() sees a real diff.
 */
function simulateTextChange(
  originalText: string,
  amendmentSfs: string
): string {
  const marker = `\n\n[Simulated change by ${amendmentSfs} — this paragraph was added for pipeline testing.]`
  return originalText + marker
}

// ============================================================================
// Placeholder HTML for dry-run mode
// ============================================================================

function placeholderHtml(sfsNumber: string, baseLawSfs: string): string {
  return `<article data-sfs="${sfsNumber}">
<h1>Lag (${sfsNumber.replace('SFS ', '')}) om ändring i lag (${baseLawSfs.replace('SFS ', '')})</h1>
<section>
<h2>1 §</h2>
<p>Denna lag träder i kraft den 1 januari 2026.</p>
</section>
<section class="transitional">
<h2>Övergångsbestämmelser</h2>
<p>Denna lag träder i kraft den 1 januari 2026.</p>
</section>
</article>`
}

// ============================================================================
// Cleanup
// ============================================================================

async function cleanup(state: SimulationState, dryRun: boolean): Promise<void> {
  console.log('\n--- CLEANUP ---')

  // 1. Delete Notifications
  if (state.notificationIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: state.notificationIds } },
    })
    console.log(`  Deleted ${state.notificationIds.length} notification(s)`)
  }

  // 2. Delete LegalDocument (amendment) + any LegislativeRef records
  if (state.legalDocumentId) {
    // Delete any cross-references first
    await prisma.crossReference.deleteMany({
      where: {
        OR: [
          { source_document_id: state.legalDocumentId },
          { target_document_id: state.legalDocumentId },
        ],
      },
    })
    await prisma.legalDocument.delete({
      where: { id: state.legalDocumentId },
    })
    console.log(`  Deleted LegalDocument ${state.legalDocumentId}`)
  }

  // 3. Delete SectionChanges
  if (state.sectionChangeIds.length > 0) {
    await prisma.sectionChange.deleteMany({
      where: { id: { in: state.sectionChangeIds } },
    })
    console.log(`  Deleted ${state.sectionChangeIds.length} SectionChange(s)`)
  }

  // 4. Delete AmendmentDocument
  if (state.amendmentDocumentId) {
    await prisma.amendmentDocument.delete({
      where: { id: state.amendmentDocumentId },
    })
    console.log(`  Deleted AmendmentDocument ${state.amendmentDocumentId}`)
  }

  // 5. Delete Amendment
  if (state.amendmentId) {
    await prisma.amendment.delete({ where: { id: state.amendmentId } })
    console.log(`  Deleted Amendment ${state.amendmentId}`)
  }

  // 6. Delete ChangeEvent
  if (state.changeEventId) {
    await prisma.changeEvent.delete({ where: { id: state.changeEventId } })
    console.log(`  Deleted ChangeEvent ${state.changeEventId}`)
  }

  // 7. Delete DocumentVersion
  if (state.documentVersionId) {
    await prisma.documentVersion.delete({
      where: { id: state.documentVersionId },
    })
    console.log(`  Deleted DocumentVersion ${state.documentVersionId}`)
  }

  // 8. Delete PDF from Supabase Storage (if live mode)
  if (!dryRun && state.pdfStoragePath && state.pdfSfsNumber) {
    try {
      const deleted = await deletePdf(state.pdfSfsNumber)
      console.log(
        `  ${deleted ? 'Deleted' : 'Failed to delete'} PDF from storage: ${state.pdfStoragePath}`
      )
    } catch {
      console.log(
        `  Could not delete PDF from storage (may not exist): ${state.pdfStoragePath}`
      )
    }
  }

  // 9. Restore original LegalDocument
  if (state.originalDoc) {
    await prisma.legalDocument.update({
      where: { id: state.originalDoc.id },
      data: {
        full_text: state.originalDoc.full_text,
        html_content: state.originalDoc.html_content,
        metadata: (state.originalDoc.metadata as object) ?? undefined,
        last_change_type: state.originalDoc.last_change_type as never,
        last_change_ref: state.originalDoc.last_change_ref,
        last_change_at: state.originalDoc.last_change_at,
      },
    })
    console.log(`  Restored original LegalDocument ${state.originalDoc.id}`)
  }

  console.log('  Cleanup complete.')
}

function printState(state: SimulationState): void {
  console.log('\n--- SIMULATION STATE (for manual cleanup if needed) ---')
  console.log(`  DocumentVersion:   ${state.documentVersionId ?? '(none)'}`)
  console.log(`  ChangeEvent:       ${state.changeEventId ?? '(none)'}`)
  console.log(`  Amendment:         ${state.amendmentId ?? '(none)'}`)
  console.log(`  AmendmentDocument: ${state.amendmentDocumentId ?? '(none)'}`)
  console.log(
    `  SectionChanges:    ${state.sectionChangeIds.length > 0 ? state.sectionChangeIds.join(', ') : '(none)'}`
  )
  console.log(`  LegalDocument:     ${state.legalDocumentId ?? '(none)'}`)
  console.log(
    `  Notifications:     ${state.notificationIds.length > 0 ? state.notificationIds.join(', ') : '(none)'}`
  )
  console.log(`  PDF storage path:  ${state.pdfStoragePath ?? '(none)'}`)
  console.log(`  Original doc ID:   ${state.originalDoc?.id ?? '(none)'}`)
}

async function promptForCleanup(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question('\nClean up simulation records? (Y/n) ', (answer) => {
      rl.close()
      resolve(answer.toLowerCase() !== 'n')
    })
  })
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main(): Promise<void> {
  const args = parseCLIArgs()

  const state: SimulationState = {
    documentVersionId: null,
    changeEventId: null,
    amendmentId: null,
    amendmentDocumentId: null,
    sectionChangeIds: [],
    legalDocumentId: null,
    notificationIds: [],
    pdfStoragePath: null,
    pdfSfsNumber: null,
    originalDoc: null,
  }

  // SIGINT handler: print state so user can manually clean up
  process.on('SIGINT', () => {
    console.log('\n\nInterrupted!')
    printState(state)
    process.exit(130)
  })

  let mode = args.dryRun ? 'DRY-RUN' : 'LIVE'
  const results: StepResult[] = []

  // ================================================================
  // Step 0: Pick law, save original state, simulate text change
  // ================================================================
  console.log('\n=== SETUP ===')

  const baseLaw = await pickBaseLaw(args.sfs)
  const amendmentSfs = pickAmendmentSfs(args.amendment)
  const baseLawSfs = baseLaw.document_number

  // Save original state for cleanup
  const fullDoc = await prisma.legalDocument.findUnique({
    where: { id: baseLaw.id },
    select: {
      id: true,
      full_text: true,
      html_content: true,
      metadata: true,
      last_change_type: true,
      last_change_ref: true,
      last_change_at: true,
    },
  })
  state.originalDoc = fullDoc
    ? {
        id: fullDoc.id,
        full_text: fullDoc.full_text,
        html_content: fullDoc.html_content,
        metadata: fullDoc.metadata,
        last_change_type: fullDoc.last_change_type,
        last_change_ref: fullDoc.last_change_ref,
        last_change_at: fullDoc.last_change_at,
      }
    : null

  const originalText = baseLaw.full_text
  const newText = simulateTextChange(originalText, amendmentSfs)
  const originalHtml = baseLaw.html_content
  const newHtml = originalHtml
    ? originalHtml + `\n<!-- Simulated change by ${amendmentSfs} -->`
    : null

  console.log(`  Base Law:    ${baseLaw.document_number} - ${baseLaw.title}`)
  console.log(`  Amendment:   ${amendmentSfs}`)
  console.log(`  Mode:        ${mode}`)
  console.log(
    `  Original text length: ${originalText.length.toLocaleString()} chars`
  )
  console.log(
    `  Modified text length: ${newText.length.toLocaleString()} chars`
  )
  console.log(
    `  html_content: ${originalHtml ? `${originalHtml.length.toLocaleString()} chars (will be updated)` : '(none)'}`
  )

  console.log('\n=== PIPELINE ===')

  // ================================================================
  // Steps 1-3: Transaction block (archive, detect, create amendment)
  // ================================================================

  let versionId: string | null = null
  let _changeEventId: string | null = null
  let _amendmentId: string | null = null

  // Step 1: Archive previous version
  results.push(
    await runStep(1, 'Archive version', async () => {
      const version = await prisma.$transaction(async (tx) => {
        return archiveDocumentVersion(tx, {
          documentId: baseLaw.id,
          fullText: originalText,
          htmlContent: baseLaw.html_content,
          amendmentSfs,
          sourceSystemdatum: new Date(),
        })
      })
      versionId = version.id
      state.documentVersionId = version.id
      return `v${version.version_number} → ${version.id.slice(0, 8)}...`
    })
  )

  // Step 2: Detect changes
  results.push(
    await runStep(2, 'Detect changes', async () => {
      // Update full_text + html_content to mirror what the real cron does
      await prisma.legalDocument.update({
        where: { id: baseLaw.id },
        data: {
          full_text: newText,
          ...(newHtml ? { html_content: newHtml } : {}),
        },
      })

      const event = await prisma.$transaction(async (tx) => {
        return detectChanges(tx, {
          documentId: baseLaw.id,
          contentType: ContentType.SFS_LAW,
          oldFullText: originalText,
          newFullText: newText,
          amendmentSfs,
          previousVersionId: versionId,
        })
      })
      if (!event) throw new Error('No changes detected (diff was empty)')
      _changeEventId = event.id
      state.changeEventId = event.id
      return `type=${event.change_type}, html_content=${newHtml ? 'updated' : 'unchanged'} → ${event.id.slice(0, 8)}...`
    })
  )

  // Step 3: Create Amendment record
  results.push(
    await runStep(3, 'Create Amendment record', async () => {
      const amendment = await prisma.$transaction(async (tx) => {
        return createAmendmentFromChange(tx, {
          baseDocumentId: baseLaw.id,
          amendmentSfs,
          fullText: newText,
          detectedFromVersionId: versionId ?? undefined,
        })
      })
      if (!amendment)
        throw new Error('Amendment already exists for this SFS number')
      _amendmentId = amendment.id
      state.amendmentId = amendment.id
      return `${amendment.amending_law_title} → ${amendment.id.slice(0, 8)}...`
    })
  )

  // ================================================================
  // Steps 4-6: PDF fetch + AmendmentDocument creation
  // ================================================================

  let pdfBuffer: Buffer | null = null
  let storagePath: string | null = null
  let originalUrl = ''

  // Step 4: Fetch amendment PDF
  results.push(
    await runStep(4, 'Fetch amendment PDF', async () => {
      if (args.dryRun) {
        return 'SKIPPED (dry-run mode)'
      }

      const sfsNum = amendmentSfs.replace('SFS ', '')

      // For simulation SFS numbers (9999:XXXX), we can't fetch a real PDF.
      // Try to use a known amendment if --amendment was specified, otherwise
      // try fetching from the web and fall back to dry-run.
      const fetchResult = await fetchAndStorePdf(sfsNum)

      if (fetchResult.success && fetchResult.metadata) {
        storagePath = fetchResult.metadata.storagePath
        originalUrl = fetchResult.metadata.originalUrl
        state.pdfStoragePath = storagePath
        state.pdfSfsNumber = sfsNum

        // Download the PDF to get the buffer for LLM parsing
        pdfBuffer = await downloadPdf(sfsNum)
        const sizeKb = (fetchResult.metadata.fileSize / 1024).toFixed(1)
        return `${sizeKb} KB → ${storagePath}`
      } else {
        // Fallback to dry-run for remaining steps
        mode = 'DRY-RUN (PDF fetch failed, falling back)'
        console.log(`         Falling back to dry-run: ${fetchResult.error}`)
        return `FALLBACK to dry-run: ${fetchResult.error}`
      }
    })
  )

  // Step 5: Create AmendmentDocument record
  results.push(
    await runStep(5, 'Create AmendmentDocument record', async () => {
      const sfsNum = amendmentSfs.replace('SFS ', '')
      const baseSfsNum = baseLawSfs.replace('SFS ', '')

      const amendmentDoc = await prisma.amendmentDocument.create({
        data: {
          sfs_number: sfsNum,
          storage_path:
            storagePath ?? `simulated/${sfsNum.replace(':', '-')}.pdf`,
          original_url:
            originalUrl ||
            `https://www.svenskforfattningssamling.se/doc/${sfsNum.replace(':', '')}.pdf`,
          file_size: pdfBuffer?.length ?? 0,
          base_law_sfs: baseSfsNum,
          base_law_name: baseLaw.title,
          title: `Lag (${sfsNum}) om ändring i ${baseLaw.title.toLowerCase()}`,
          effective_date: new Date(),
          publication_date: new Date(),
          parse_status: ParseStatus.PENDING,
        },
      })

      state.amendmentDocumentId = amendmentDoc.id
      return `${amendmentDoc.sfs_number} → ${amendmentDoc.id.slice(0, 8)}...`
    })
  )

  // ================================================================
  // Step 6: Parse PDF via Claude LLM
  // ================================================================

  let htmlContent: string

  results.push(
    await runStep(6, 'Parse PDF via Claude LLM', async () => {
      const sfsNum = amendmentSfs.replace('SFS ', '')
      const baseSfsNum = baseLawSfs.replace('SFS ', '')

      if (pdfBuffer && mode === 'LIVE') {
        const result = await parseAmendmentPdf(
          pdfBuffer,
          sfsNum,
          baseSfsNum,
          baseLaw.title
        )
        htmlContent = result.html
        const errors = result.validation.errors.length
        const warnings = result.validation.warnings.length
        return `${htmlContent.length.toLocaleString()} chars HTML, ${errors} errors, ${warnings} warnings`
      } else {
        htmlContent = placeholderHtml(amendmentSfs, baseLawSfs)
        return `PLACEHOLDER HTML (${htmlContent.length} chars)`
      }
    })
  )

  // ================================================================
  // Step 7: Transform HTML → markdown/JSON/plaintext
  // ================================================================

  let markdownContent: string = ''
  let plainText: string = ''
  let jsonContent: unknown = null

  results.push(
    await runStep(7, 'Transform HTML → markdown/JSON/plaintext', async () => {
      const sfsNum = amendmentSfs.replace('SFS ', '')
      const baseSfsNum = baseLawSfs.replace('SFS ', '')

      markdownContent = htmlToMarkdown(htmlContent)
      jsonContent = htmlToJson(htmlContent, {
        documentType: 'amendment',
        sfsNumber: sfsNum,
        baseLawSfs: baseSfsNum,
      })
      plainText = htmlToPlainText(htmlContent)

      return `md=${markdownContent.length} chars, json=${JSON.stringify(jsonContent).length} chars, txt=${plainText.length} chars`
    })
  )

  // ================================================================
  // Step 8: Linkify HTML references
  // ================================================================

  let linkifiedHtml: string = htmlContent

  results.push(
    await runStep(8, 'Linkify HTML references', async () => {
      const slugMap = await buildSlugMap()
      const sfsNum = amendmentSfs.replace('SFS ', '')
      const docNumber = `SFS ${sfsNum}`

      const result = linkifyHtmlContent(htmlContent, slugMap, docNumber)
      linkifiedHtml = result.html
      return `${result.linkedReferences.length} reference(s) linked, slugMap size=${slugMap.size}`
    })
  )

  // ================================================================
  // Step 9: Create SectionChange records
  // ================================================================

  results.push(
    await runStep(9, 'Create SectionChange records', async () => {
      if (!state.amendmentDocumentId) {
        throw new Error('No AmendmentDocument to attach SectionChanges to')
      }

      // Create at least one SectionChange from the simulated change
      const sectionChange = await prisma.sectionChange.create({
        data: {
          amendment_id: state.amendmentDocumentId,
          chapter: null,
          section: '1',
          change_type: 'AMENDED',
          description: 'Simulated section change for pipeline testing',
          new_text: 'Simulated new text content.',
          sort_order: 0,
        },
      })

      state.sectionChangeIds.push(sectionChange.id)
      return `1 SectionChange → ${sectionChange.id.slice(0, 8)}...`
    })
  )

  // ================================================================
  // Step 10: Update AmendmentDocument (mark COMPLETED)
  // ================================================================

  results.push(
    await runStep(10, 'Update AmendmentDocument (COMPLETED)', async () => {
      if (!state.amendmentDocumentId) {
        throw new Error('No AmendmentDocument to update')
      }

      await prisma.amendmentDocument.update({
        where: { id: state.amendmentDocumentId },
        data: {
          parse_status: ParseStatus.COMPLETED,
          parsed_at: new Date(),
          full_text: plainText || 'Simulated plain text',
          markdown_content: markdownContent || 'Simulated markdown',
          confidence: 0.95,
        },
      })

      return `status=COMPLETED`
    })
  )

  // ================================================================
  // Step 11: Create LegalDocument for amendment
  // ================================================================

  results.push(
    await runStep(11, 'Create LegalDocument for amendment', async () => {
      if (!state.amendmentDocumentId) {
        throw new Error('No AmendmentDocument to convert')
      }

      const sfsNum = amendmentSfs.replace('SFS ', '')
      const baseSfsNum = baseLawSfs.replace('SFS ', '')

      const result = await prisma.$transaction(async (tx) => {
        return createLegalDocumentFromAmendment(tx, {
          id: state.amendmentDocumentId!,
          sfs_number: sfsNum,
          title: `Lag (${sfsNum}) om ändring i ${baseLaw.title.toLowerCase()}`,
          base_law_sfs: baseSfsNum,
          base_law_name: baseLaw.title,
          effective_date: new Date(),
          publication_date: new Date(),
          original_url:
            originalUrl ||
            `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_sfs-${sfsNum.replace(':', '-')}/`,
          storage_path:
            storagePath ?? `simulated/${sfsNum.replace(':', '-')}.pdf`,
          full_text: plainText || 'Simulated plain text',
          html_content: linkifiedHtml,
          markdown_content: markdownContent || 'Simulated markdown',
          json_content: jsonContent,
          confidence: 0.95,
        })
      })

      state.legalDocumentId = result.id
      return `${result.isNew ? 'CREATED' : 'UPDATED'} slug=${result.slug} → ${result.id.slice(0, 8)}...`
    })
  )

  // ================================================================
  // Step 12: Resolve notification recipients
  // ================================================================

  results.push(
    await runStep(12, 'Resolve notification recipients', async () => {
      const recipients = await resolveAffectedRecipients(baseLaw.id)
      return `${recipients.length} recipient(s) across ${new Set(recipients.map((r) => r.workspaceId)).size} workspace(s)`
    })
  )

  // ================================================================
  // Step 13: Create notifications
  // ================================================================

  results.push(
    await runStep(13, 'Create notifications', async () => {
      if (!state.changeEventId) {
        throw new Error('No ChangeEvent to create notifications for')
      }

      const stats = await createChangeNotifications(state.changeEventId)

      // Find the notifications that were just created so we can clean them up
      const notifications = await prisma.notification.findMany({
        where: {
          entity_type: 'change_event',
          entity_id: state.changeEventId,
        },
        select: { id: true },
      })
      state.notificationIds = notifications.map((n) => n.id)

      return `created=${stats.notificationsCreated}, users=${stats.usersNotified}, workspaces=${stats.workspacesAffected}, skipped=${stats.skippedByPreference}`
    })
  )

  // ================================================================
  // Step 14: Send notification email (optional)
  // ================================================================

  if (args.sendEmail) {
    results.push(
      await runStep(14, 'Send notification email', async () => {
        const _sfsNum = amendmentSfs.replace('SFS ', '')
        const baseSfsNum = baseLawSfs.replace('SFS ', '')

        // Build a slug-like URL path from the law title
        const slug = baseLaw.title
          .toLowerCase()
          .replace(/[åä]/g, 'a')
          .replace(/ö/g, 'o')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
        const lawUrl = `https://laglig.se/lagar/${slug}-${baseSfsNum.replace(':', '')}`

        const result = await sendEmail({
          to: args.sendEmail!,
          subject: `Lagändring: ${baseLaw.title} (${amendmentSfs})`,
          from: 'updates',
          react: React.createElement(AmendmentNotificationEmail, {
            lawTitle: baseLaw.title,
            lawSfsNumber: baseLawSfs,
            amendmentSfsNumber: amendmentSfs,
            body: `Ändrad genom ${amendmentSfs}`,
            lawUrl,
          }),
        })

        if (!result.success) {
          throw new Error(
            `Email send failed: ${'error' in result ? result.error : 'unknown'}`
          )
        }
        return `sent to ${args.sendEmail}`
      })
    )
  }

  // ================================================================
  // Summary
  // ================================================================

  const passed = results.filter((r) => r.passed).length
  const total = results.length

  console.log('\n=== SIMULATION SUMMARY ===')
  console.log(`  Base Law:    ${baseLaw.document_number} - ${baseLaw.title}`)
  console.log(`  Amendment:   ${amendmentSfs}`)
  console.log(`  Mode:        ${mode}`)
  console.log(`\n  Results: ${passed}/${total} passed`)

  if (passed < total) {
    console.log('\n  Failed steps:')
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    Step ${r.step}: ${r.name} — ${r.error}`)
    }
  }

  // ================================================================
  // Cleanup
  // ================================================================

  if (args.noCleanup) {
    printState(state)
    console.log('\n  --no-cleanup: records left in database.')
  } else if (args.autoCleanup) {
    await cleanup(state, args.dryRun || !pdfBuffer)
  } else {
    printState(state)
    const shouldCleanup = await promptForCleanup()
    if (shouldCleanup) {
      await cleanup(state, args.dryRun || !pdfBuffer)
    } else {
      console.log('  Skipping cleanup. Use the IDs above for manual cleanup.')
    }
  }

  await prisma.$disconnect()
  process.exit(passed === total ? 0 : 1)
}

// ============================================================================
// Entry point
// ============================================================================

main().catch(async (error) => {
  console.error('\nFatal error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
