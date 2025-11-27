/* eslint-disable no-console */
/**
 * GPT-4 Amendment Summary Testing Script (Phase 1 & 2)
 *
 * Tests GPT-4 summary generation on 5-10 sample amendments before
 * spending $238 on full generation.
 *
 * Usage:
 *   pnpm tsx scripts/test-amendment-summaries.ts
 *
 * Phase 1: Test with 5-10 diverse samples, output for manual review
 * Phase 2: Iterate on prompt based on results, re-test
 *
 * DO NOT proceed to Phase 3 (full generation) until prompt is finalized
 * and user approves quality.
 */

import { prisma } from '../lib/prisma'
import OpenAI from 'openai'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Number of test samples
  TEST_SAMPLE_SIZE: 10,

  // OpenAI model
  MODEL: 'gpt-4',

  // Temperature (0.5-0.8 range for balance between factual and conversational)
  TEMPERATURE: 0.7,

  // Max tokens per summary (2-3 sentences in Swedish)
  MAX_TOKENS: 150,
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================================================
// Prompt Template (ADJUSTABLE)
// ============================================================================

/**
 * IMPORTANT: This prompt is the core of the summary generation.
 * Adjust this based on Phase 1 test results.
 *
 * Current version: v1 (initial)
 *
 * Adjustments to consider:
 * - Add "Använd vardagligt språk" if too technical
 * - Add "Förklara vad förändringen betyder i praktiken" if too abstract
 * - Adjust temperature if tone needs tuning
 * - Adjust max_tokens if length is wrong
 */
function getPrompt(
  baseLawTitle: string,
  amendingLawTitle: string,
  affectedSections: unknown
): string {
  return `Sammanfatta denna lagändring på svenska i 2-3 meningar för icke-jurister:

Grundlag: ${baseLawTitle}
Ändrande lag: ${amendingLawTitle}
Berörda paragrafer: ${affectedSections ? JSON.stringify(affectedSections) : 'Ej tillgängligt'}

Använd vardagligt språk och förklara vad förändringen betyder i praktiken.
Svara endast med sammanfattningen, inga förklaringar.`
}

// ============================================================================
// Main Function
// ============================================================================

async function testAmendmentSummaries() {
  try {
    console.log('='.repeat(80))
    console.log('GPT-4 Amendment Summary Testing (Phase 1)')
    console.log('='.repeat(80))
    console.log('')
    console.log(`Model: ${CONFIG.MODEL}`)
    console.log(`Temperature: ${CONFIG.TEMPERATURE}`)
    console.log(`Max tokens: ${CONFIG.MAX_TOKENS}`)
    console.log(`Test samples: ${CONFIG.TEST_SAMPLE_SIZE}`)
    console.log('')

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set in .env.local')
      process.exit(1)
    }

    // Fetch sample amendments
    console.log('📊 Fetching sample amendments...')
    const sampleAmendments = await fetchSampleAmendments(
      CONFIG.TEST_SAMPLE_SIZE
    )

    if (sampleAmendments.length === 0) {
      console.error('❌ No amendments found in database')
      console.error('   Run scripts/ingest-sfs-laws.ts first')
      process.exit(1)
    }

    console.log(`✅ Found ${sampleAmendments.length} sample amendments`)
    console.log('')

    // Generate summaries
    let totalCost = 0

    for (let i = 0; i < sampleAmendments.length; i++) {
      const amendment = sampleAmendments[i]
      if (!amendment) continue

      console.log('─'.repeat(80))
      console.log(`Amendment ${i + 1}/${sampleAmendments.length}`)
      console.log('─'.repeat(80))

      try {
        const result = await generateSummary(amendment)
        totalCost += result.cost

        printAmendmentResult(amendment, result)
      } catch (error) {
        console.error(
          `❌ Failed to generate summary:`,
          error instanceof Error ? error.message : error
        )
      }

      console.log('')
    }

    // Print final summary
    printFinalInstructions(totalCost)
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// Fetch Sample Amendments
// ============================================================================

async function fetchSampleAmendments(limit: number) {
  // Try to get diverse samples by selecting randomly across different base laws
  const amendments = await prisma.amendment.findMany({
    take: limit * 2, // Fetch more to allow filtering
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
    where: {
      // Only amendments without summaries
      summary: null,
    },
    orderBy: {
      created_at: 'desc',
    },
  })

  // Take up to limit, preferring variety
  const selected = amendments.slice(0, limit)

  return selected
}

// ============================================================================
// Generate Summary
// ============================================================================

interface SummaryResult {
  summary: string
  tokensUsed: number
  cost: number
  timeTaken: number
}

async function generateSummary(amendment: {
  id: string
  base_document: { title: string }
  amending_document: { title: string }
  affected_sections: unknown
}): Promise<SummaryResult> {
  const startTime = Date.now()

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

  const timeTaken = Date.now() - startTime

  return {
    summary,
    tokensUsed,
    cost,
    timeTaken,
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

function printAmendmentResult(
  amendment: {
    base_document: { title: string }
    amending_document: { title: string }
    affected_sections: unknown
  },
  result: SummaryResult
) {
  console.log(`📄 Base Law: ${amendment.base_document.title}`)
  console.log(`🔄 Amending Law: ${amendment.amending_document.title}`)
  console.log(
    `📋 Affected Sections: ${amendment.affected_sections ? JSON.stringify(amendment.affected_sections) : 'N/A'}`
  )
  console.log('')
  console.log(`📝 Generated Summary:`)
  console.log(`   "${result.summary}"`)
  console.log('')
  console.log(`⏱️  Time: ${result.timeTaken}ms`)
  console.log(`🪙 Tokens: ${result.tokensUsed}`)
  console.log(`💰 Cost: $${result.cost.toFixed(4)}`)
  console.log('')

  // Quality checks (manual review guidance)
  console.log(`✅ Quality Checks (manual review):`)
  console.log(`   [ ] Swedish language (no English words)?`)
  console.log(`   [ ] Plain language (not legal jargon)?`)
  console.log(`   [ ] 2-3 sentences (appropriate length)?`)
  console.log(`   [ ] Factual accuracy (matches amendment)?`)
  console.log(`   [ ] Comprehensible for non-lawyers?`)
}

function printFinalInstructions(totalCost: number) {
  console.log('='.repeat(80))
  console.log('Phase 1 Complete')
  console.log('='.repeat(80))
  console.log('')
  console.log(`💰 Total test cost: $${totalCost.toFixed(4)}`)
  console.log('')
  console.log('📋 Next Steps:')
  console.log('')
  console.log('1. Review all summaries above for quality')
  console.log('2. Check the quality checklist for each summary')
  console.log('3. If summaries need improvement:')
  console.log('   a. Edit the getPrompt() function in this script')
  console.log('   b. Adjust CONFIG.TEMPERATURE or CONFIG.MAX_TOKENS if needed')
  console.log(
    '   c. Re-run this script: pnpm tsx scripts/test-amendment-summaries.ts'
  )
  console.log('4. If summaries are good quality:')
  console.log('   a. Get user/stakeholder approval')
  console.log(
    '   b. Proceed to Phase 3: pnpm tsx scripts/generate-amendment-summaries.ts'
  )
  console.log('   c. ⚠️  WARNING: Phase 3 will cost ~$238 for full generation')
  console.log('')
  console.log(
    '⛔ DO NOT proceed to Phase 3 until you are satisfied with quality!'
  )
  console.log('')
}

// ============================================================================
// Execute
// ============================================================================

testAmendmentSummaries()
