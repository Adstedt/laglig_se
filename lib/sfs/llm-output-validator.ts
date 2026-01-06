/**
 * LLM Output Validator for PDF to HTML conversion
 * Story 2.29: Validates and cleans HTML output from Claude Vision
 *
 * This module:
 * 1. Removes markdown fences if present
 * 2. Validates HTML structure
 * 3. Checks for required elements
 * 4. Flags suspicious outputs for review
 */

import * as cheerio from 'cheerio'

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  /** Whether the output is valid */
  valid: boolean
  /** Cleaned HTML (markdown fences removed, etc.) */
  cleanedHtml: string | null
  /** Validation errors */
  errors: ValidationError[]
  /** Warnings (non-blocking issues) */
  warnings: ValidationWarning[]
  /** Quality metrics */
  metrics: QualityMetrics
}

export interface ValidationError {
  code: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationWarning {
  code: string
  message: string
}

export interface QualityMetrics {
  /** Total character count of content */
  charCount: number
  /** Number of sections found */
  sectionCount: number
  /** Number of paragraphs found */
  paragraphCount: number
  /** Number of list items found */
  listItemCount: number
  /** Whether transition provisions are present */
  hasTransitionProvisions: boolean
  /** Number of footnotes found */
  footnoteCount: number
  /** Ratio of output tokens to typical expected */
  outputRatio: number
  /** Whether the document appears complete */
  appearsComplete: boolean
}

// ============================================================================
// Main Validator
// ============================================================================

/**
 * Validate and clean LLM output
 */
export function validateLlmOutput(
  rawOutput: string,
  expectedSfsNumber: string
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Step 1: Clean the raw output
  let cleanedHtml = cleanRawOutput(rawOutput)

  if (!cleanedHtml || cleanedHtml.trim().length === 0) {
    return {
      valid: false,
      cleanedHtml: null,
      errors: [{ code: 'EMPTY_OUTPUT', message: 'LLM output is empty', severity: 'error' }],
      warnings: [],
      metrics: createEmptyMetrics(),
    }
  }

  // Step 2: Parse HTML
  let $: cheerio.CheerioAPI
  try {
    $ = cheerio.load(cleanedHtml)
  } catch (error) {
    return {
      valid: false,
      cleanedHtml: null,
      errors: [
        {
          code: 'INVALID_HTML',
          message: `Failed to parse HTML: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
        },
      ],
      warnings: [],
      metrics: createEmptyMetrics(),
    }
  }

  // Step 3: Validate structure
  const structureErrors = validateStructure($, expectedSfsNumber)
  errors.push(...structureErrors)

  // Step 4: Check for required elements
  const elementWarnings = checkRequiredElements($)
  warnings.push(...elementWarnings)

  // Step 5: Calculate quality metrics
  const metrics = calculateMetrics($)

  // Step 6: Check for suspicious outputs
  const suspiciousWarnings = checkSuspiciousOutput(metrics)
  warnings.push(...suspiciousWarnings)

  // Step 7: Apply post-processing fixes
  cleanedHtml = applyPostProcessingFixes($)

  const valid = errors.filter((e) => e.severity === 'error').length === 0

  return {
    valid,
    cleanedHtml: valid ? cleanedHtml : null,
    errors,
    warnings,
    metrics,
  }
}

// ============================================================================
// Cleaning Functions
// ============================================================================

/**
 * Clean raw LLM output by removing markdown fences and other artifacts
 */
export function cleanRawOutput(rawOutput: string): string {
  if (!rawOutput) return ''

  let cleaned = rawOutput.trim()

  // Remove markdown code fences
  // Pattern 1: ```html ... ```
  cleaned = cleaned.replace(/^```html\s*/i, '')
  cleaned = cleaned.replace(/```\s*$/i, '')

  // Pattern 2: ```xml ... ```
  cleaned = cleaned.replace(/^```xml\s*/i, '')

  // Pattern 3: ``` ... ``` (generic)
  cleaned = cleaned.replace(/^```\s*/i, '')

  // Remove any leading/trailing explanation text before/after HTML
  const htmlStart = cleaned.indexOf('<')
  const htmlEnd = cleaned.lastIndexOf('>')

  if (htmlStart > 0 || htmlEnd < cleaned.length - 1) {
    if (htmlStart !== -1 && htmlEnd !== -1 && htmlEnd > htmlStart) {
      cleaned = cleaned.substring(htmlStart, htmlEnd + 1)
    }
  }

  // Normalize whitespace
  cleaned = cleaned.replace(/\r\n/g, '\n')

  return cleaned.trim()
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateStructure(
  $: cheerio.CheerioAPI,
  expectedSfsNumber: string
): ValidationError[] {
  const errors: ValidationError[] = []

  // Check for article element
  const article = $('article.sfs')
  if (article.length === 0) {
    errors.push({
      code: 'MISSING_ARTICLE',
      message: 'Missing <article class="sfs"> root element',
      severity: 'error',
    })
  }

  // Check for body element
  const body = $('div.body')
  if (body.length === 0) {
    errors.push({
      code: 'MISSING_BODY',
      message: 'Missing <div class="body"> element',
      severity: 'warning',
    })
  }

  // Check SFS number in ID
  const normalizedSfs = expectedSfsNumber.replace(':', '-')
  const articleId = article.attr('id') || ''
  if (articleId && !articleId.includes(normalizedSfs)) {
    errors.push({
      code: 'SFS_MISMATCH',
      message: `Article ID "${articleId}" doesn't match expected SFS ${expectedSfsNumber}`,
      severity: 'warning',
    })
  }

  // Check for malformed HTML patterns
  const html = $.html()

  // Check for unclosed tags (basic heuristic)
  const openTags = (html.match(/<section[^>]*>/g) || []).length
  const closeTags = (html.match(/<\/section>/g) || []).length
  if (openTags !== closeTags) {
    errors.push({
      code: 'UNCLOSED_SECTIONS',
      message: `Mismatched section tags: ${openTags} open, ${closeTags} close`,
      severity: 'warning',
    })
  }

  return errors
}

function checkRequiredElements($: cheerio.CheerioAPI): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Check for at least one section
  const sections = $('section.ann, section.kapitel')
  if (sections.length === 0) {
    warnings.push({
      code: 'NO_SECTIONS',
      message: 'No section elements found - document may be incomplete',
    })
  }

  // Check for paragraph text
  const paragraphs = $('p.text')
  if (paragraphs.length === 0) {
    warnings.push({
      code: 'NO_PARAGRAPHS',
      message: 'No paragraph text found - document may be incomplete',
    })
  }

  // Check for section headers
  const headers = $('h3.paragraph, h3.group')
  if (headers.length === 0) {
    warnings.push({
      code: 'NO_HEADERS',
      message: 'No section headers found',
    })
  }

  return warnings
}

function calculateMetrics($: cheerio.CheerioAPI): QualityMetrics {
  const text = $.text()
  const charCount = text.length

  const sectionCount = $('section.ann, section.kapitel').length
  const paragraphCount = $('p.text').length
  const listItemCount = $('li').length
  const hasTransitionProvisions =
    $('footer.back, .in-force-info').length > 0 ||
    text.toLowerCase().includes('ikraftträdande')
  const footnoteCount = $('dl.footnote-content, .footnote').length

  // Estimate if output seems complete (heuristic)
  // Typical amendment has 500-10000 chars
  const outputRatio = charCount / 3000 // 3000 is median
  const appearsComplete =
    charCount > 200 &&
    sectionCount > 0 &&
    paragraphCount > 0

  return {
    charCount,
    sectionCount,
    paragraphCount,
    listItemCount,
    hasTransitionProvisions,
    footnoteCount,
    outputRatio,
    appearsComplete,
  }
}

function checkSuspiciousOutput(metrics: QualityMetrics): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Very short output
  if (metrics.charCount < 200) {
    warnings.push({
      code: 'VERY_SHORT',
      message: `Output is suspiciously short (${metrics.charCount} chars)`,
    })
  }

