/**
 * Analyze Notisum amendment page structure for parser development
 * Run with: pnpm playwright test scripts/analyze-notisum-examples.ts --headed
 */
import { chromium } from 'playwright'
import * as fs from 'fs'

const NOTISUM_CREDENTIALS = {
  username: 'pr32602',
  password: 'KBty8611!',
}

const EXAMPLES = [
  {
    id: 1,
    sfs: '2025:1461',
    pattern: 'Definition Lists',
    amendmentUrl: 'https://www.notisum.se/rn/document/?id=20251461',
    baseLawUrl: 'https://www.notisum.se/rn/document/?id=20230875',
    pdfUrl:
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-12/SFS2025-1461.pdf',
  },
  {
    id: 2,
    sfs: '2025:1379',
    pattern: 'Unknown - to analyze',
    amendmentUrl: 'https://www.notisum.se/rn/document/?id=20251379',
    baseLawUrl: 'https://www.notisum.se/rn/document/?id=19900314',
    pdfUrl:
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-12/SFS2025-1379.pdf',
  },
  {
    id: 3,
    sfs: '2025:1351',
    pattern: 'Unknown - to analyze',
    amendmentUrl: 'https://www.notisum.se/rn/document/?id=20251351',
    baseLawUrl: 'https://www.notisum.se/rn/document/?id=20061043',
    pdfUrl:
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-11/SFS2025-1351.pdf',
  },
  {
    id: 4,
    sfs: '2025:1345',
    pattern: 'Unknown - to analyze',
    amendmentUrl: 'https://www.notisum.se/rn/document/?id=20251345',
    baseLawUrl: 'https://www.notisum.se/rn/document/?id=19970857',
    pdfUrl:
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-11/SFS2025-1345.pdf',
  },
  {
    id: 5,
    sfs: '2025:1344',
    pattern: 'Unknown - to analyze',
    amendmentUrl: 'https://www.notisum.se/rn/document/?id=20251344',
    baseLawUrl: 'https://www.notisum.se/rn/document/?id=20140836',
    pdfUrl:
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-11/SFS2025-1344.pdf',
  },
  {
    id: 6,
    sfs: '2025:1317',
    pattern: 'Unknown - to analyze',
    amendmentUrl: 'https://www.notisum.se/rn/document/?id=20251317',
    baseLawUrl: 'https://www.notisum.se/rn/document/?id=19980808',
    pdfUrl:
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-11/SFS2025-1317.pdf',
  },
  {
    id: 7,
    sfs: '2025:1312',
    pattern: 'Unknown - to analyze',
    amendmentUrl: 'https://www.notisum.se/rn/document/?id=20251312',
    baseLawUrl: 'https://www.notisum.se/rn/document/?id=20100800',
    pdfUrl:
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-11/SFS2025-1312.pdf',
  },
]

const LOGIN_URL = 'https://www.notisum.se/login/'

async function waitForLogin(page: any): Promise<boolean> {
  console.log('\n=== LOGIN REQUIRED ===')
  console.log(`Username: ${NOTISUM_CREDENTIALS.username}`)
  console.log(`Password: ${NOTISUM_CREDENTIALS.password}`)
  console.log('Please complete the CAPTCHA and click "Logga in"')
  console.log('========================\n')

  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Pre-fill credentials
  try {
    await page.fill('input[type="text"]', NOTISUM_CREDENTIALS.username)
    await page.fill('input[type="password"]', NOTISUM_CREDENTIALS.password)
    console.log('Credentials pre-filled. Complete captcha and click Logga in.')
  } catch (e) {
    console.log('Could not pre-fill credentials:', e)
  }

  // Poll for login (3 minutes max)
  console.log('Waiting for login...')
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(3000)
    const url = page.url()
    if (!url.includes('login')) {
      console.log(`Login successful! Redirected to: ${url}`)
      return true
    }
    if (i % 10 === 0 && i > 0) {
      console.log(`  Still waiting... (${i * 3}s)`)
    }
  }

  console.log('Login timeout!')
  return false
}

