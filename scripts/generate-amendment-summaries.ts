/* eslint-disable no-console */
/**
 * GPT-4 Amendment Summary Generation Script (Phase 3)
 *
 * Generates summaries for ALL amendments using the finalized prompt.
 *
 * ⚠️  WARNING: This will cost approximately $238
 * ⚠️  DO NOT run until test-amendment-summaries.ts shows good quality
 * ⚠️  DO NOT run without user approval
 *
 * Usage:
 *   pnpm tsx scripts/generate-amendment-summaries.ts
 *
 * Estimated time: ~45 minutes (90,000+ amendments)
 */

import { prisma } from '../lib/prisma'
import OpenAI from 'openai'
import { SummaryGeneratedBy } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // OpenAI model
  MODEL: 'gpt-4',

  // Temperature (MUST match test script after finalization)
  TEMPERATURE: 0.7,

  // Max tokens (MUST match test script after finalization)
  MAX_TOKENS: 150,

  // Progress logging interval
  PROGRESS_LOG_INTERVAL: 100,

  // Batch size (process in chunks to handle large dataset)
  BATCH_SIZE: 500,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================================================
// Prompt Template (FINALIZED FROM TESTING)
// ============================================================================

/**
 * This prompt MUST be the SAME as the finalized version from test script
 *
 * Copy the exact prompt from test-amendment-summaries.ts after testing
 */
function getPrompt(
  baseLawTitle: string,
  amendingLawTitle: string,
  affectedSections: object | null
): string {
  return `Sammanfatta denna lagändring på svenska i 2-3 meningar för icke-jurister:

Grundlag: ${baseLawTitle}
Ändrande lag: ${amendingLawTitle}
Berörda paragrafer: ${affectedSections ? JSON.stringify(affectedSections) : 'Ej tillgängligt'}

Använd vardagligt språk och förklara vad förändringen betyder i praktiken.
Svara endast med sammanfattningen, inga förklaringar.`
}

// ============================================================================
// Stats
// ============================================================================

interface GenerationStats {
  totalAmendments: number
  processed: number
  succeeded: number
  failed: number
  skipped: number
  totalTokens: number
  totalCost: number
  startTime: Date
}

// ============================================================================
// Main Function
// ============================================================================

async function generateAllSummaries() {
  const stats: GenerationStats = {
    totalAmendments: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalTokens: 0,
    totalCost: 0,
    startTime: new Date(),
  }

  try {
    console.log('='.repeat(80))
    console.log('GPT-4 Amendment Summary Generation (Phase 3)')
    console.log('='.repeat(80))
    console.log('')
    console.log('⚠️  WARNING: This will cost approximately $238')
    console.log('⚠️  Press Ctrl+C within 5 seconds to cancel')
    console.log('')

    // 5-second safety delay
    await sleep(5000)

    console.log(`Model: ${CONFIG.MODEL}`)
    console.log(`Temperature: ${CONFIG.TEMPERATURE}`)
    console.log(`Max tokens: ${CONFIG.MAX_TOKENS}`)
    console.log(`Started at: ${stats.startTime.toISOString()}`)
    console.log('')

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set in .env.local')
      process.exit(1)
    }

    // Count total amendments without summaries
    const totalCount = await prisma.amendment.count({
      where: {
        summary: null,
      },
    })

    stats.totalAmendments = totalCount

    console.log(`📊 Total amendments needing summaries: ${totalCount}`)
    console.log('')

    if (totalCount === 0) {
      console.log('✅ All amendments already have summaries!')
      return
    }

    // Process in batches
    let offset = 0

    while (offset < totalCount) {
      console.log(
        `\n📦 Processing batch: ${offset}-${offset + CONFIG.BATCH_SIZE}`
      )

      const batch = await prisma.amendment.findMany({
        where: {
          summary: null,
        },
        include: {
          base_document: {
            select: {
              title: true,
            },
          },
          amending_document: {
            select: {
              title: true,
            },
          },
        },
        take: CONFIG.BATCH_SIZE,
        skip: offset,
      })

      for (const amendment of batch) {
        try {
          await processAmendment(amendment, stats)

          // Progress logging
          if (stats.processed % CONFIG.PROGRESS_LOG_INTERVAL === 0) {
            printProgress(stats)
          }
        } catch (error) {
          stats.failed++
          console.error(
            `❌ Failed to process amendment ${amendment.id}:`,
            error instanceof Error ? error.message : error
          )
        }
      }

      offset += CONFIG.BATCH_SIZE
    }

    printFinalSummary(stats)
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// Process Amendment
// ============================================================================

async function processAmendment(
  amendment: {
    id: string
    base_document: { title: string }
    amending_document: { title: string }
    affected_sections: object | null
  },
  stats: GenerationStats
) {
  stats.processed++

  // Generate summary with retry logic
  let summary: string | null = null
  let tokensUsed = 0
  let cost = 0

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const result = await generateSummary(amendment)
      summary = result.summary
      tokensUsed = result.tokensUsed
      cost = result.cost
      break // Success
    } catch (error) {
      if (attempt === CONFIG.MAX_RETRIES) {
        console.error(
          `❌ Failed after ${CONFIG.MAX_RETRIES} attempts:`,
          error instanceof Error ? error.message : error
        )
        stats.failed++
        return
      }

      console.warn(`⚠️  Attempt ${attempt} failed, retrying...`)
      await sleep(CONFIG.RETRY_DELAY_MS * attempt) // Exponential backoff
    }
  }

  if (!summary) {
    stats.failed++
    return
  }

  // Update amendment record
  await prisma.amendment.update({
    where: { id: amendment.id },
    data: {
      summary,
      summary_generated_by: SummaryGeneratedBy.GPT_4,
    },
  })

  stats.succeeded++
  stats.totalTokens += tokensUsed
  stats.totalCost += cost
}

