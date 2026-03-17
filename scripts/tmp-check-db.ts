import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:1461' },
    select: { html_content: true },
  })
  if (!doc?.html_content) {
    console.log('NOT FOUND')
    return
  }

  const html = doc.html_content
  console.log('Length:', html.length)
  console.log('First 150:', html.substring(0, 150))
  console.log('---')
  console.log('Last 150:', html.substring(html.length - 150))
  console.log('---')
  console.log('Starts with backtick fence:', html.startsWith('```'))
  console.log('Contains backtick fence:', html.includes('```'))

  const lastArticle = html.lastIndexOf('</article>')
  console.log('Has closing </article>:', lastArticle > 0)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
