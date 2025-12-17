import { prisma } from '../lib/prisma'

async function main() {
  // Get counts by content type
  const counts = await prisma.legalDocument.groupBy({
    by: ['content_type'],
    _count: { id: true },
  })

  console.log('Document counts by type:')
  let total = 0
  for (const c of counts) {
    console.log(`  ${c.content_type}: ${c._count.id.toLocaleString()}`)
    total += c._count.id
  }
  console.log(`  TOTAL: ${total.toLocaleString()}\n`)

  // Sample average content length from different types
  const sampleSFS = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: { full_text: true, html_content: true },
    take: 50,
  })

  const sampleCourt = await prisma.legalDocument.findMany({
    where: {
      content_type: {
        in: ['COURT_CASE_HD', 'COURT_CASE_AD', 'COURT_CASE_HFD'],
      },
    },
    select: { full_text: true, html_content: true },
    take: 50,
  })

  const samples = [...sampleSFS, ...sampleCourt]

  // Estimate tokens (rough: 1 token ≈ 4 chars for Swedish)
  let totalChars = 0
  let docsWithContent = 0
  let maxChars = 0
  let minChars = Infinity

  for (const s of samples) {
    const content = s.full_text || s.html_content || ''
    if (content.length > 0) {
      totalChars += content.length
      docsWithContent++
      maxChars = Math.max(maxChars, content.length)
      minChars = Math.min(minChars, content.length)
    }
  }

  const avgChars = docsWithContent > 0 ? totalChars / docsWithContent : 0
  const avgTokens = Math.ceil(avgChars / 4)

  console.log(`Sample analysis (${samples.length} docs):`)
  console.log(`  Docs with content: ${docsWithContent}`)
  console.log(`  Min chars: ${minChars.toLocaleString()}`)
  console.log(`  Max chars: ${maxChars.toLocaleString()}`)
  console.log(`  Avg chars per doc: ${Math.round(avgChars).toLocaleString()}`)
  console.log(`  Avg tokens per doc (est): ${avgTokens.toLocaleString()}\n`)

  // Calculate costs
  console.log('--- COST ESTIMATES ---\n')

  const totalTokensInput = total * avgTokens
  const outputTokensPerDoc = 300 // Estimated JSON response with references
  const totalTokensOutput = total * outputTokensPerDoc

  // Haiku pricing (Dec 2024): $0.80/1M input, $4/1M output
  const haikuInputCost = (totalTokensInput / 1_000_000) * 0.8
  const haikuOutputCost = (totalTokensOutput / 1_000_000) * 4
  const haikuTotal = haikuInputCost + haikuOutputCost

  // Sonnet pricing: $3/1M input, $15/1M output
  const sonnetInputCost = (totalTokensInput / 1_000_000) * 3
  const sonnetOutputCost = (totalTokensOutput / 1_000_000) * 15
  const sonnetTotal = sonnetInputCost + sonnetOutputCost

  console.log(`Total documents: ${total.toLocaleString()}`)
  console.log(
    `Estimated total input tokens: ${totalTokensInput.toLocaleString()}`
  )
  console.log(
    `Estimated total output tokens: ${totalTokensOutput.toLocaleString()}\n`
  )

  console.log('Claude 3.5 Haiku ($0.80/1M in, $4/1M out):')
  console.log(`  Input:  $${haikuInputCost.toFixed(2)}`)
  console.log(`  Output: $${haikuOutputCost.toFixed(2)}`)
  console.log(`  TOTAL:  $${haikuTotal.toFixed(2)}\n`)

  console.log('Claude Sonnet 4 ($3/1M in, $15/1M out):')
  console.log(`  Input:  $${sonnetInputCost.toFixed(2)}`)
  console.log(`  Output: $${sonnetOutputCost.toFixed(2)}`)
  console.log(`  TOTAL:  $${sonnetTotal.toFixed(2)}\n`)

  // Time estimate
  const docsPerMinute = 30 // Conservative with rate limits
  const totalMinutes = total / docsPerMinute
  const totalHours = totalMinutes / 60

  console.log('--- TIME ESTIMATES ---\n')
  console.log(`At ~${docsPerMinute} docs/min (with rate limits):`)
  console.log(`  Total time: ${totalHours.toFixed(1)} hours`)
  console.log(
    `  With parallelization (5x): ${(totalHours / 5).toFixed(1)} hours\n`
  )

  console.log('--- RECOMMENDATION ---\n')
  console.log('Option A: Regex-only (free, instant)')
  console.log('Option B: Haiku for extraction')
  console.log(`  Cost: ~$${(haikuTotal * 1.2).toFixed(2)} (with 20% buffer)`)
  console.log('Option C: Sonnet for complex references')
  console.log(`  Cost: ~$${(sonnetTotal * 1.2).toFixed(2)} (with 20% buffer)`)
}

main().finally(() => prisma.$disconnect())
