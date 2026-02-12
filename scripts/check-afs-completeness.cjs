const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const docs = await p.legalDocument.findMany({
    where: { document_number: { startsWith: 'AFS 2023' } },
    select: { document_number: true, html_content: true },
    orderBy: { document_number: 'asc' }
  })

  let issues = 0
  for (const d of docs) {
    const html = d.html_content || ''
    // Extract all § numbers in order
    const matches = [...html.matchAll(/class="paragraf"[^>]*>(\d+)\s*§/g)]
    const nums = matches.map(m => parseInt(m[1], 10))

    if (nums.length < 2) continue // skip parents with only 1-2 §

    const first = nums[0]
    const last = nums[nums.length - 1]
    const missing = []
    const duplicates = []
    const seen = new Set()

    for (let expected = first; expected <= last; expected++) {
      if (!nums.includes(expected)) missing.push(expected)
    }
    for (const n of nums) {
      if (seen.has(n)) duplicates.push(n)
      seen.add(n)
    }

    if (missing.length > 0 || duplicates.length > 0) {
      issues++
      console.log(`\n${d.document_number} (${nums.length} §, range ${first}-${last})`)
      if (missing.length > 0) console.log(`  MISSING: ${missing.join(', ')}`)
      if (duplicates.length > 0) console.log(`  DUPLICATES: ${duplicates.join(', ')}`)
    } else {
      console.log(`${d.document_number.padEnd(25)} OK  (${first}-${last}, ${nums.length} §)`)
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(issues === 0 ? 'All documents have complete § sequences!' : `${issues} document(s) with gaps or duplicates`)
}

main().catch(console.error).finally(() => p.$disconnect())
