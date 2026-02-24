/**
 * LLM-Assisted Amendment Document Parser (PDF-direct pipeline)
 *
 * Story 2.13: Uses Claude to accurately parse complex Swedish amendment documents.
 * Story 8.20: Removed legacy text-based pipeline (parseAmendmentWithLLM, parseAmendmentsBatch).
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  AMENDMENT_PDF_SYSTEM_PROMPT,
  getAmendmentPdfUserPrompt,
} from '@/lib/sfs/amendment-llm-prompt'
import {
  validateLlmOutput,
  type ValidationResult,
} from '@/lib/sfs/llm-output-validator'

// ============================================================================
// PDF-direct pipeline (sends PDF buffer to Claude, returns semantic HTML)
// ============================================================================

export interface LLMParserOptions {
  apiKey?: string
  model?: string
  maxRetries?: number
}

/**
 * Parse an amendment PDF directly using Claude Vision.
 * Sends the PDF as a document content block, uses the proven HTML prompt,
 * and validates output with the HTML validator.
 */
export async function parseAmendmentPdf(
  pdfBuffer: Buffer,
  sfsNumber: string,
  baseLawSfs?: string,
  title?: string,
  options: LLMParserOptions = {}
): Promise<{ html: string; validation: ValidationResult }> {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Provide via options or environment variable.'
    )
  }

  const client = new Anthropic({ apiKey })
  const model = options.model || 'claude-sonnet-4-20250514'
  const maxRetries = options.maxRetries || 3

  const pdfBase64 = pdfBuffer.toString('base64')

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 16384,
        system: AMENDMENT_PDF_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: getAmendmentPdfUserPrompt(sfsNumber, baseLawSfs, title),
              },
            ],
          },
        ],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from LLM')
      }

      const rawHtml = textBlock.text
      const validation = validateLlmOutput(rawHtml, sfsNumber)

      if (!validation.valid) {
        throw new Error(
          `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
        )
      }

      return { html: validation.cleanedHtml!, validation }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        )
      }
    }
  }

  throw new Error(
    `Failed to parse amendment PDF after ${maxRetries} attempts: ${lastError?.message}`
  )
}