// ============================================================================
// Generate Summary
// ============================================================================

interface SummaryResult {
  summary: string
  tokensUsed: number
  cost: number
}

async function generateSummary(amendment: {
  base_document: { title: string }
  amending_document: { title: string }
  affected_sections: object | null
}): Promise<SummaryResult> {
  const prompt = getPrompt(
    amendment.base_document.title,
    amendment.amending_document.title,
    amendment.affected_sections
  )

  const response = await openai.chat.completions.create({
    model: CONFIG.MODEL,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: CONFIG.MAX_TOKENS,
    temperature: CONFIG.TEMPERATURE,
  })

  const summary = response.choices[0]?.message?.content || ''
  const tokensUsed = response.usage?.total_tokens || 0

  // Calculate cost (GPT-4 pricing: $0.03/1K input, $0.06/1K output)
  const inputTokens = response.usage?.prompt_tokens || 0
  const outputTokens = response.usage?.completion_tokens || 0
  const cost = (inputTokens / 1000) * 0.03 + (outputTokens / 1000) * 0.06

  return {
    summary,
    tokensUsed,
    cost,
  }
}

// ============================================================================
// Progress & Reporting
// ============================================================================

function printProgress(stats: GenerationStats) {
  const percent = Math.round((stats.processed / stats.totalAmendments) * 100)
  const elapsed = Date.now() - stats.startTime.getTime()
  const avgTimePerAmendment = elapsed / stats.processed
  const remaining =
    (stats.totalAmendments - stats.processed) * avgTimePerAmendment
  const eta = new Date(Date.now() + remaining)

  console.log(
    `📈 Progress: ${stats.processed}/${stats.totalAmendments} (${percent}%) | ` +
      `✅ ${stats.succeeded} | ❌ ${stats.failed} | ` +
      `💰 $${stats.totalCost.toFixed(2)} | ` +
      `ETA: ${eta.toLocaleTimeString()}`
  )
}

function printFinalSummary(stats: GenerationStats) {
  const endTime = new Date()
  const duration = endTime.getTime() - stats.startTime.getTime()
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))

  console.log('\n' + '='.repeat(80))
  console.log('✅ SUMMARY GENERATION COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log(`📊 Total processed:     ${stats.processed}`)
  console.log(`✅ Succeeded:          ${stats.succeeded}`)
  console.log(
    `❌ Failed:             ${stats.failed} (${((stats.failed / stats.processed) * 100).toFixed(2)}%)`
  )
  console.log(`🪙 Total tokens used:  ${stats.totalTokens.toLocaleString()}`)
  console.log(`💰 Total cost:         $${stats.totalCost.toFixed(2)}`)
  console.log('')
  console.log(`⏱️  Duration: ${hours}h ${minutes}m`)
  console.log('')

  if (stats.failed > 0) {
    console.warn(`⚠️  ${stats.failed} summaries failed to generate`)
    console.warn(`   These amendments have summary = NULL (can retry later)`)
  }

  console.log('Next steps:')
  console.log('1. Verify summaries: pnpm tsx scripts/test-db-connection.ts')
  console.log(
    '2. Run integration tests: pnpm test tests/integration/ingestion/'
  )
  console.log('')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Execute
// ============================================================================

generateAllSummaries()
