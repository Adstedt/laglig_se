import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get a doc with footnotes
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1998:1003' },
    select: { html_content: true, json_content: true }
  })

  if (!doc) {
    console.log('Document not found')
    return
  }

  const html = doc.html_content || ''

  console.log('=== Searching for legislative references ===\n')

  // Patterns based on user examples:
  // Prop. 2025/26:22
  // Bet. 2025/26:SkU5
  // Rskr. 2025/26:95

  const propPattern = /[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+/g
  const betPattern = /[Bb]et\.\s*\d{4}\/\d{2,4}:[A-Za-z]*\d+/g
  const rskrPattern = /[Rr]skr\.\s*\d{4}\/\d{2,4}:\d+/g

  const propMatches = html.match(propPattern) || []
  const betMatches = html.match(betPattern) || []
  const rskrMatches = html.match(rskrPattern) || []

  console.log('Prop matches:', propMatches)
  console.log('Bet matches:', betMatches)
  console.log('Rskr matches:', rskrMatches)

  // Find all footnote-related content
  console.log('\n=== Footnote sections in HTML ===\n')

  // Look for footnote IDs
  const footnoteIds = html.match(/id="[^"]*[Ff]ootnote[^"]*"/gi) || []
  console.log('Footnote IDs found:', footnoteIds.length)
  footnoteIds.slice(0, 5).forEach(id => console.log('  ', id))

  // Extract text around "Prop." mentions
  console.log('\n=== Context around Prop/Bet/Rskr mentions ===\n')
  const contextPattern = /.{0,50}[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+.{0,50}/g
  const contexts = html.match(contextPattern) || []
  contexts.forEach(ctx => {
    const clean = ctx.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    console.log('Context:', clean)
  })

  // Show a section of raw HTML that might contain footnotes
  console.log('\n=== Raw HTML section with footnotes ===\n')
  const footnoteStart = html.indexOf('FOOTNOTE')
  if (footnoteStart > -1) {
    console.log(html.substring(footnoteStart - 100, footnoteStart + 500))
  }

  // Check JSON structure
  console.log('\n=== JSON footnotes ===\n')
  const jsonContent = doc.json_content as Record<string, unknown> | null
  console.log(JSON.stringify(jsonContent?.footnotes, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
