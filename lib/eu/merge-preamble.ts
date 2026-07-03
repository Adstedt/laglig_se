import * as cheerio from 'cheerio'

export interface MergePreambleResult {
  /** The consolidated article with the base act's preamble spliced in. */
  html: string
  /** True when a base preamble was found and merged. */
  merged: boolean
  /** Rough count of recital paragraphs carried over (verification signal). */
  recitalParas: number
}

/**
 * Splice the base act's recital-rich preamble into a consolidated article
 * (Story 2.6). CELLAR's consolidated HTML omits the recitals ("Inledning och
 * skäl"); the base act keeps them. Recitals are the original preamble and are
 * not renumbered by amendments, so we keep the consolidated body (current
 * article text) and borrow the base act's preamble — matching how EUR-Lex's
 * own consolidated view presents it.
 *
 * Both inputs are transformer output (`<article class="legal-document">…`).
 * Serialization uses `$('body').html()` to return a fragment (no html/body
 * wrapper), matching the linkify convention.
 */
export function mergeBasePreamble(
  consolidatedHtml: string,
  baseHtml: string
): MergePreambleResult {
  const $c = cheerio.load(consolidatedHtml, { decodeEntities: false } as never)
  const $b = cheerio.load(baseHtml, { decodeEntities: false } as never)

  const basePreamble = $b('details.preamble-accordion').first()
  if (basePreamble.length === 0) {
    return { html: consolidatedHtml, merged: false, recitalParas: 0 }
  }
  const basePreambleHtml = $b.html(basePreamble)
  const recitalParas = basePreamble.find('.preamble p').length

  const consPreamble = $c('details.preamble-accordion').first()
  if (consPreamble.length > 0) {
    // Consolidated has a (hollow) preamble accordion — replace it wholesale.
    consPreamble.replaceWith(basePreambleHtml)
  } else {
    // No preamble in consolidated — insert after the header, else at article start.
    const head = $c('.lovhead').first()
    if (head.length > 0) head.after(basePreambleHtml)
    else $c('article').first().prepend(basePreambleHtml)
  }

  return {
    html: $c('body').html() ?? consolidatedHtml,
    merged: true,
    recitalParas,
  }
}
