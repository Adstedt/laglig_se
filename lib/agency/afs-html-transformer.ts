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
import type { Element, AnyNode } from 'domhandler'
import type { AfsDocument } from './afs-registry'

// ============================================================================
// Types
// ============================================================================

export interface TransformResult {
  /** Complete transformed HTML wrapped in <article class="legal-document"> */
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
 * @returns Transformed HTML wrapped in <article class="legal-document">
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
  const headingPattern = detectHeadingPattern(doc)

  // ---- Canonicalize rules structure ----
  const $rules = $('div.rules')
  if ($rules.length > 0) {
    canonicalizeRulesStructure($, $rules, docId, headingPattern)
  }

  // Extract the rules section (now canonicalized)
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

  parts.push(`<article class="legal-document" id="${docId}">`)
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
// Canonicalization — restructure rules into canonical hierarchy
// ============================================================================

/**
 * Restructure rules content into canonical HTML hierarchy:
 * - Wrap a.paragraf in h3.paragraph
 * - Add class="text" to bare <p> elements
 * - Wrap chapters in section.kapitel with semantic IDs
 * - Wrap avdelningar in section.avdelning (3-level hierarchy)
 */
function canonicalizeRulesStructure(
  $: cheerio.CheerioAPI,
  $rules: cheerio.Cheerio<Element>,
  docId: string,
  pattern: HeadingPattern
): void {
  // Step 1: Wrap bare a.paragraf in h3.paragraph
  $rules.find('a.paragraf').each((_i, el) => {
    const $a = $(el)
    if (!$a.parent('h3').length) {
      $a.wrap('<h3 class="paragraph"></h3>')
    }
  })

  // Step 2: Add class="text" to <p> elements without a class
  $rules.find('p').each((_i, el) => {
    const $p = $(el)
    if (!$p.attr('class')) {
      $p.addClass('text')
    }
  })

  // Step 3: Structure based on heading pattern
  if (pattern === 'flat') {
    assignFlatIds($, $rules, docId)
  } else if (pattern === 'chapters-only') {
    wrapInChapters($, $rules, docId)
  } else {
    wrapInAvdelningarAndChapters($, $rules, docId)
  }
}

/** Extract section number from text like "1 §" or "2a §" */
function extractSectionNumber(text: string): string | null {
  const match = text
    .trim()
    .replace(/\u00a0/g, ' ')
    .match(/^(\d+)\s*([a-z])?\s*§/)
  if (!match) return null
  return match[1] + (match[2] || '')
}

/** Extract chapter number from text like "1 kap. Allmänna bestämmelser" */
function extractChapterNumber(text: string): string | null {
  const match = text.trim().match(/^(\d+)\s*kap\./)
  return match ? match[1]! : null
}

/** Extract avdelning number from text like "Avdelning 1 ..." */
function extractAvdelningNumber(text: string): string | null {
  const match = text.trim().match(/^Avdelning\s+(\d+)/i)
  return match ? match[1]! : null
}

/** Assign flat semantic IDs (DOC_ID_P{S}) for non-chaptered docs */
function assignFlatIds(
  $: cheerio.CheerioAPI,
  $rules: cheerio.Cheerio<Element>,
  docId: string
): void {
  $rules.find('a.paragraf').each((_i, el) => {
    const $a = $(el)
    const num = extractSectionNumber($a.text())
    if (num) {
      const id = `${docId}_P${num}`
      $a.attr('id', id)
      $a.attr('name', id)
    }
  })
}

/** Update paragraf IDs within a chapter context */
function updateParagrafIds(
  $: cheerio.CheerioAPI,
  elements: AnyNode[],
  docId: string,
  chapterNum: string
): void {
  for (const el of elements) {
    $(el)
      .find('a.paragraf')
      .each((_i, a) => {
        const $a = $(a)
        const num = extractSectionNumber($a.text())
        if (num) {
          const id = `${docId}_K${chapterNum}_P${num}`
          $a.attr('id', id)
          $a.attr('name', id)
        }
      })
  }
}

interface NodeGroup {
  heading: AnyNode | null
  num: string | null
  elements: AnyNode[]
}

/** Group direct children of a container by heading boundaries */
function groupByHeading(
  $: cheerio.CheerioAPI,
  $container: cheerio.Cheerio<Element>,
  headingTag: string,
  extractNum: (_text: string) => string | null
): NodeGroup[] {
  const children = $container.children().toArray()
  const groups: NodeGroup[] = []
  let current: NodeGroup = { heading: null, num: null, elements: [] }

  for (const child of children) {
    const tagName = child.type === 'tag' ? (child as Element).tagName : null
    const text = $(child).text().trim()
    const isTarget = tagName === headingTag && extractNum(text) !== null

    if (isTarget) {
      if (current.heading || current.elements.length) {
        groups.push(current)
      }
      current = { heading: child, num: extractNum(text), elements: [] }
    } else {
      current.elements.push(child)
    }
  }
  if (current.heading || current.elements.length) {
    groups.push(current)
  }
  return groups
}

/** Wrap chapters in section.kapitel for chapters-only pattern */
function wrapInChapters(
  $: cheerio.CheerioAPI,
  $rules: cheerio.Cheerio<Element>,
  docId: string
): void {
  const groups = groupByHeading($, $rules, 'h2', extractChapterNumber)
  $rules.empty()

  for (const group of groups) {
    if (group.heading && group.num) {
      const sectionId = `${docId}_K${group.num}`
      const $section = $(
        `<section class="kapitel" id="${sectionId}"></section>`
      )

      // Convert heading to kapitel-rubrik
      const $h = $(group.heading)
      $h.addClass('kapitel-rubrik')
      $h.removeAttr('data-menu').removeAttr('id')
      $section.append(group.heading)

      // Update paragraf IDs and append children
      updateParagrafIds($, group.elements, docId, group.num)
      for (const el of group.elements) {
        $section.append(el)
      }
      $rules.append($section)
    } else {
      // Content before first chapter
      for (const el of group.elements) {
        $rules.append(el)
      }
    }
  }
}

/** Wrap avdelningar and chapters for 3-level hierarchy */
function wrapInAvdelningarAndChapters(
  $: cheerio.CheerioAPI,
  $rules: cheerio.Cheerio<Element>,
  docId: string
): void {
  // First level: group by avdelning (h2)
  const avdGroups = groupByHeading($, $rules, 'h2', extractAvdelningNumber)
  $rules.empty()

  for (const avdGroup of avdGroups) {
    if (avdGroup.heading && avdGroup.num) {
      const avdId = `${docId}_AVD${avdGroup.num}`
      const $avdSection = $(
        `<section class="avdelning" id="${avdId}"></section>`
      )

      // Convert heading to avdelning-rubrik
      const $avdH = $(avdGroup.heading)
      $avdH.addClass('avdelning-rubrik')
      $avdH.removeAttr('data-menu').removeAttr('id')
      $avdSection.append(avdGroup.heading)

      // Second level: group children by chapter (h3)
      // Build a temporary container for grouping
      const $temp = $('<div></div>')
      for (const el of avdGroup.elements) {
        $temp.append($(el).clone())
      }
      const chapGroups = groupByHeading(
        $,
        $temp as cheerio.Cheerio<Element>,
        'h3',
        extractChapterNumber
      )

      for (const chapGroup of chapGroups) {
        if (chapGroup.heading && chapGroup.num) {
          const chapId = `${docId}_K${chapGroup.num}`
          const $chapSection = $(
            `<section class="kapitel" id="${chapId}"></section>`
          )

          // Convert heading to kapitel-rubrik (stays h3)
          const $chapH = $(chapGroup.heading)
          $chapH.addClass('kapitel-rubrik')
          $chapH.removeAttr('data-menu').removeAttr('id')
          $chapSection.append(chapGroup.heading)

          updateParagrafIds($, chapGroup.elements, docId, chapGroup.num)
          for (const el of chapGroup.elements) {
            $chapSection.append(el)
          }
          $avdSection.append($chapSection)
        } else {
          // Pre-chapter content within avdelning
          for (const el of chapGroup.elements) {
            $avdSection.append(el)
          }
        }
      }

      $rules.append($avdSection)
    } else {
      // Content before first avdelning
      for (const el of avdGroup.elements) {
        $rules.append(el)
      }
    }
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
