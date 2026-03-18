import { prisma } from '../lib/prisma'

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: { document_number: { startsWith: 'SFS 2026:' } },
    select: {
      document_number: true,
      content_type: true,
      json_content: true,
      markdown_content: true,
    },
    orderBy: { document_number: 'asc' },
  })

  const numbers = docs
    .map((d) => {
      const num = parseInt(d.document_number.replace('SFS 2026:', ''))
      return {
        num,
        sfs: d.document_number,
        type: d.content_type,
        hasJson: d.json_content !== null,
        hasMd: d.markdown_content !== null,
      }
    })
    .sort((a, b) => a.num - b.num)

  console.log('Total 2026 docs:', numbers.length)
  console.log('Highest:', numbers[numbers.length - 1]?.sfs)

  const allNums = new Set(numbers.map((n) => n.num))
  const max = Math.max(...numbers.map((n) => n.num))
  const gaps: number[] = []
  for (let i = 1; i <= max; i++) {
    if (!allNums.has(i)) gaps.push(i)
  }
  console.log(`\nGaps (${gaps.length}):`, gaps.join(', '))

  const missingJson = numbers.filter((n) => !n.hasJson)
  const missingMd = numbers.filter((n) => !n.hasMd)
  console.log(`\nMissing json_content: ${missingJson.length}`)
  if (missingJson.length <= 40)
    console.log('  ', missingJson.map((n) => n.sfs).join(', '))
  console.log(`Missing markdown_content: ${missingMd.length}`)
  if (missingMd.length <= 40)
    console.log('  ', missingMd.map((n) => n.sfs).join(', '))

  const byType: Record<string, number> = {}
  numbers.forEach((n) => {
    byType[n.type] = (byType[n.type] || 0) + 1
  })
  console.log('\nBy type:', JSON.stringify(byType))

  await prisma.$disconnect()
}

main().catch(console.error)
