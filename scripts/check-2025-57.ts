import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check the LegalDocument
  const doc = await prisma.legalDocument.findFirst({
    where: {
      document_number: 'SFS 2025:57',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      html_content: true,
    },
  })

  if (doc) {
    console.log('ID:', doc.id)
    console.log('Title:', doc.title)
    console.log('Slug:', doc.slug)
    console.log('HTML length:', doc.html_content?.length || 0)
    console.log('')
    console.log('First 1000 chars of HTML:')
    console.log(doc.html_content?.substring(0, 1000))
  } else {
    console.log('Document not found in LegalDocument table')

    // Check AmendmentDocument
    const amendment = await prisma.amendmentDocument.findFirst({
      where: { sfs_number: '2025:57' },
    })

    if (amendment) {
      console.log('')
      console.log('Found in AmendmentDocument:')
      console.log('SFS:', amendment.sfs_number)
      console.log('Title:', amendment.title)
      console.log('Storage path:', amendment.storage_path)
    }
  }

  await prisma.$disconnect()
}

main()
