import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { validateLlmOutput } from '../lib/sfs/llm-output-validator'
import { htmlToMarkdown, htmlToPlainText } from '../lib/transforms/html-to-markdown'
import { htmlToJson } from '../lib/transforms/html-to-json'

const prisma = new PrismaClient()

async function main() {
  const sfsNumber = '2025:57'

  console.log('Restoring original batch output for SFS', sfsNumber)

  // Read original batch output
  const rawHtml = readFileSync('test-results/SFS2025-57-llm-output.html', 'utf8')

  // Validate and clean
  const validation = validateLlmOutput(rawHtml, sfsNumber)

  if (!validation.valid) {
    console.error('Validation failed:', validation.errors)
    process.exit(1)
  }

  const htmlContent = validation.cleanedHtml!
  const markdownContent = htmlToMarkdown(htmlContent)
  const jsonContent = htmlToJson(htmlContent, {
    sfsNumber,
    documentType: 'amendment',
  })
  const plainText = htmlToPlainText(htmlContent)

  await prisma.legalDocument.update({
    where: { document_number: `SFS ${sfsNumber}` },
    data: {
      html_content: htmlContent,
      markdown_content: markdownContent,
      json_content: jsonContent as any,
      full_text: plainText,
      updated_at: new Date(),
    },
  })

  console.log('Restored original output!')
  console.log('HTML length:', htmlContent.length)

  await prisma.$disconnect()
}

main()
