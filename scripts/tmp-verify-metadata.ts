import { prisma } from '../lib/prisma'

async function main() {
  // Sample a paragraf chunk (should have anchorId + slug)
  const paragraf = await prisma.contentChunk.findFirst({
    where: { path: { startsWith: 'kap' }, NOT: { path: { contains: '.v' } } },
    select: { path: true, metadata: true, content_role: true },
  })
  console.log('Paragraf chunk:')
  console.log(JSON.stringify(paragraf, null, 2))

  // Sample a transition provision chunk
  const transition = await prisma.contentChunk.findFirst({
    where: { path: { startsWith: 'overgangsbest.' } },
    select: { path: true, metadata: true, content_role: true },
  })
  console.log('\nSplit transition chunk:')
  console.log(JSON.stringify(transition, null, 2))

  // Sample a .v2 chunk
  const v2 = await prisma.contentChunk.findFirst({
    where: { path: { contains: '.v2' } },
    select: { path: true, metadata: true, content_role: true },
  })
  console.log('\n.v2 deduplicated chunk:')
  console.log(JSON.stringify(v2, null, 2))

  // Sample a markdown fallback chunk
  const md = await prisma.contentChunk.findFirst({
    where: { content_role: 'MARKDOWN_CHUNK' },
    select: { path: true, metadata: true, content_role: true },
  })
  console.log('\nMarkdown fallback chunk:')
  console.log(JSON.stringify(md, null, 2))

  // Sample an appendix chunk
  const bilaga = await prisma.contentChunk.findFirst({
    where: { path: { startsWith: 'bilaga' } },
    select: { path: true, metadata: true, content_role: true },
  })
  console.log('\nAppendix chunk:')
  console.log(JSON.stringify(bilaga, null, 2))

  await prisma.$disconnect()
}
main()
