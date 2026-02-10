/* eslint-disable no-console */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// All 81 SFS document numbers from data/seed-template-documents.csv
const SEED_SFS = [
  // Shared (both templates)
  'SFS 2003:778',
  'SFS 2003:789',
  'SFS 2006:263',
  'SFS 2006:311',
  'SFS 2007:19',
  'SFS 2010:1011',
  'SFS 2010:1075',
  'SFS 2018:396',
  'SFS 2018:506',
  // Arbetsmiljö only
  'SFS 1974:358',
  'SFS 1974:981',
  'SFS 1976:580',
  'SFS 1977:284',
  'SFS 1977:480',
  'SFS 1977:1160',
  'SFS 1977:1166',
  'SFS 1982:80',
  'SFS 1982:673',
  'SFS 1986:163',
  'SFS 1988:1465',
  'SFS 1991:1046',
  'SFS 1991:1047',
  'SFS 1994:1297',
  'SFS 1995:584',
  'SFS 1998:209',
  'SFS 1999:678',
  'SFS 2002:293',
  'SFS 2004:865',
  'SFS 2005:395',
  'SFS 2008:565',
  'SFS 2008:567',
  'SFS 2012:854',
  'SFS 2016:732',
  'SFS 2017:218',
  'SFS 2017:319',
  'SFS 2018:218',
  'SFS 2018:2088',
  'SFS 2021:890',
  'SFS 2022:469',
  // Miljö only
  'SFS 1995:1554',
  'SFS 1998:808',
  'SFS 1998:899',
  'SFS 1998:901',
  'SFS 1998:940',
  'SFS 1998:944',
  'SFS 1999:381',
  'SFS 2001:512',
  'SFS 2006:985',
  'SFS 2006:1592',
  'SFS 2007:667',
  'SFS 2008:112',
  'SFS 2008:245',
  'SFS 2008:486',
  'SFS 2008:834',
  'SFS 2010:900',
  'SFS 2011:318',
  'SFS 2011:338',
  'SFS 2012:259',
  'SFS 2012:861',
  'SFS 2013:250',
  'SFS 2013:251',
  'SFS 2013:254',
  'SFS 2014:266',
  'SFS 2014:347',
  'SFS 2014:425',
  'SFS 2015:236',
  'SFS 2016:402',
  'SFS 2016:986',
  'SFS 2016:1067',
  'SFS 2016:1128',
  'SFS 2016:1129',
  'SFS 2017:214',
  'SFS 2017:966',
  'SFS 2018:471',
  'SFS 2020:614',
  'SFS 2021:787',
  'SFS 2021:789',
  'SFS 2021:996',
  'SFS 2021:1002',
  'SFS 2022:1274',
  'SFS 2022:1276',
]

async function main() {
  // Total DB stats
  const totalDocs = await prisma.legalDocument.count()
  const sfsLaws = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  const sfsAmendments = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })

  console.log('=== DATABASE OVERVIEW ===')
  console.log(`Total legal_documents: ${totalDocs}`)
  console.log(`  SFS_LAW: ${sfsLaws}`)
  console.log(`  SFS_AMENDMENT: ${sfsAmendments}`)
  console.log()

  // Check each seed SFS
  const found: string[] = []
  const missing: string[] = []

  for (const sfsNum of SEED_SFS) {
    const doc = await prisma.legalDocument.findUnique({
      where: { document_number: sfsNum },
      select: {
        id: true,
        document_number: true,
        title: true,
        content_type: true,
        full_text: true,
        html_content: true,
      },
    })

    if (doc) {
      const hasText = (doc.full_text?.length ?? 0) > 0
      const hasHtml = (doc.html_content?.length ?? 0) > 0
      found.push(
        `  ✅ ${sfsNum} — ${doc.title?.substring(0, 60)} [text:${hasText} html:${hasHtml}]`
      )
    } else {
      missing.push(`  ❌ ${sfsNum}`)
    }
  }

  console.log(`=== SEED SFS COVERAGE: ${found.length}/${SEED_SFS.length} ===`)
  console.log()
  console.log(`FOUND (${found.length}):`)
  found.forEach((f) => console.log(f))
  console.log()
  console.log(`MISSING (${missing.length}):`)
  missing.forEach((m) => console.log(m))

  // Year distribution of missing
  const missingYears: Record<string, number> = {}
  missing.forEach((m) => {
    const match = m.match(/SFS (\d{4})/)
    if (match) {
      const year = match[1]
      missingYears[year] = (missingYears[year] || 0) + 1
    }
  })
  console.log()
  console.log('Missing by year:')
  Object.entries(missingYears)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([year, count]) => console.log(`  ${year}: ${count}`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
