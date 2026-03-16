import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all SFS laws with broken normalization - more precise check
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      html_content: {
        contains: '<article class="legal-document"',
      },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
  })

  // Separate into categories
  const fullyCanonical: string[] = [] // Has class="paragraph" — properly normalized
  const noParafSign: string[] = [] // No § at all — simple docs, fine
  const brokenActualLaws: string[] = [] // Has <a class="paragraf"> in raw HTML inside body — was NOT re-normalized
  const brokenTextOnly: string[] = [] // Has § in flowing text but no structure — text refs like "2 §"

  for (const doc of docs) {
    const html = doc.html_content || ''
    const hasParagraphClass = html.includes('class="paragraph"')
    const hasParagrafSign = html.includes('§')

    if (hasParagraphClass) {
      fullyCanonical.push(doc.document_number)
      continue
    }

    if (!hasParagrafSign) {
      noParafSign.push(doc.document_number)
      continue
    }

    // Has § but no class="paragraph" — is this a real structure issue?
    // Check if § appears only in text content (like "enligt 2 §") vs actual paragraf anchors
    const hasParagrafAnchor = html.includes('class="paragraf"')
    const bodyMatch = html.match(/<div class="body">([\s\S]*?)<\/div>/)
    const bodyHtml = bodyMatch ? bodyMatch[1] : ''

    // Count actual paragraph markers that SHOULD have been created
    const paragrafInBody = (bodyHtml.match(/\d+\s*§/g) || []).length
    const h3ParagraphCount = (bodyHtml.match(/<h3 class="paragraph">/g) || [])
      .length

    if (hasParagrafAnchor) {
      // Still has raw <a class="paragraf"> anchors — normalizer didn't process inner structure
      brokenActualLaws.push(
        `${doc.document_number.padEnd(20)} anchors_in_body, paragraf_refs=${paragrafInBody}, h3s=${h3ParagraphCount} — ${doc.title.substring(0, 50)}`
      )
    } else if (paragrafInBody > 2 && h3ParagraphCount === 0) {
      // Many § references in body text but no h3 structure
      brokenTextOnly.push(
        `${doc.document_number.padEnd(20)} text_refs=${paragrafInBody}, h3s=${h3ParagraphCount} — ${doc.title.substring(0, 50)}`
      )
    }
  }

  console.log(`Total canonical-wrapped: ${docs.length}`)
  console.log(
    `Fully canonical (has class="paragraph"): ${fullyCanonical.length}`
  )
  console.log(`No § at all (simple docs): ${noParafSign.length}`)
  console.log(
    `\n--- BROKEN: still has raw <a class="paragraf"> anchors (${brokenActualLaws.length}) ---`
  )
  for (const b of brokenActualLaws.slice(0, 30)) console.log(`  ${b}`)
  if (brokenActualLaws.length > 30)
    console.log(`  ... and ${brokenActualLaws.length - 30} more`)

  console.log(
    `\n--- POSSIBLY BROKEN: many § text refs but no h3 structure (${brokenTextOnly.length}) ---`
  )
  for (const b of brokenTextOnly.slice(0, 30)) console.log(`  ${b}`)
  if (brokenTextOnly.length > 30)
    console.log(`  ... and ${brokenTextOnly.length - 30} more`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
