import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findUnique({
    where: { document_number: 'SFS 1977:1160' },
    select: { json_content: true },
  })
  const json = doc?.json_content as any
  if (!json) {
    console.log('No json_content')
    return
  }

  // Show structure overview
  console.log('Top-level keys:', Object.keys(json))
  console.log('Title:', json.title)
  console.log('Sections count:', json.sections?.length)
  console.log()

  // Show first 3 sections in detail
  for (const s of (json.sections || []).slice(0, 5)) {
    console.log(JSON.stringify(s, null, 2).substring(0, 500))
    console.log('---')
  }

  // Show a mid-document section
  const mid = json.sections?.[Math.floor(json.sections.length / 2)]
  if (mid) {
    console.log('\n=== MID-DOCUMENT SECTION ===')
    console.log(JSON.stringify(mid, null, 2).substring(0, 500))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
