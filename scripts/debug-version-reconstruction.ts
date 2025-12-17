/**
 * Debug version reconstruction for SFS 2013:610
 */
import { getLawVersionAtDate } from '../lib/legal-document/version-reconstruction'

async function main() {
  const baseLaw = 'SFS 1977:1160'

  // SFS 2013:610 became effective 2014-07-01
  // Previous amendment was SFS 2011:742 effective 2011-08-01
  const dateA = new Date('2011-08-01') // Previous version
  const dateB = new Date('2014-07-01') // After SFS 2013:610

  console.log('=== Version Reconstruction Debug ===\n')
  console.log('Base law:', baseLaw)
  console.log('Date A (before 2013:610):', dateA.toISOString().split('T')[0])
  console.log('Date B (after 2013:610):', dateB.toISOString().split('T')[0])

  console.log('\n=== Getting Version A ===')
  const versionA = await getLawVersionAtDate(baseLaw, dateA)
  if (!versionA) {
    console.log('Version A not found!')
    return
  }
  console.log('Sections in version A:', versionA.sections.length)

  console.log('\n=== Getting Version B ===')
  const versionB = await getLawVersionAtDate(baseLaw, dateB)
  if (!versionB) {
    console.log('Version B not found!')
    return
  }
  console.log('Sections in version B:', versionB.sections.length)

  // Check specific sections that should have changed
  const sectionsToCheck = ['4:3', '4:4', '4:5', '4:6', '4:2']

  console.log('\n=== Comparing Specific Sections ===')
  for (const key of sectionsToCheck) {
    const [chapter, section] = key.split(':')

    const sectionA = versionA.sections.find(
      (s) => s.chapter === chapter && s.section === section
    )
    const sectionB = versionB.sections.find(
      (s) => s.chapter === chapter && s.section === section
    )

    console.log(`\n--- ${chapter} kap. ${section} § ---`)
    console.log('Version A:')
    if (sectionA) {
      console.log('  Source type:', sectionA.source.type)
      console.log('  Text length:', sectionA.textContent.length)
      console.log(
        '  Text preview:',
        sectionA.textContent.substring(0, 100) + '...'
      )
    } else {
      console.log('  NOT FOUND')
    }

    console.log('Version B:')
    if (sectionB) {
      console.log('  Source type:', sectionB.source.type)
      console.log('  Text length:', sectionB.textContent.length)
      console.log(
        '  Text preview:',
        sectionB.textContent.substring(0, 100) + '...'
      )
    } else {
      console.log('  NOT FOUND')
    }

    if (sectionA && sectionB) {
      console.log(
        'Texts identical?',
        sectionA.textContent === sectionB.textContent
      )
    }
  }

  // Check what amendments are in between
  console.log('\n=== Amendments between dates ===')
  console.log(
    'From version A meta:',
    versionA.meta.amendmentsBetween?.length || 0,
    'amendments'
  )
  for (const a of (versionA.meta.amendmentsBetween || []).slice(0, 5)) {
    console.log(' -', a.sfsNumber, a.effectiveDate)
  }
}

main().catch(console.error)
