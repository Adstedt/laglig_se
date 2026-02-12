/**
 * AFS HTML Transformer — av.se HTML → Laglig schema
 * Story 9.1, Task 4
 *
 * Maps av.se CMS classes (Episerver/Optimizely) to our .legal-document
 * CSS structure. Handles three heading patterns:
 *
 * 1. Flat (no chapters): h2 = section headings
 * 2. Chapters only: h2 = kapitel, h3 = section headings
 * 3. Avdelningar + chapters: h2 = avdelning, h3 = kapitel, h4 = section headings
 *
 * The heading pattern is determined by `hasAvdelningar` from AFS_REGISTRY
 * combined with `chapterCount`.
 */

import * as cheerio from 'cheerio'
import type { AfsDocument } from './afs-registry'

// ============================================================================
// Types
// ============================================================================

export interface TransformResult {
  /** Complete transformed HTML wrapped in <article class="sfs"> */
  html: string
  /** Stats for verification */
  stats: {
    sectionSignCount: number
    allmanaRadCount: number
    tableCount: number
    footnoteCount: number
    bilagaCount: number
    hasOvergangsbestammelser: boolean
  }
}

export type HeadingPattern = 'flat' | 'chapters-only' | 'avdelningar-chapters'

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Determine the heading pattern for a document.
 * - STANDALONE (chapterCount 1, no avdelningar) → 'flat'
 * - KEEP_WHOLE or SPLIT without avdelningar → 'chapters-only'
 * - KEEP_WHOLE or SPLIT with avdelningar → 'avdelningar-chapters'
 */
export function detectHeadingPattern(doc: AfsDocument): HeadingPattern {
  if (doc.chapterCount <= 1) return 'flat'
  if (doc.hasAvdelningar) return 'avdelningar-chapters'
  return 'chapters-only'
}

// ============================================================================
// Core Transformer
// ============================================================================

/**
 * Transform av.se provision HTML into our Laglig schema HTML.
 *
 * @param provisionHtml - The inner HTML of div.provision from av.se
 * @param doc - The AFS document registry entry (for heading pattern detection)
 * @returns Transformed HTML wrapped in <article class="sfs">
 */
