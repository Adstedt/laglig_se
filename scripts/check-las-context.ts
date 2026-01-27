/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function check() {
  const las = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1982:80' },
    select: { full_text: true },
  })

  if (las?.full_text) {
    // Hitta var "har upphävts genom" finns
    const text = las.full_text
    const index = text.toLowerCase().indexOf('har upphävts genom')

    if (index !== -1) {
      // Visa kontext runt frasen
      const start = Math.max(0, index - 100)
      const end = Math.min(text.length, index + 200)
      console.log('Kontext runt "har upphävts genom":')
      console.log('...' + text.substring(start, end) + '...')
    }

    // Kolla om det finns "Författningen har upphävts" (hela lagen upphävd)
    const hasForfattningen = text
      .toLowerCase()
      .includes('författningen har upphävts')
    console.log('\nInnehåller "Författningen har upphävts":', hasForfattningen)

    // Visa de första 300 tecknen för att se header-strukturen
    console.log('\n--- Header (första 400 tecken) ---')
    console.log(text.substring(0, 400))
  }
}

check().finally(() => prisma.$disconnect())
