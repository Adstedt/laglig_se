/**
 * AI Summary Queue
 *
 * Queues and processes AI-generated summaries for change events and amendments.
 * Uses GPT-4 to generate plain-language summaries of law changes.
 *
 * Story 2.11 - Task 7: Add AI Summary Queue
 *
 * Cost estimate: ~$0.42/month for ~10 amendments/day
 * - Input: ~500 tokens (diff + context)
 * - Output: ~100 tokens (2-3 sentences)
 * - $0.01/1K input + $0.03/1K output = ~$0.0065 per summary
 * - 10 changes/day * 30 days * $0.0065 = ~$1.95/month (conservative)
 */

import type { Prisma, ChangeEvent, Amendment } from '@prisma/client'
import { ChangeType } from '@prisma/client'

// Transaction client type for Prisma interactive transactions
type TransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ============================================================================
// Types
// ============================================================================

export interface SummaryGenerationResult {
  success: boolean
  summary?: string
  error?: string
  tokensUsed?: number
}

// ============================================================================
// Queue Functions
// ============================================================================

/**
 * Get pending changes that need AI summarization
 *
 * @param tx Prisma transaction client
 * @param limit Maximum number to process (rate limiting)
 * @returns Array of ChangeEvents needing summaries
 */
export async function getPendingChangeSummaries(
  tx: TransactionClient,
  limit: number = 10
): Promise<ChangeEvent[]> {
  return tx.changeEvent.findMany({
    where: {
      ai_summary: null,
      change_type: {
        in: [ChangeType.AMENDMENT, ChangeType.REPEAL],
      },
    },
    orderBy: { detected_at: 'asc' }, // Process oldest first
    take: limit,
  })
}

/**
 * Get pending amendments that need AI summarization
 *
 * @param tx Prisma transaction client
 * @param limit Maximum number to process
 * @returns Array of Amendments needing summaries
 */
export async function getPendingAmendmentSummaries(
  tx: TransactionClient,
  limit: number = 10
): Promise<Amendment[]> {
  return tx.amendment.findMany({
    where: { summary: null },
    orderBy: { created_at: 'asc' },
    take: limit,
    include: {
      base_document: {
        select: { title: true, document_number: true },
      },
    },
  })
}

/**
 * Mark a change event summary as generated
 *
 * @param tx Prisma transaction client
 * @param changeEventId The change event ID
 * @param summary The generated summary
 */
export async function saveChangeSummary(
  tx: TransactionClient,
  changeEventId: string,
  summary: string
): Promise<void> {
  await tx.changeEvent.update({
    where: { id: changeEventId },
    data: {
      ai_summary: summary,
      ai_summary_generated_at: new Date(),
    },
  })
}

/**
 * Mark an amendment summary as generated
 *
 * @param tx Prisma transaction client
 * @param amendmentId The amendment ID
 * @param summary The generated summary
 */
export async function saveAmendmentSummary(
  tx: TransactionClient,
  amendmentId: string,
  summary: string
): Promise<void> {
  await tx.amendment.update({
    where: { id: amendmentId },
    data: {
      summary,
      summary_generated_by: 'GPT_4',
    },
  })
}

/**
 * Count pending summaries across all types
 *
 * @param tx Prisma transaction client
 * @returns Counts of pending summaries
 */
export async function countPendingSummaries(
  tx: TransactionClient
): Promise<{ changeEvents: number; amendments: number }> {
  const [changeEvents, amendments] = await Promise.all([
    tx.changeEvent.count({
      where: {
        ai_summary: null,
        change_type: { in: [ChangeType.AMENDMENT, ChangeType.REPEAL] },
      },
    }),
    tx.amendment.count({
      where: { summary: null },
    }),
  ])

  return { changeEvents, amendments }
}

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Generate a prompt for summarizing a law amendment
 */
export function generateAmendmentSummaryPrompt(params: {
  lawTitle: string
  lawNumber: string
  amendmentSfs: string
  affectedSections: string[]
  diffSummary?: string
}): string {
  const { lawTitle, lawNumber, amendmentSfs, affectedSections, diffSummary } =
    params

  return `Du är en svensk juridisk expert. Skriv en kort sammanfattning (2-3 meningar) på svenska som förklarar vad denna lagändring innebär för vanliga människor.

Lag: ${lawTitle} (${lawNumber})
Ändring: ${amendmentSfs}
Berörda paragrafer: ${affectedSections.length > 0 ? affectedSections.join(', ') : 'Ej specificerat'}
${diffSummary ? `Ändringar: ${diffSummary}` : ''}

Skriv en enkel, begriplig sammanfattning utan juridisk jargong. Fokusera på vad ändringen betyder i praktiken.`
}

/**
 * Generate a prompt for summarizing a law repeal
 */
export function generateRepealSummaryPrompt(params: {
  lawTitle: string
  lawNumber: string
  repealedBySfs?: string
}): string {
  const { lawTitle, lawNumber, repealedBySfs } = params

  return `Du är en svensk juridisk expert. Skriv en kort sammanfattning (2-3 meningar) på svenska som förklarar vad det innebär att denna lag har upphävts.

Upphävd lag: ${lawTitle} (${lawNumber})
${repealedBySfs ? `Upphävdes genom: ${repealedBySfs}` : ''}

Skriv en enkel, begriplig sammanfattning utan juridisk jargong. Förklara vad som händer med lagens bestämmelser nu.`
}

// ============================================================================
// Processing Functions (to be implemented with OpenAI client)
// ============================================================================

/**
 * Process a batch of pending summaries
 *
 * This is a placeholder for the actual AI integration.
 * Should be called from a Vercel cron job or background function.
 *
 * @param limit Maximum number of summaries to process per call
 * @returns Number of summaries generated
 */
export async function processPendingSummaries(
  limit: number = 5
): Promise<number> {
  // Note: Actual implementation requires OpenAI client
  // This will be called from api/cron/generate-summaries route

  // Placeholder - actual implementation would:
  // 1. Fetch pending items from getPendingChangeSummaries + getPendingAmendmentSummaries
  // 2. Generate prompts using the template functions
  // 3. Call OpenAI API with rate limiting
  // 4. Save results using saveChangeSummary + saveAmendmentSummary
  // 5. Handle errors and retries

  console.log(
    `[AI Summary Queue] Would process up to ${limit} pending summaries`
  )
  return 0
}
