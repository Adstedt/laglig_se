/* eslint-disable no-console */
/**
 * Notisum Laglistor Scraper (ONLY)
 *
 * Skips Ämnesfokus and just scrapes the 9 Laglistor.
 *
 * Usage: pnpm tsx scripts/scrape-laglistor-only.ts
 */

import { chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// ============================================
// TYPES
// ============================================

interface LaglistaDocument {
  index: string
  sfsNumber: string
  amendmentSfs: string | null
  documentName: string
  notisumComment: string | null
  summaryText: string | null
  complianceText: string | null
  link: string | null
}

interface LaglistaSection {
  sectionNumber: string
  sectionName: string
  documents: LaglistaDocument[]
}

interface Laglista {
  name: string
  url: string
  description: string | null
  totalDocuments: number
  lastUpdated: string | null
  sections: LaglistaSection[]
  screenshotPath: string | null
  scrapedAt: string
}

// ============================================
// CONFIGURATION
// ============================================

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'notisum-amnesfokus')
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots')
const HTML_DEBUG_DIR = path.join(OUTPUT_DIR, 'html-debug')

const LOGIN_URL = 'https://www.notisum.se/login/'
const NOTISUM_USER = process.env.NOTISUM_USER || 'pr32602'
const NOTISUM_PASS = process.env.NOTISUM_PASS || 'KBty8611!'

