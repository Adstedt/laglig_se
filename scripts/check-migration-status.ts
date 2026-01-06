import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const amendmentDocs = await prisma.amendmentDocument.count()
  
  const legalDocsAmendments = await prisma.legalDocument.count({ 
    where: { content_type: 'SFS_AMENDMENT' } 
  })
  const withHtml = await prisma.legalDocument.count({ 
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: '' } } 
  })
  
  console.log('=== Migration Status ===')
  console.log('AmendmentDocument total:', amendmentDocs)
  console.log('')
  console.log('LegalDocument (SFS_AMENDMENT):', legalDocsAmendments)
  console.log('  - with html_content:', withHtml)
  console.log('  - without html_content (need LLM):', legalDocsAmendments - withHtml)
  console.log('')
  console.log('Missing from LegalDocument:', amendmentDocs - legalDocsAmendments)
}

main().catch(console.error).finally(() => prisma.$disconnect())
