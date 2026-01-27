import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: {
      document_number: 'SFS 1998:1000',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
  })

  if (!doc || !doc.html_content) {
    console.log('No document found')
    return
  }

  // Add some basic styling for browser viewing
  const fullHtml = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    .lovhead h1 { font-size: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 1rem; }
    .lovhead h1 .text:first-child { font-size: 1rem; color: #666; display: block; margin-bottom: 0.5rem; }
    h3.group { color: #444; font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #ddd; }
    h3.paragraph { font-size: 1rem; color: #000; margin-top: 1.5rem; }
    .text { margin: 0.5rem 0; }
    .footnote { color: #0066cc; }
    .footnote-content { background: #f5f5f5; padding: 0.5rem 1rem; margin: 0.5rem 0; border-left: 3px solid #ddd; }
    .footnote-content dt { font-weight: bold; }
    ol.list { margin: 0.5rem 0; padding-left: 2rem; }
    ol.list li { margin: 0.25rem 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
${doc.html_content}
</body>
</html>`

  const outputPath = resolve(
    process.cwd(),
    'test-results/SFS1998-1000-review.html'
  )
  writeFileSync(outputPath, fullHtml, 'utf-8')
  console.log('Written to:', outputPath)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
