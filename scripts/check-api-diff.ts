/**
 * Check what the API returns for a specific amendment diff
 */

interface SectionData {
  chapter: string | null
  section: string
  changeType: string
  linesAdded: number
  linesRemoved: number
  textUnavailable?: boolean
  textA?: string
  textB?: string
}

async function main() {
  const sfs = '1977:1160'
  const amendment = '2013:610'

  console.log(`Fetching diff for ${amendment} against ${sfs}...\n`)

  const url = `http://localhost:3000/api/laws/${sfs}/diff/${amendment}`
  console.log('URL:', url)

  const res = await fetch(url)

  if (!res.ok) {
    console.log('Error:', res.status, await res.text())
    return
  }

  const data = await res.json()

  console.log('\n=== API Response ===')
  console.log('Base law:', data.baseLawSfs)
  console.log('Amendment:', data.amendmentSfs)
  console.log('Effective date:', data.effectiveDate)
  console.log('Previous date:', data.previousDate)

  console.log('\n=== Summary ===')
  console.log('Sections added:', data.summary.sectionsAdded)
  console.log('Sections removed:', data.summary.sectionsRemoved)
  console.log('Sections modified:', data.summary.sectionsModified)

  console.log('\n=== Sections ===')
  console.log('Total sections in response:', data.sections.length)

  const withContent = data.sections.filter(
    (s: SectionData) =>
      !s.textUnavailable &&
      (s.linesAdded > 0 || s.linesRemoved > 0 || s.changeType !== 'modified')
  )
  const textUnavailable = data.sections.filter(
    (s: SectionData) => s.textUnavailable
  )
  const emptyModified = data.sections.filter(
    (s: SectionData) =>
      !s.textUnavailable &&
      s.changeType === 'modified' &&
      s.linesAdded === 0 &&
      s.linesRemoved === 0
  )

  console.log('\nWith actual diff content:', withContent.length)
  console.log('Text unavailable:', textUnavailable.length)
  console.log('Empty modified (0/0 lines):', emptyModified.length)

  console.log('\n=== Sections with textUnavailable ===')
  for (const s of textUnavailable) {
    console.log(` ${s.chapter || '-'} kap. ${s.section} § - ${s.changeType}`)
  }

  console.log('\n=== Sections with empty diff (0/0) ===')
  for (const s of emptyModified.slice(0, 10)) {
    console.log(` ${s.chapter || '-'} kap. ${s.section} § - ${s.changeType}`)
    if (s.textA) console.log(`   textA: ${s.textA?.substring(0, 50)}...`)
    if (s.textB) console.log(`   textB: ${s.textB?.substring(0, 50)}...`)
  }

  // Check one specific section that should have text
  const section42 = data.sections.find(
    (s: SectionData) => s.chapter === '4' && s.section === '3'
  )
  if (section42) {
    console.log('\n=== Sample: 4 kap. 3 § ===')
    console.log('Change type:', section42.changeType)
    console.log('Lines added:', section42.linesAdded)
    console.log('Lines removed:', section42.linesRemoved)
    console.log('Text unavailable:', section42.textUnavailable)
    console.log('textA length:', section42.textA?.length || 0)
    console.log('textB length:', section42.textB?.length || 0)
    console.log('lineDiff entries:', section42.lineDiff?.length || 0)
  }
}

main().catch(console.error)
