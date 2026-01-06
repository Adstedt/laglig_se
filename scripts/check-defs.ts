import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:1461' },
    select: { full_text: true }
  });

  if (doc?.full_text) {
    // Find the definition list section
    const start = doc.full_text.indexOf('nedan angivna paragrafer:')
    const end = doc.full_text.indexOf('Värdet beträffande tilläggsskatt')
    if (start !== -1 && end !== -1) {
      const defSection = doc.full_text.substring(start + 25, end)
      console.log('=== DEFINITION SECTION (first 2000 chars) ===')
      console.log(defSection.substring(0, 2000))
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
