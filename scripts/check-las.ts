/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function check() {
  // Kolla SFS 1982:80
  const las = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1982:80' },
    select: {
      title: true,
      document_number: true,
      status: true,
      full_text: true
    }
  })

  if (las) {
    console.log('Dokument:', las.document_number, las.title)
    console.log('Status:', las.status)
    console.log('')
    console.log('Första 1000 tecken av full_text:')
    console.log(las.full_text?.substring(0, 1000))

    // Kolla om texten innehåller "har upphävts"
    const hasUpphavts = las.full_text?.toLowerCase().includes('har upphävts genom')
    console.log('\nInnehåller "har upphävts genom":', hasUpphavts)
  } else {
    console.log('Hittade inte SFS 1982:80')
  }
}

check().finally(() => prisma.$disconnect())