export function transformAfsHtml(
  provisionHtml: string,
  doc: AfsDocument
): TransformResult {
  const $ = cheerio.load(provisionHtml, { xml: false })
  // Track stats
  const stats = {
    sectionSignCount: 0,
    allmanaRadCount: 0,
    tableCount: 0,
    footnoteCount: 0,
    bilagaCount: 0,
    hasOvergangsbestammelser: false,
  }

  // ---- Strip CMS editorial links ----
  $('span.provisioncmsurl').remove()

  // ---- Transform footnotes ----
  // Convert interactive footnote popups to static footnote markup
  $('button.footnote.provision__opendialog').each((_i, el) => {
    const $btn = $(el)
    const noteNum = $btn.attr('data-footnote') || $btn.text().trim()
    stats.footnoteCount++

    // Find the adjacent dialog wrapper
    const $dialog = $btn.siblings('div.provision__dialog-wrapper').first()
    let noteText = ''
    if ($dialog.length > 0) {
      noteText = $dialog
        .find('div.paragraph p')
        .map((_j, p) => $(p).text().trim())
        .get()
        .join(' ')
      $dialog.remove()
    }

    // Replace the button with a superscript reference
    $btn.replaceWith(
      `<sup class="footnote-ref" data-note="${noteNum}" title="${escapeAttr(noteText)}">${noteNum}</sup>`
    )
  })

  // Extract tables from remaining dialog wrappers before removing them.
  // av.se wraps tables in expandable overlay dialogs using the same
  // provision__dialog-wrapper class as footnote popups:
  //   div.provision__dialog-wrapper > div.provision__dialog > table.provision__table
  $('div.provision__dialog-wrapper').each((_i, el) => {
    const $wrapper = $(el)
    const $table = $wrapper.find('table.provision__table')
    if ($table.length > 0) {
      $wrapper.replaceWith($table)
    } else {
      $wrapper.remove()
    }
  })
  $('button.provision__closedialog').remove()
  $('div.provision__table-overlay').remove()
  // Remove "Visa hela tabellen" trigger buttons (table open-dialog triggers)
  $('button.provision__table.provision__opendialog').remove()

  // ---- Transform section signs (§) ----
  $('span.section-sign').each((_i, el) => {
    const $span = $(el)
    const text = $span
      .text()
      .trim()
      .replace(/\u00a0/g, ' ')
    const id = $span.attr('id') || ''
    stats.sectionSignCount++

    $span.replaceWith(
      `<a class="paragraf" id="${escapeAttr(id)}" name="${escapeAttr(id)}">${text}</a>`
    )
  })

  // ---- Transform Allmänna råd ----
  $('div.general-recommendation').each((_i, el) => {
    const $rec = $(el)
    stats.allmanaRadCount++

    // Get the heading text (usually "Allmänna råd")
    const headingText = $rec.find('div.h2').text().trim() || 'Allmänna råd'
    $rec.find('div.h2').remove()

    // Get the inner content
    const innerHtml = $rec.html() || ''

    $rec.replaceWith(
      `<div class="allmanna-rad"><p class="allmanna-rad-heading"><strong>${headingText}</strong></p>${innerHtml}</div>`
    )
  })

  // ---- Transform tables ----
  $('table.provision__table').each((_i, el) => {
    const $table = $(el)
    stats.tableCount++
    $table.removeClass('provision__table').addClass('legal-table')
  })

  // ---- Transform lists ----
  $('ol.provisionlist').each((_i, el) => {
    const $ol = $(el)
    $ol.removeClass('provisionlist')

    // Map av.se list styles to standard HTML
    if ($ol.hasClass('liststyle-lower-alpha')) {
      $ol.attr('type', 'a')
      $ol.removeClass('liststyle-lower-alpha')
    } else if ($ol.hasClass('liststyle-decimal')) {
      $ol.attr('type', '1')
      $ol.removeClass('liststyle-decimal')
    }

    // Clean up remaining av.se list classes
    $ol.removeClass('listsuffix-. listsuffix-)')
    $ol.removeAttr('style') // Remove --start CSS var

    // Clean up empty class attribute
    if (!$ol.attr('class')?.trim()) {
      $ol.removeAttr('class')
    }
  })

  // ---- Transform paragraphs ----
  // div.paragraph is an av.se wrapper — unwrap it to simplify DOM.
  // Process bottom-up: deepest nested first so parent replacements work.
  let $paragraphs = $('div.paragraph')
  while ($paragraphs.length > 0) {
    // Find leaf div.paragraph elements (those without child div.paragraph)
    $paragraphs.each((_i, el) => {
      const $div = $(el)
      if ($div.find('div.paragraph').length === 0) {
        $div.replaceWith($div.html() || '')
      }
    })
    $paragraphs = $('div.paragraph')
  }

  // ---- Transform signatures ----
  $('span.signature').each((_i, el) => {
    $(el).replaceWith(`<strong>${$(el).text()}</strong>`)
  })

  // ---- Build document sections ----
  const docId = doc.documentNumber.replace(/\s+/g, '').replace(/:/g, '-')

  // Extract and transform the rules section
  const $rules = $('div.rules')
  const rulesHtml = $rules.length > 0 ? $rules.html() || '' : ''

  // Extract and transform transitional regulations
  const $transitional = $('div.transitionalregulations')
  let transitionalHtml = ''
  if ($transitional.length > 0) {
    stats.hasOvergangsbestammelser = true
    transitionalHtml = $transitional.html() || ''
  }

  // Extract and transform appendices
  const $appendices = $('div.appendices')
  let appendicesHtml = ''
  if ($appendices.length > 0) {
    // Count bilagor by counting h2 elements in appendices
    stats.bilagaCount = $appendices.find('h2').length
    appendicesHtml = $appendices.html() || ''
  }

  // Extract preamble
  const $preamble = $('div.preamble')
  const preambleHtml = $preamble.length > 0 ? $preamble.html() || '' : ''

  // ---- Assemble final document ----
  const parts: string[] = []

  parts.push(`<article class="sfs" id="${docId}">`)
  parts.push(`  <div class="lovhead">`)
  parts.push(`    <h1>`)
  parts.push(`      <p class="text">${doc.documentNumber}</p>`)
  parts.push(`      <p class="text">${escapeHtml(doc.title)}</p>`)
  parts.push(`    </h1>`)
  parts.push(`  </div>`)

  if (preambleHtml) {
    parts.push(`  <div class="preamble">`)
    parts.push(`    ${preambleHtml}`)
    parts.push(`  </div>`)
  }

  parts.push(`  <div class="body">`)
  parts.push(`    ${rulesHtml}`)
  parts.push(`  </div>`)

  if (appendicesHtml) {
    parts.push(`  <div class="appendices">`)
    parts.push(`    ${appendicesHtml}`)
    parts.push(`  </div>`)
  }

  if (transitionalHtml) {
    parts.push(`  <footer class="back">`)
    parts.push(`    ${transitionalHtml}`)
    parts.push(`  </footer>`)
  }

  parts.push(`</article>`)

  return {
    html: parts.join('\n'),
    stats,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
