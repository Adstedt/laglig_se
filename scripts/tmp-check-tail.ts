import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const doc = await p.legalDocument.findFirst({
    where: { document_number: { contains: '2025:1535' } },
    select: { html_content: true },
  })
  const html = doc?.html_content || ''
  console.log('=== LAST 2000 CHARS ===')
  console.log(html.substring(html.length - 2000))
}
main().finally(() => p.$disconnect())
