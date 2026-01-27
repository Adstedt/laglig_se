import { getMostPopularDocuments } from '@/app/actions/track-visit'
import { isRedisConfigured } from '@/lib/cache/redis'
import { prisma } from '@/lib/prisma'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testCacheWarming() {
  console.log('🧪 Testing Cache Warming Strategy...\n')

  // 1. Check Redis
  console.log('1️⃣ Redis Status:')
  console.log(`   Configured: ${isRedisConfigured() ? '✅' : '❌'}`)

  // 2. Check document visits table
  console.log('\n2️⃣ Document Visits Table:')
  try {
    const visitCount = await prisma.documentVisit.count()
    console.log(`   ✅ Table exists with ${visitCount} records`)

    if (visitCount > 0) {
      const topVisited = await prisma.documentVisit.findMany({
        take: 5,
        orderBy: { visit_count: 'desc' },
        include: {
          document: { select: { document_number: true, title: true } },
        },
      })

      console.log('\n   Top visited documents:')
      topVisited.forEach((v) => {
        console.log(
          `   - ${v.document.document_number}: ${v.visit_count} visits`
        )
      })
    }
  } catch (error) {
    console.log('   ❌ Error accessing document_visits:', error)
  }

  // 3. Test combined scoring
  console.log('\n3️⃣ Combined Cache Warming Strategy:')
  try {
    const popularDocs = await getMostPopularDocuments(20)

    const sources = {
      both: popularDocs.filter((d) => d.source === 'both').length,
      law_lists: popularDocs.filter((d) => d.source === 'law_lists').length,
      public_visits: popularDocs.filter((d) => d.source === 'public_visits')
        .length,
    }

    console.log(`   Total documents for warming: ${popularDocs.length}`)
    console.log(`   🏆 In BOTH sources: ${sources.both}`)
    console.log(`   📋 Law lists only: ${sources.law_lists}`)
    console.log(`   🌐 Public visits only: ${sources.public_visits}`)

    // Show top 5
    console.log('\n   Top 5 documents by combined score:')
    for (const doc of popularDocs.slice(0, 5)) {
      const document = await prisma.legalDocument.findUnique({
        where: { id: doc.document_id },
        select: { document_number: true },
      })

      const icon =
        doc.source === 'both' ? '🏆' : doc.source === 'law_lists' ? '📋' : '🌐'
      console.log(
        `   ${icon} ${document?.document_number || 'Unknown'} (score: ${doc.score})`
      )
    }
  } catch (error) {
    console.log('   ❌ Error:', error)
  }

  // 4. Test cache warming endpoint
  console.log('\n4️⃣ Testing Cache Warming Endpoint:')
  console.log('   Run manually: curl http://localhost:3000/api/cron/warm-cache')
  console.log('   Or in production: Add CRON_SECRET and use Vercel crons')

  console.log('\n✅ Cache warming strategy is ready to use!')
  console.log('\nTo enable automatic warming on dev server start:')
  console.log('   echo "ENABLE_CACHE_WARMING=true" >> .env.local')
}

testCacheWarming().then(() => process.exit(0))