async function analyzeAmendmentPage(page: any, example: (typeof EXAMPLES)[0]) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Analyzing Example ${example.id}: SFS ${example.sfs}`)
  console.log(`${'='.repeat(60)}`)

  await page.goto(example.amendmentUrl)
  await page.waitForTimeout(2000)

  // Get page title
  const title = await page.locator('h1').first().textContent()
  console.log(`\nTitle: ${title}`)

  // Get the main document content container
  const contentSelector =
    '.document-content, .rn-document-content, article, main'
  const contentExists = await page.locator(contentSelector).count()

  let htmlStructure = ''
  let textContent = ''

  if (contentExists > 0) {
    htmlStructure = await page.locator(contentSelector).first().innerHTML()
    textContent = await page.locator(contentSelector).first().textContent()
  } else {
    // Fallback - get body content
    htmlStructure = await page.locator('body').innerHTML()
    textContent = await page.locator('body').textContent()
  }

  // Save HTML for analysis
  const outputDir = 'scripts/notisum-analysis'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(
    `${outputDir}/example-${example.id}-${example.sfs.replace(':', '-')}.html`,
    htmlStructure
  )
  fs.writeFileSync(
    `${outputDir}/example-${example.id}-${example.sfs.replace(':', '-')}.txt`,
    textContent || ''
  )

  // Analyze structure
  console.log('\n--- HTML Structure Analysis ---')

  // Check for specific elements
  const hasDefinitionList =
    htmlStructure.includes('<dl') || htmlStructure.includes('definition')
  const hasOrderedList = htmlStructure.includes('<ol')
  const hasUnorderedList = htmlStructure.includes('<ul')
  const hasParagraphs = htmlStructure.includes('<p')
  const hasHeadings =
    htmlStructure.includes('<h2') || htmlStructure.includes('<h3')
  const hasTable = htmlStructure.includes('<table')
  const hasBold =
    htmlStructure.includes('<b>') || htmlStructure.includes('<strong')
  const hasItalic =
    htmlStructure.includes('<i>') || htmlStructure.includes('<em')

  console.log(`- Definition list (<dl>): ${hasDefinitionList}`)
  console.log(`- Ordered list (<ol>): ${hasOrderedList}`)
  console.log(`- Unordered list (<ul>): ${hasUnorderedList}`)
  console.log(`- Paragraphs (<p>): ${hasParagraphs}`)
  console.log(`- Headings (<h2/h3>): ${hasHeadings}`)
  console.log(`- Tables: ${hasTable}`)
  console.log(`- Bold text: ${hasBold}`)
  console.log(`- Italic text: ${hasItalic}`)

  // Check for section patterns
  const sectionPattern = /(\d+\s*(?:kap\.)?\s*\d*\s*§)/g
  const sections = textContent?.match(sectionPattern) || []
  console.log(`\n- Section references found: ${sections.length}`)
  if (sections.length > 0) {
    console.log(`  First few: ${sections.slice(0, 5).join(', ')}`)
  }

  // Check for definition patterns
  const defPattern =
    /([a-zåäö]+(?:\s+[a-zåäö]+)*)\s+i\s+(\d+(?:\s*kap\.)?\s*\d*\s*§)/gi
  const definitions = textContent?.match(defPattern) || []
  console.log(`\n- Definition patterns found: ${definitions.length}`)
  if (definitions.length > 0) {
    console.log(`  First few: ${definitions.slice(0, 3).join(' | ')}`)
  }

  // Take screenshot
  await page.screenshot({
    path: `${outputDir}/example-${example.id}-${example.sfs.replace(':', '-')}.png`,
    fullPage: true,
  })

  console.log(`\nFiles saved to ${outputDir}/`)

  return {
    id: example.id,
    sfs: example.sfs,
    title,
    hasDefinitionList,
    hasOrderedList,
    hasUnorderedList,
    hasParagraphs,
    hasHeadings,
    hasTable,
    sectionCount: sections.length,
    definitionCount: definitions.length,
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })
  const page = await context.newPage()

  // Login first (requires manual CAPTCHA)
  const loggedIn = await waitForLogin(page)
  if (!loggedIn) {
    console.error('Login failed - exiting')
    await browser.close()
    return
  }

  const results: any[] = []

  for (const example of EXAMPLES) {
    try {
      const result = await analyzeAmendmentPage(page, example)
      results.push(result)
    } catch (error) {
      console.error(`Error analyzing example ${example.id}:`, error)
      results.push({ id: example.id, sfs: example.sfs, error: String(error) })
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  for (const r of results) {
    if (r.error) {
      console.log(`Example ${r.id} (${r.sfs}): ERROR - ${r.error}`)
    } else {
      const features = []
      if (r.hasDefinitionList) features.push('DEF_LIST')
      if (r.hasOrderedList) features.push('OL')
      if (r.hasUnorderedList) features.push('UL')
      if (r.hasHeadings) features.push('HEADINGS')
      if (r.hasTable) features.push('TABLE')
      console.log(`Example ${r.id} (${r.sfs}): ${r.title?.slice(0, 50)}...`)
      console.log(`  Features: ${features.join(', ') || 'NONE'}`)
      console.log(
        `  Sections: ${r.sectionCount}, Definitions: ${r.definitionCount}`
      )
    }
  }

  // Save summary
  fs.writeFileSync(
    'scripts/notisum-analysis/summary.json',
    JSON.stringify(results, null, 2)
  )

  await browser.close()
}

main().catch(console.error)
