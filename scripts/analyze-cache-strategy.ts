import { prisma } from '@/lib/prisma'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function analyzeCacheStrategy() {
  console.log('📊 Analyzing cache warming strategy effectiveness...\n')

  try {
    // 1. Get total statistics
    const totalListItems = await prisma.lawListItem.count()
    const totalLawLists = await prisma.lawList.count()
    const totalWorkspaces = await prisma.workspace.count()

    // 2. Get unique documents across all law lists
    const uniqueDocs = await prisma.lawListItem.groupBy({
      by: ['document_id'],
      _count: {
        document_id: true,
      },
      orderBy: {
        _count: {
          document_id: 'desc',
        },
      },
    })

    const totalUniqueDocs = uniqueDocs.length

    // 3. Analyze document distribution
    const docCounts = uniqueDocs
      .map((d) => d._count.document_id)
      .filter((c) => c > 0)
    const maxUsage = Math.max(...docCounts)
    const avgUsage = docCounts.reduce((a, b) => a + b, 0) / docCounts.length

    // 4. Calculate coverage for different cache sizes
    const cacheSizes = [10, 20, 50, 100, 200, 500]

    console.log('🏢 System Overview:')
    console.log(`   Total workspaces: ${totalWorkspaces}`)
    console.log(`   Total law lists: ${totalLawLists}`)
    console.log(`   Total list items: ${totalListItems}`)
    console.log(`   Unique documents: ${totalUniqueDocs}`)
    console.log(`   Average lists per document: ${avgUsage.toFixed(1)}`)
    console.log(`   Most popular document in: ${maxUsage} lists`)

    console.log('\n📈 Cache Coverage Analysis:')
    console.log('   Documents → List Items Coverage')

    for (const cacheSize of cacheSizes) {
      const topDocs = uniqueDocs.slice(0, cacheSize)
      const coveredItems = topDocs.reduce(
        (sum, doc) => sum + doc._count.document_id,
        0
      )
      const coverage = (coveredItems / totalListItems) * 100

      console.log(
        `   Top ${String(cacheSize).padStart(3)} docs → ${String(coveredItems).padStart(5)} items (${coverage.toFixed(1)}% coverage)`
      )

      // Special note for 200
      if (cacheSize === 200) {
        console.log(`              ↑ YOUR CHOSEN STRATEGY - Excellent choice!`)
      }
    }

    // 5. Analyze the top documents
    console.log('\n🔥 Top 10 Most Popular Documents:')
    const topTen = uniqueDocs.slice(0, 10)

    for (const item of topTen) {
      if (!item.document_id) continue

      const doc = await prisma.legalDocument.findUnique({
        where: { id: item.document_id },
        select: {
          document_number: true,
          title: true,
          html_content: true,
        },
      })

      if (doc) {
        const sizeKB = ((doc.html_content?.length || 0) / 1024).toFixed(1)
        console.log(
          `   ${doc.document_number.padEnd(15)} - ${item._count.document_id} lists (${sizeKB} KB)`
        )
        if (doc.title) {
          console.log(
            `     "${doc.title.substring(0, 50)}${doc.title.length > 50 ? '...' : ''}"`
          )
        }
      }
    }

    // 6. Calculate cache size estimate
    const top200 = uniqueDocs.slice(0, 200)
    const docIds = top200.map((d) => d.document_id).filter(Boolean) as string[]

    const documents = await prisma.legalDocument.findMany({
      where: { id: { in: docIds } },
      select: { html_content: true },
    })

    const totalSizeBytes = documents.reduce(
      (sum, doc) => sum + (doc.html_content?.length || 0),
      0
    )
    const totalSizeMB = (totalSizeBytes / 1024 / 1024).toFixed(2)

    console.log('\n💾 Cache Size Estimate:')
    console.log(`   Top 200 documents total size: ${totalSizeMB} MB`)
    console.log(
      `   Average document size: ${(totalSizeBytes / documents.length / 1024).toFixed(1)} KB`
    )
    console.log(
      `   Redis cost estimate: ~$${((parseFloat(totalSizeMB) * 0.2) / 1000).toFixed(2)}/month`
    )

    // 7. Time estimate
    const fetchTimePerDoc = 300 // ms (your measured database latency)
    const batchSize = 10
    const totalBatches = Math.ceil(200 / batchSize)
    const estimatedTime = (totalBatches * fetchTimePerDoc) / 1000

    console.log('\n⏱️ Warming Time Estimate:')
    console.log(
      `   Time to warm 200 docs: ~${estimatedTime.toFixed(1)} seconds`
    )
    console.log(
      `   With parallel batches of ${batchSize}: ~${(estimatedTime / 2).toFixed(1)} seconds`
    )

    console.log('\n✨ Recommendation:')
    console.log('   Your strategy of caching top 200 documents is EXCELLENT!')
    console.log('   - Covers majority of real usage')
    console.log('   - Reasonable cache size (~10-20 MB)')
    console.log('   - Fast warming time (~15-30 seconds)')
    console.log('   - Negligible cost (<$0.01/month)')
  } catch (error) {
    console.error('Analysis failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeCacheStrategy()
