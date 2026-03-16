import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import {
  CONFORMANCE_SYSTEM_PROMPT,
  buildConformanceUserMessage,
  generateDocId,
} from '../lib/transforms/conformance-prompt'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

async function inspectDoc(docNumber: string) {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: docNumber },
    select: {
      html_content: true,
      document_number: true,
      title: true,
      content_type: true,
    },
  })
  if (!doc?.html_content) {
    console.log(`Not found: ${docNumber}`)
    return
  }

  const docId = generateDocId(doc.document_number, doc.content_type)

  console.log(`\n${'='.repeat(70)}`)
  console.log(`${doc.document_number}: ${doc.title.substring(0, 60)}`)
  console.log(`DOC_ID: ${docId} | Content type: ${doc.content_type}`)
  console.log(`Input size: ${doc.html_content.length} chars`)
  console.log('='.repeat(70))

  console.log('\n--- INPUT (first 600 chars) ---')
  console.log(doc.html_content.substring(0, 600))

  // Send to LLM
  const userMsg = buildConformanceUserMessage({
    docId,
    documentNumber: doc.document_number,
    title: doc.title,
    contentType: doc.content_type,
    html: doc.html_content,
  })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16384,
    system: CONFORMANCE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  })

  const output =
    response.content[0]?.type === 'text' ? response.content[0].text : ''
  const clean = output
    .replace(/^```html?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()

  console.log(`\n--- OUTPUT (first 800 chars) ---`)
  console.log(clean.substring(0, 800))
  console.log(`\n--- OUTPUT (last 400 chars) ---`)
  console.log(clean.substring(clean.length - 400))
  console.log(
    `\nOutput size: ${clean.length} chars | Ratio: ${((clean.length / doc.html_content.length) * 100).toFixed(0)}%`
  )
  console.log(
    `Tokens: ${response.usage.input_tokens} → ${response.usage.output_tokens}`
  )
}

async function main() {
  // Check the 3 distinct failure patterns
  await inspectDoc('SFS 2001:782') // 100% ratio but missing h3.paragraph
  await inspectDoc('SFS 2010:1403') // 83% ratio, missing h3.paragraph
  await inspectDoc('32020L0432') // 22% ratio, massive content loss
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
