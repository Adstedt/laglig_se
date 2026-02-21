/**
 * SFS Amendment HTML Normalizer
 *
 * Converts LLM-generated amendment HTML (Notisum-style nesting) into
 * canonical HTML structure matching the normalizer output for base laws.
 *
 * Transformations:
 * 1. Strip Notisum wrappers: div.N2, section.ann, div.element-body.annzone
 * 2. Convert h3.paragraph bare text → h3.paragraph > a.paragraf with proper IDs
 * 3. Strip <span class="kapitel"> from § headings
 * 4. Add class="kapitel-rubrik" to chapter h2 headings
 * 5. Unwrap section.group wrappers, keep group headings
 * 6. Preserve all content: text, footnotes, lists, tables, footer
 */

import * as cheerio from 'cheerio'

export interface SfsAmendmentNormalizerOptions {
  documentNumber: string
  title: string
}

/**
 * Normalize amendment HTML from Notisum-style to canonical structure.
 * Idempotent: if already canonical (has a.paragraf anchors with proper IDs), returns unchanged.
 * Also repairs previously-normalized docs that have empty h3.paragraph + empty a.paragraf IDs.
 */
export function normalizeSfsAmendment(
  html: string,
  _options: SfsAmendmentNormalizerOptions
): string {
  if (!html || html.trim().length === 0) return html

  // Must be an amendment document with a recognized wrapper
  const hasSfsWrapper = html.includes('class="sfs"')
  const hasLegalDocWrapper = html.includes('class="legal-document"')
  if (!hasSfsWrapper && !hasLegalDocWrapper) return html

  // Rename class="sfs" → class="legal-document" (Task 1b)
  let processedHtml = html
  if (hasSfsWrapper && !hasLegalDocWrapper) {
    processedHtml = processedHtml.replace(
      'class="sfs"',
      'class="legal-document"'
    )
  }

  const hasNotisum =
    processedHtml.includes('annzone') || processedHtml.includes('class="ann"')
  const alreadyCanonical = processedHtml.includes('class="paragraf"')

  // Check for broken state: a.paragraf with empty id (from previous incomplete normalization)
  const hasBrokenIds =
    alreadyCanonical && processedHtml.includes('class="paragraf" id=""')

  // Truly canonical — nothing to do
  if (alreadyCanonical && !hasBrokenIds && !hasNotisum) return processedHtml

  // If broken IDs but Notisum wrappers already stripped, just run repair pass
  if (hasBrokenIds && !hasNotisum) {
    return repairEmptyHeadings(processedHtml)
  }

  // Not canonical and no Notisum markers — nothing we can normalize
  if (!hasNotisum) return processedHtml

  const $ = cheerio.load(processedHtml, {
    decodeEntities: false,
  } as cheerio.CheerioOptions)

  // 1. Add class="kapitel-rubrik" to chapter h2 headings
  $('section.kapitel > h2').each((_, el) => {
    const $h2 = $(el)
    if (!$h2.hasClass('kapitel-rubrik')) {
      $h2.addClass('kapitel-rubrik')
    }
  })

  // 2a. Clean h3.paragraph: remove kapitel spans and old-style Notisum footnotes.
  //     These are duplicated in dl.footnote-content blocks and render as visible "2) " text.
  //     Only canonical sup.footnote-ref (with inline title/data-note) is preserved.
  $('h3.paragraph').each((_, el) => {
    const $h3 = $(el)
    $h3.find('span.kapitel').remove()
    $h3.find('sup.footnote').remove()
  })

  // 2b. Merge empty h3.paragraph into next sibling, carrying the ID forward.
  //     This handles the case where LLM puts footnote in one h3 and § text in another —
  //     after footnote removal the first h3 becomes empty but still holds the section ID.
  $('h3.paragraph').each((_, el) => {
    const $h3 = $(el)
    if ($h3.text().trim() !== '') return

    const $next = $h3.next('h3.paragraph')
    if (!$next.length) return

    const id = $h3.attr('id') || ''
    if (id && !$next.attr('id')) {
      $next.attr('id', id)
    }
    $h3.remove()
  })

  // 2c. Convert cleaned h3.paragraph text → a.paragraf anchors
  $('h3.paragraph').each((_, el) => {
    const $h3 = $(el)
    const id = $h3.attr('id') || ''

    // Get the remaining text content (e.g., "1 §" or "23 a §")
    const $clone = $h3.clone()
    $clone.find('sup').remove()
    const sectionText = $clone.text().trim()

    // Build the a.paragraf anchor
    if (sectionText && sectionText.includes('§')) {
      // Preserve canonical footnote-ref sups (if any)
      const $footnoteRefs = $h3.find('sup.footnote-ref')
      const footnotesHtml =
        $footnoteRefs.length > 0
          ? $footnoteRefs
              .map((_, s) => $.html(s))
              .get()
              .join('')
          : ''

      $h3.html(
        `<a class="paragraf" id="${id}" name="${id}">${sectionText}</a>${footnotesHtml}`
      )
      // Remove id from h3 since it's now on the anchor
      $h3.removeAttr('id')
    }
  })

  // 3. Convert h3.group headings before unwrapping
  $('section.group > h3.group').each((_, el) => {
    $(el).removeClass('group')
    if (!$(el).attr('class')) $(el).removeAttr('class')
  })

  // 4. Unwrap Notisum wrapper layers repeatedly until none remain.
  //    Cheerio's replaceWith creates new DOM nodes that may not be found
  //    by the same query pass, so we loop until stable.
  const wrapperSelectors = [
    'div.N2',
    'div.annzone',
    'div.element-body',
    'section.ann',
    'section.group',
  ]
  let maxPasses = 10
  while (maxPasses-- > 0) {
    let unwrapped = 0
    for (const selector of wrapperSelectors) {
      $(selector).each((_, el) => {
        $(el).replaceWith($(el).html() || '')
        unwrapped++
      })
    }
    if (unwrapped === 0) break
  }

  // 5. Clean up excessive whitespace left by unwrapped wrappers
  let result = $.html()
  result = result.replace(/\n\s*\n\s*\n/g, '\n\n')

  return result
}

/**
 * Repair canonical HTML that has empty h3.paragraph elements and a.paragraf with empty IDs.
 * This fixes documents previously normalized with a bug that didn't merge split headings.
 */
function repairEmptyHeadings(html: string): string {
  const $ = cheerio.load(html, {
    decodeEntities: false,
  } as cheerio.CheerioOptions)
  let changed = false

  $('h3.paragraph').each((_, el) => {
    const $h3 = $(el)
    // Check if this h3 is empty (left behind after previous footnote removal)
    if ($h3.children().length > 0 || $h3.text().trim() !== '') return

    const id = $h3.attr('id') || ''
    const $next = $h3.next('h3.paragraph')

    if ($next.length && id) {
      // Transfer ID to the a.paragraf anchor in the next h3
      const $anchor = $next.find('a.paragraf')
      if ($anchor.length) {
        $anchor.attr('id', id)
        $anchor.attr('name', id)
      }
    }

    $h3.remove()
    changed = true
  })

  if (!changed) return html

  let result = $.html()
  result = result.replace(/\n\s*\n\s*\n/g, '\n\n')
  return result
}