// 5 NEW Laglistor only (already have the original 5)
const LAGLISTOR = [
  { name: 'Fastighet-Bygg', listId: '72162' },
  { name: 'Informationssäkerhet Sverige', listId: '72880' },
  { name: 'Livsmedel Sverige', listId: '72881' },
  { name: 'Miljö för tjänsteföretag', listId: '72882' },
  { name: 'Miljö Sverige', listId: '72883' },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

async function ensureDirectories() {
  for (const dir of [OUTPUT_DIR, SCREENSHOT_DIR, HTML_DEBUG_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

async function waitForLogin(page: Page): Promise<boolean> {
  console.log('\n=== LOGIN REQUIRED ===')
  console.log(`Username: ${NOTISUM_USER}`)
  console.log(`Password: ${NOTISUM_PASS}`)
  console.log('Please complete the CAPTCHA and click "Logga in"')
  console.log('========================\n')

  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })

  try {
    await page.fill('input[type="text"]', NOTISUM_USER)
    await page.fill('input[type="password"]', NOTISUM_PASS)
    console.log('Credentials pre-filled. Complete captcha and click Logga in.')
  } catch {
    console.log('Could not pre-fill credentials.')
  }

  console.log('Waiting for login...')
  for (let i = 0; i < 100; i++) {
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

async function saveHtmlForDebug(page: Page, filename: string) {
  const html = await page.content()
  fs.writeFileSync(path.join(HTML_DEBUG_DIR, filename), html)
}

// ============================================
// LAGLISTA SCRAPER
// ============================================

async function scrapeLaglista(page: Page, name: string, listId: string): Promise<Laglista> {
  const url = `https://www.notisum.se/Rn/lawlist/?listid=${listId}`
  console.log(`\n  Scraping Laglista: ${name} (${url})`)

  const result: Laglista = {
    name,
    url,
    description: null,
    totalDocuments: 0,
    lastUpdated: null,
    sections: [],
    screenshotPath: null,
    scrapedAt: new Date().toISOString(),
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(3000)

    // Click "Öppna / Stäng rubriker" to expand all sections
    console.log('    Expanding all sections...')
    try {
      const expandButton = await page.locator('button:has-text("Öppna"), a:has-text("Öppna"), span:has-text("Öppna")').first()
      if (await expandButton.count() > 0) {
        await expandButton.click()
        await page.waitForTimeout(3000)
      } else {
        const sectionHeaders = await page.locator('[class*="group"], [class*="header"], tr[onclick]').all()
        for (const header of sectionHeaders.slice(0, 20)) {
          try { await header.click() } catch { /* ignore */ }
        }
        await page.waitForTimeout(2000)
      }
    } catch {
      console.log('    Could not find expand button')
    }

    // Take screenshot after expansion
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_')
    result.screenshotPath = path.join(SCREENSHOT_DIR, `laglista-${safeName}.png`)
    await page.screenshot({ path: result.screenshotPath, fullPage: true })

    // Save HTML for debugging
    await saveHtmlForDebug(page, `laglista-${safeName}.html`)

    // Extract all document data
    const listData = await page.evaluate(() => {
      const sections: {
        sectionNumber: string
        sectionName: string
        documents: {
          index: string
          sfsNumber: string
          amendmentSfs: string | null
          documentName: string
          notisumComment: string | null
          summaryText: string | null
          complianceText: string | null
          link: string | null
        }[]
      }[] = []

      const pageText = document.body.innerText || ''
      const docCountMatch = pageText.match(/Antal dokument[:\s]*(\d+)/i)

      // Find all section headers
      const sectionHeaders = document.querySelectorAll('.group-header, div.group-header')

      sectionHeaders.forEach((header) => {
        const text = header.textContent?.trim() || ''
        const match = text.match(/^(\d{2})\s+(.+)$/)
        if (match) {
          sections.push({
            sectionNumber: match[1],
            sectionName: match[2].trim(),
            documents: []
          })
        }
      })

      // Find all document rows
      const docRows = document.querySelectorAll('tr[name="lawListDocumentRow"]')

      docRows.forEach((row) => {
        const cells = row.querySelectorAll('td')
        if (cells.length < 2) return

        let currentSection = sections[sections.length - 1]

        if (!currentSection || sections.length === 0) {
          if (sections.length === 0) {
            currentSection = {
              sectionNumber: '00',
              sectionName: 'UNCATEGORIZED',
              documents: []
            }
            sections.push(currentSection)
          }
        }

        // Detect if first cell is Index or Beteckning
        // Index cell has "Index" span and a 4-digit number
        // Beteckning cell has "Beteckning" span and SFS link
        const firstCellText = cells[0]?.textContent?.trim() || ''
        const hasIndexColumn = firstCellText.includes('Index') || /^\d{4}$/.test(firstCellText.replace(/Index/i, '').trim())

        let index = ''
        let beteckningCell: Element | null
        let summaryCell: Element | null
        let complianceCell: Element | null

        if (hasIndexColumn) {
          // 4-column layout: Index | Beteckning | Summary | Compliance
          const indexMatch = firstCellText.match(/(\d{4})/)
          if (indexMatch) index = indexMatch[1]
          beteckningCell = cells[1]
          summaryCell = cells[2]
          complianceCell = cells[3]
        } else {
          // 3-column layout: Beteckning | Summary | Compliance
          beteckningCell = cells[0]
          summaryCell = cells[1]
          complianceCell = cells[2]
        }

        const beteckningText = beteckningCell?.textContent?.trim() || ''
        if (!beteckningText || beteckningText.length < 5) return

        const sfsLink = beteckningCell?.querySelector('a.lawlist-signature')
        const sfsNumber = sfsLink?.textContent?.trim() || ''
        const link = (sfsLink as HTMLAnchorElement)?.href || null

        const sfsMatches = beteckningText.match(/SFS\s*\d{4}:\d+/gi) || []
        const amendmentSfs = sfsMatches.length > 1 ? sfsMatches[1] : null

        const nameMatch = beteckningText.match(/([A-ZÅÄÖ][a-zåäö\-]+(?:\s+[a-zåäöA-ZÅÄÖ\-]+)*)\s*\(\d{4}:\d+\)/)
        let documentName = nameMatch ? nameMatch[0] : ''

        if (!documentName) {
          const lines = beteckningText.split('\n').map(l => l.trim()).filter(l => l)
          if (lines.length >= 3) {
            documentName = lines[2] || lines[1] || ''
          }
        }

        const noticeDiv = beteckningCell?.querySelector('.notice, .notice-info, .notice-inner')
        let notisumComment: string | null = null
        if (noticeDiv) {
          notisumComment = noticeDiv.textContent?.trim() || null
        }

        let summaryText: string | null = null
        if (summaryCell) {
          const summarySpan = summaryCell.querySelector('.narrow-column-title')
          if (summarySpan) {
            summaryText = summaryCell.textContent?.replace(summarySpan.textContent || '', '').trim() || null
          } else {
            summaryText = summaryCell.textContent?.trim() || null
          }
        }

        let complianceText: string | null = null
        if (complianceCell) {
          const complianceSpan = complianceCell.querySelector('.narrow-column-title')
          if (complianceSpan) {
            complianceText = complianceCell.textContent?.replace(complianceSpan.textContent || '', '').trim() || null
          } else {
            complianceText = complianceCell.textContent?.trim() || null
          }
        }

        if (currentSection && (sfsNumber || documentName || link)) {
          currentSection.documents.push({
            index,
            sfsNumber,
            amendmentSfs,
            documentName: documentName || beteckningText.substring(0, 100),
            notisumComment,
            summaryText,
            complianceText,
            link
          })
        }
      })

      if (sections.length === 0 && docRows.length > 0) {
        sections.push({
          sectionNumber: '00',
          sectionName: 'ALL DOCUMENTS',
          documents: []
        })
      }

      return {
        sections,
        totalDocuments: docCountMatch ? parseInt(docCountMatch[1], 10) : docRows.length,
        lastUpdated: null,
        description: null
      }
    })

    result.sections = listData.sections
    result.totalDocuments = listData.totalDocuments || result.sections.reduce((sum, s) => sum + s.documents.length, 0)
    result.lastUpdated = listData.lastUpdated
    result.description = listData.description

    const docCount = result.sections.reduce((sum, s) => sum + s.documents.length, 0)
    console.log(`    Sections: ${result.sections.length}`)
    console.log(`    Documents extracted: ${docCount}`)
    console.log(`    Total documents (from page): ${result.totalDocuments}`)
    if (result.sections.length > 0) {
      result.sections.slice(0, 5).forEach(s => {
        console.log(`      ${s.sectionNumber} ${s.sectionName}: ${s.documents.length} docs`)
      })
      if (result.sections.length > 5) {
        console.log(`      ... and ${result.sections.length - 5} more sections`)
      }
    }

  } catch (error) {
    console.error(`    Error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }

  return result
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('='.repeat(70))
  console.log('NOTISUM LAGLISTOR SCRAPER (ONLY)')
  console.log('='.repeat(70))

  await ensureDirectories()

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  const page = await context.newPage()

  const laglistor: Laglista[] = []

  try {
    const loggedIn = await waitForLogin(page)
    if (!loggedIn) {
      throw new Error('Login failed')
    }

    console.log('\n' + '='.repeat(70))
    console.log('SCRAPING LAGLISTOR')
    console.log('='.repeat(70))

    for (const ll of LAGLISTOR) {
      const llResult = await scrapeLaglista(page, ll.name, ll.listId)
      laglistor.push(llResult)

      // Save after each to avoid data loss
      const jsonPath = path.join(OUTPUT_DIR, 'laglistor-data.json')
      fs.writeFileSync(jsonPath, JSON.stringify({ laglistor, scrapedAt: new Date().toISOString() }, null, 2))

      await page.waitForTimeout(1000)
    }

  } catch (error) {
    console.error('\nScraping failed:', error)
  } finally {
    console.log('\nClosing browser in 3 seconds...')
    await page.waitForTimeout(3000)
    await browser.close()
  }

  // ========================================
  // SAVE RESULTS (append to existing data)
  // ========================================

  // Load existing data from notisum-full-data.json if it exists
  const fullDataPath = path.join(OUTPUT_DIR, 'notisum-full-data.json')
  let existingLaglistor: Laglista[] = []
  if (fs.existsSync(fullDataPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(fullDataPath, 'utf-8'))
      existingLaglistor = existingData.laglistor || []
      console.log(`\nLoaded ${existingLaglistor.length} existing Laglistor from notisum-full-data.json`)
    } catch (e) {
      console.log('\nCould not load existing data, will save new data only')
    }
  }

  // Merge: keep existing lists, add/update new ones
  const mergedLaglistor = [...existingLaglistor]
  for (const newList of laglistor) {
    const existingIndex = mergedLaglistor.findIndex(l => l.name === newList.name || l.url === newList.url)
    if (existingIndex >= 0) {
      // Replace existing with new
      mergedLaglistor[existingIndex] = newList
    } else {
      // Add new
      mergedLaglistor.push(newList)
    }
  }

  // Save new scraped data separately
  const jsonPath = path.join(OUTPUT_DIR, 'laglistor-new-data.json')
  fs.writeFileSync(jsonPath, JSON.stringify({ laglistor, scrapedAt: new Date().toISOString() }, null, 2))
  console.log(`New data saved: ${jsonPath}`)

  // Save combined Laglistor CSV (all lists)
  const llCsvPath = path.join(OUTPUT_DIR, 'laglistor-all-combined.csv')
  const llCsvHeader = 'Laglista,Section Number,Section Name,Index,SFS Number,Amendment SFS,Document Name,Notisum Comment,Summary (Så här påverkas vi),Compliance,Link\n'
  const llCsvRows = mergedLaglistor.flatMap(ll =>
    ll.sections.flatMap(sec =>
      sec.documents.map(doc =>
        `"${ll.name}","${sec.sectionNumber}","${sec.sectionName}","${doc.index}","${doc.sfsNumber}","${doc.amendmentSfs || ''}",` +
        `"${doc.documentName.replace(/"/g, '""')}","${(doc.notisumComment || '').replace(/"/g, '""').replace(/\n/g, ' ')}",` +
        `"${(doc.summaryText || '').replace(/"/g, '""').replace(/\n/g, ' ')}","${(doc.complianceText || '').replace(/"/g, '""').replace(/\n/g, ' ')}","${doc.link || ''}"`
      )
    )
  ).join('\n')
  fs.writeFileSync(llCsvPath, llCsvHeader + llCsvRows)
  console.log(`Combined Laglistor saved: ${llCsvPath}`)

  // ========================================
  // PRINT SUMMARY
  // ========================================
  const newDocs = laglistor.reduce((sum, ll) => sum + ll.sections.reduce((s, sec) => s + sec.documents.length, 0), 0)
  const totalDocs = mergedLaglistor.reduce((sum, ll) => sum + ll.sections.reduce((s, sec) => s + sec.documents.length, 0), 0)

  console.log('\n' + '='.repeat(70))
  console.log('SCRAPING COMPLETE')
  console.log('='.repeat(70))
  console.log(`NEW Laglistor scraped: ${laglistor.length}`)
  console.log(`NEW documents extracted: ${newDocs}`)
  console.log('\nNew Laglistor breakdown:')
  laglistor.forEach(ll => {
    const docs = ll.sections.reduce((sum, s) => sum + s.documents.length, 0)
    const status = docs > 0 ? '✓' : '❌'
    console.log(`  ${status} ${ll.name}: ${docs} documents`)
  })
  console.log('\n--- COMBINED TOTALS ---')
  console.log(`Total Laglistor: ${mergedLaglistor.length}`)
  console.log(`Total documents: ${totalDocs}`)
  console.log('\nAll Laglistor:')
  mergedLaglistor.forEach(ll => {
    const docs = ll.sections.reduce((sum, s) => sum + s.documents.length, 0)
    const status = docs > 0 ? '✓' : '❌'
    console.log(`  ${status} ${ll.name}: ${docs} documents`)
  })
  console.log('\nFiles created:')
  console.log(`  - ${jsonPath}`)
  console.log(`  - ${llCsvPath}`)
  console.log(`  - Screenshots in: ${SCREENSHOT_DIR}`)
}

main().catch(console.error)
