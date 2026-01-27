#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function checkLatest() {
  // Get latest from API
  const apiUrl = new URL('https://data.riksdagen.se/dokumentlista/')
  apiUrl.searchParams.set('doktyp', 'sfs')
  apiUrl.searchParams.set('utformat', 'json')
  apiUrl.searchParams.set('sz', '1')
  apiUrl.searchParams.set('sort', 'publicerad')
  apiUrl.searchParams.set('sortorder', 'desc')

  const response = await fetch(apiUrl.toString())
  const data = await response.json()
  const latestApi = data.dokumentlista.dokument[0]

  console.log('📡 LATEST IN RIKSDAGEN API:')
  console.log(`   SFS: ${latestApi.beteckning}`)
  console.log(`   Title: ${latestApi.titel}`)
  console.log(`   Published: ${latestApi.publicerad}`)
  console.log(`   Date: ${latestApi.datum}`)
  console.log(`   Systemdatum: ${latestApi.systemdatum}`)

  // Get latest from our DB
  const { prisma } = await import('@/lib/prisma')

  // Get latest by document_number (SFS number)
  const latestByNumber = await prisma.legalDocument.findFirst({
    where: { content_type: 'SFS_LAW' },
    orderBy: { document_number: 'desc' },
    select: {
      document_number: true,
      title: true,
      publication_date: true,
      created_at: true,
      updated_at: true,
      metadata: true,
    },
  })

  console.log('\n💾 LATEST IN OUR DATABASE (by SFS number):')
  console.log(`   SFS: ${latestByNumber?.document_number}`)
  console.log(`   Title: ${latestByNumber?.title?.substring(0, 80)}...`)
  console.log(`   Publication date: ${latestByNumber?.publication_date}`)
  console.log(`   Added to DB: ${latestByNumber?.created_at}`)

  // Get latest by created_at (most recently added)
  const latestByAdded = await prisma.legalDocument.findFirst({
    where: { content_type: 'SFS_LAW' },
    orderBy: { created_at: 'desc' },
    select: {
      document_number: true,
      title: true,
      created_at: true,
    },
  })

  console.log('\n🕐 MOST RECENTLY ADDED TO DB:')
  console.log(`   SFS: ${latestByAdded?.document_number}`)
  console.log(`   Title: ${latestByAdded?.title?.substring(0, 80)}...`)
  console.log(`   Added: ${latestByAdded?.created_at}`)

  // Check if API latest exists in DB
  const apiSfsNumber = `SFS ${latestApi.beteckning}`
  const exists = await prisma.legalDocument.findUnique({
    where: { document_number: apiSfsNumber },
    select: { id: true, created_at: true },
  })

  console.log(
    `\n✅ Is API latest (${apiSfsNumber}) in our DB? ${exists ? 'YES (added ' + exists.created_at + ')' : 'NO - MISSING!'}`
  )

  process.exit(0)
}

checkLatest().catch(console.error)