  // Very long output (may indicate duplication)
  if (metrics.charCount > 50000) {
    warnings.push({
      code: 'VERY_LONG',
      message: `Output is unusually long (${metrics.charCount} chars) - check for duplication`,
    })
  }

  // No sections
  if (metrics.sectionCount === 0) {
    warnings.push({
      code: 'NO_SECTIONS_METRIC',
      message: 'No sections extracted - manual review recommended',
    })
  }

  // Missing transition provisions (common in amendments)
  if (!metrics.hasTransitionProvisions) {
    warnings.push({
      code: 'NO_TRANSITIONS',
      message: 'No transition provisions found - may be incomplete',
    })
  }

  return warnings
}

// ============================================================================
// Post-Processing Fixes
// ============================================================================

function applyPostProcessingFixes($: cheerio.CheerioAPI): string {
  // Fix common LLM output issues

  // 1. Remove empty paragraphs
  $('p:empty').remove()

  // 2. Fix double-encoded entities
  $('*').each((_, el) => {
    const $el = $(el)
    const text = $el.html()
    if (text) {
      // Fix double-encoded ampersands
      $el.html(text.replace(/&amp;amp;/g, '&amp;'))
    }
  })

  // 3. Ensure IDs are valid (no spaces)
  $('[id]').each((_, el) => {
    const $el = $(el)
    const id = $el.attr('id')
    if (id && id.includes(' ')) {
      $el.attr('id', id.replace(/\s+/g, '_'))
    }
  })

  // 4. Normalize list styles
  $('ul.list').each((_, el) => {
    const $el = $(el)
    // For definition-style lists (term i X §), ensure no bullets
    const text = $el.text()
    if (text.includes(' i ') && text.includes(' §')) {
      $el.attr('style', 'list-style: none;')
    }
  })

  return $.html()
}

// ============================================================================
// Utility Functions
// ============================================================================

function createEmptyMetrics(): QualityMetrics {
  return {
    charCount: 0,
    sectionCount: 0,
    paragraphCount: 0,
    listItemCount: 0,
    hasTransitionProvisions: false,
    footnoteCount: 0,
    outputRatio: 0,
    appearsComplete: false,
  }
}

/**
 * Check if document needs manual review based on validation result
 */
export function needsManualReview(result: ValidationResult): boolean {
  // Critical errors always need review
  if (!result.valid) return true

  // Suspicious metrics
  if (!result.metrics.appearsComplete) return true
  if (result.metrics.charCount < 300) return true
  if (result.metrics.sectionCount === 0) return true

  // Many warnings
  if (result.warnings.length > 3) return true

  return false
}

/**
 * Get review priority (1 = highest, 3 = lowest)
 */
export function getReviewPriority(result: ValidationResult): 1 | 2 | 3 {
  if (!result.valid) return 1

  if (result.metrics.charCount < 200 || result.metrics.sectionCount === 0) {
    return 1
  }

  if (result.warnings.length > 2 || !result.metrics.appearsComplete) {
    return 2
  }

  return 3
}
