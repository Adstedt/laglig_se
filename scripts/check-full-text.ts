import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:57' },
    select: {
      full_text: true,
      html_content: true,
    }
  })

  console.log('=== full_text length:', doc?.full_text?.length || 0)
  console.log('=== html_content length:', doc?.html_content?.length || 0)

  console.log('\n=== FULL TEXT (first 2000 chars) ===')
  console.log(doc?.full_text?.substring(0, 2000))

  console.log('\n=== FULL TEXT (last 1000 chars) ===')
  console.log(doc?.full_text?.substring(-1000))

  // Check if Samhällsintroduktion is in full_text
  console.log('\n=== Content checks in full_text ===')
  console.log('Has Samhällsintroduktion:', doc?.full_text?.includes('Samhällsintroduktion'))
  console.log('Has Ikraftträdande:', doc?.full_text?.includes('Ikraftträdande'))

  await prisma.$disconnect()
}
main()
