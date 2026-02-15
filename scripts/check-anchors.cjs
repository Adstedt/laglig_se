const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // SFS Law sample
  const sfs = await p.legalDocument.findFirst({
    where: { content_type: 'SFS_LAW', html_content: { not: null } },
    select: { document_number: true, html_content: true },
  })
  const sfsMatches =
    sfs.html_content.match(/<a[^>]*class=.paragraf.[^>]*>[\s\S]*?<\/a>/g) || []
  console.log('=== SFS LAW ===', sfs.document_number)
  sfsMatches.slice(0, 4).forEach((m) => console.log(' ', m))

  // AFS sample
  const afs = await p.legalDocument.findFirst({
    where: {
      content_type: 'AGENCY_REGULATION',
      html_content: { not: null },
      full_text: { not: null },
    },
    select: { document_number: true, html_content: true },
  })
  const afsMatches =
    afs.html_content.match(/<a[^>]*class=.paragraf.[^>]*>[\s\S]*?<\/a>/g) || []
  console.log('\n=== AFS ===', afs.document_number)
  afsMatches.slice(0, 4).forEach((m) => console.log(' ', m))

  // Amendment sample
  const amd = await p.legalDocument.findFirst({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
    select: { document_number: true, html_content: true },
  })
  if (amd) {
    const amdMatches =
      amd.html_content.match(/<a[^>]*class=.paragraf.[^>]*>[\s\S]*?<\/a>/g) ||
      []
    console.log('\n=== SFS AMENDMENT ===', amd.document_number)
    amdMatches.slice(0, 4).forEach((m) => console.log(' ', m))
  }

  // Also check h4 headings in SFS (section headings)
  const sfsH4 = sfs.html_content.match(/<h4[^>]*>[\s\S]*?<\/h4>/g) || []
  console.log('\n=== SFS h4 headings ===')
  sfsH4.slice(0, 3).forEach((m) => console.log(' ', m))

  // Check h3 in SFS (chapter headings)
  const sfsH3 = sfs.html_content.match(/<h3[^>]*>[\s\S]*?<\/h3>/g) || []
  console.log('\n=== SFS h3 headings ===')
  sfsH3.slice(0, 3).forEach((m) => console.log(' ', m))
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
