#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function check2025Docs() {
  const { prisma } = await import('@/lib/prisma')
  
  // Get latest 2025 documents
  const latest2025 = await prisma.legalDocument.findMany({
    where: { 
      content_type: 'SFS_LAW',
      document_number: {
        startsWith: 'SFS 2025:'
      }
    },
    orderBy: { document_number: 'desc' },
    take: 5,
    select: {
      document_number: true,
      title: true,
      created_at: true,
    }
  })
  
  console.log('📋 Latest 2025 SFS documents in our DB:')
  latest2025.forEach(doc => {
    console.log(`   ${doc.document_number} - ${doc.title?.substring(0, 60)}...`)
    console.log(`      Added: ${doc.created_at}`)
  })
  
  // Count total 2025 docs
  const count2025 = await prisma.legalDocument.count({
    where: { 
      content_type: 'SFS_LAW',
      document_number: {
        startsWith: 'SFS 2025:'
      }
    }
  })
  
  console.log(`\n📊 Total 2025 documents: ${count2025}`)
  
  // Check API for how many 2025 docs exist
  const apiUrl = new URL('https://data.riksdagen.se/dokumentlista/')
  apiUrl.searchParams.set('doktyp', 'sfs')
  apiUrl.searchParams.set('utformat', 'json')
  apiUrl.searchParams.set('sz', '1')
  apiUrl.searchParams.set('from', '2025-01-01')
  apiUrl.searchParams.set('to', '2025-12-31')
  
  const response = await fetch(apiUrl.toString())
  const data = await response.json()
  const apiCount = parseInt(data.dokumentlista['@traffar'], 10) || 0
  
  console.log(`📡 Total 2025 documents in API: ${apiCount}`)
  console.log(`📈 Coverage: ${count2025}/${apiCount} = ${((count2025/apiCount)*100).toFixed(1)}%`)
  
  process.exit(0)
}

check2025Docs().catch(console.error)