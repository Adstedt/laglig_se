/* eslint-disable no-console */
/**
 * Notisum Ämnesfokus & Laglistor Scraper
 *
 * Comprehensive scraper for competitive analysis of Notisum's category pages.
 *
 * SCRAPES:
 * 1. All 20 Ämnesfokus pages - full structure, sections, document counts
 * 2. All 5 default Laglistor - every document with:
 *    - Beteckning (SFS number, document name, Notisum comments)
 *    - Så här påverkas vi (law summary)
 *    - Section groupings (01 ALLMÄNNA REGLER, etc.)
 *
 * REQUIRES: Manual login (captcha)
 *
 * Usage: pnpm tsx scripts/scrape-notisum-amnesfokus.ts
 */

import { chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// ============================================
// TYPES
// ============================================

interface LaglistaDocument {
  index: string // e.g., "0100"
  sfsNumber: string // e.g., "SFS 1998:808"
  amendmentSfs: string | null // e.g., "SFS 2025:1317"
  documentName: string // e.g., "Miljöbalk (1998:808)"
  notisumComment: string | null // Blue box comment
  summaryText: string | null // "Så här påverkas vi" column
  complianceText: string | null // "Så här uppfyller vi kraven" column
  link: string | null
}

interface LaglistaSection {
  sectionNumber: string // e.g., "01"
  sectionName: string // e.g., "ALLMÄNNA REGLER"
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

interface AmnesfokusDocument {
  title: string
  sfs: string | null
  link: string
  type: 'law' | 'regulation' | 'eu' | 'news' | 'shortcut'
}

interface AmnesfokusSection {
  sectionNumber: string
  sectionName: string
  documentCount: number
  isExpanded: boolean
  documents: AmnesfokusDocument[]
  // For "Lagar och förordningar" and "Myndighetsföreskrifter" - these link to sub-lists
  subLists: { name: string; link: string }[]
}

interface AmnesfokusNewsItem {
  date: string
  sfs: string
  title: string
  link: string
}

interface AmnesfokusPage {
  name: string
  url: string
  pageId: string
  description: string | null
  totalDocuments: number
  documentsToAcknowledge: number | null
  lastUpdated: string | null
  sections: AmnesfokusSection[]
  newsItems: AmnesfokusNewsItem[]
  groupingOptions: string[]
  viewOptions: string[]
  screenshotPath: string | null
  scrapedAt: string
}

interface ScrapeResult {
  scrapedAt: string
  amnesfokusPages: AmnesfokusPage[]
  laglistor: Laglista[]
  summary: {
    totalAmnesfokus: number
    totalLaglistor: number
    totalDocumentsInLaglistor: number
  }
}

// ============================================
// CONFIGURATION
// ============================================

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'notisum-amnesfokus')
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots')

const LOGIN_URL = 'https://www.notisum.se/login/'
const NOTISUM_USER = process.env.NOTISUM_USER || 'pr32602'
const NOTISUM_PASS = process.env.NOTISUM_PASS || 'KBty8611!'

// All 20 Ämnesfokus pages (discovered from dropdown menu)
const AMNESFOKUS_PAGES = [
  { name: 'Arbetsmiljö', pageId: '140' },
  { name: 'Ekonomi', pageId: '142' },
  { name: 'Energi', pageId: '141' },
  { name: 'Fastighet', pageId: '143' },
  { name: 'Förvaltning', pageId: '517' },
  { name: 'Hälsa och Sjukvård', pageId: '144' },
  { name: 'Livsmedel', pageId: '516' },
  { name: 'Marknad', pageId: '145' },
  { name: 'Media', pageId: '146' },
  { name: 'Miljö', pageId: '147' },
  { name: 'Personal', pageId: '148' },
  { name: 'Produktlagstiftning', pageId: '149' },
  { name: 'Rättsväsende', pageId: '150' },
  { name: 'Skola', pageId: '151' },
  { name: 'Skog- och jordbruk', pageId: '518' },
  { name: 'Social', pageId: '152' },
  { name: 'Säkerhet', pageId: '153' },
  { name: 'Trafik', pageId: '154' },
]

// Default Laglistor - original 5 + 5 new ones
const LAGLISTOR = [
  { name: 'Arbetsmiljö', listId: '72130' },
  { name: 'Arbetsmiljö för tjänsteföretag', listId: '72160' },
  { name: 'Fastighet-Bygg', listId: '72162' }, // Changed / to - for file path safety
  { name: 'Hälsa och sjukvård', listId: '72163' },
  { name: 'Miljö', listId: '72129' },
  // New lists added
  { name: 'Informationssäkerhet Sverige', listId: '72880' },
  { name: 'Livsmedel Sverige', listId: '72881' },
  { name: 'Miljö för tjänsteföretag', listId: '72882' },
  { name: 'Miljö Sverige', listId: '72883' },
]

// ============================================
// HELPER FUNCTIONS
// ============================================

async function ensureDirectories() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
}

async function waitForLogin(page: Page): Promise<boolean> {
  console.log('\n=== LOGIN REQUIRED ===')
  console.log(`Username: ${NOTISUM_USER}`)
  console.log(`Password: ${NOTISUM_PASS}`)
  console.log('Please complete the CAPTCHA and click "Logga in"')
  console.log('========================\n')

  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Pre-fill credentials
  try {
    await page.fill('input[type="text"]', NOTISUM_USER)
    await page.fill('input[type="password"]', NOTISUM_PASS)
    console.log('Credentials pre-filled. Complete captcha and click Logga in.')
  } catch {
    console.log('Could not pre-fill credentials.')
  }

  // Poll for login (5 minutes max)
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

// ============================================
// HTML SAVING (for debugging DOM structure)
// ============================================

const HTML_DEBUG_DIR = path.join(OUTPUT_DIR, 'html-debug')

async function saveHtmlForDebug(page: Page, filename: string) {
  if (!fs.existsSync(HTML_DEBUG_DIR)) {
    fs.mkdirSync(HTML_DEBUG_DIR, { recursive: true })
  }
  const html = await page.content()
  fs.writeFileSync(path.join(HTML_DEBUG_DIR, filename), html)
}

// ============================================
// ÄMNESFOKUS SCRAPER
// ============================================

async function scrapeAmnesfokusPage(
  page: Page,
  name: string,
  pageId: string
): Promise<AmnesfokusPage> {
  const url = `https://www.notisum.se/rn/focus?pageid=${pageId}`
  console.log(`\n  Scraping Ämnesfokus: ${name} (${url})`)

  const result: AmnesfokusPage = {
    name,
    url,
    pageId,
    description: null,
    totalDocuments: 0,
    documentsToAcknowledge: null,
    lastUpdated: null,
    sections: [],
    newsItems: [],
    groupingOptions: [],
    viewOptions: [],
    screenshotPath: null,
    scrapedAt: new Date().toISOString(),
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Take screenshot
    const screenshotName = `amnesfokus-${name.replace(/[^a-zA-Z0-9]/g, '_')}.png`
    result.screenshotPath = path.join(SCREENSHOT_DIR, screenshotName)
    await page.screenshot({ path: result.screenshotPath, fullPage: true })

    // Save HTML for all pages to debug DOM structure
    await saveHtmlForDebug(
      page,
      `amnesfokus-${name.replace(/[/\\?%*:|"<>]/g, '_')}.html`
    )

    // Extract page data based on actual DOM structure from analysis:
    // 1. "Genvägar till de viktigaste dokumenten" - div.subject-area-links with direct document links
    // 2. "Lagar och förordningar" - table-treeview-list with links to sub-lists
    // 3. "Myndighetsföreskrifter" - table-treeview-list with authority regulation lists
    // 4. "Nyheter" - table with date, SFS, and title columns
    const pageData = await page.evaluate(() => {
      const sections: {
        sectionNumber: string
        sectionName: string
        documentCount: number
        isExpanded: boolean
        documents: {
          title: string
          sfs: string | null
          link: string
          type: string
        }[]
        subLists: { name: string; link: string }[]
      }[] = []
      const newsItems: {
        date: string
        sfs: string
        title: string
        link: string
      }[] = []

      // 1. GENVÄGAR TILL DE VIKTIGASTE DOKUMENTEN
      const shortcutsContainer = document.querySelector('.subject-area-links')
      if (shortcutsContainer) {
        const shortcutDocs: {
          title: string
          sfs: string | null
          link: string
          type: string
        }[] = []
        const links = shortcutsContainer.querySelectorAll(
          'a[href*="/rn/document"]'
        )
        links.forEach((a) => {
          const title = a.textContent?.trim() || ''
          const href = (a as HTMLAnchorElement).href || ''
          const sfsMatch =
            title.match(/\((\d{4}:\d+)\)/) || title.match(/(\d{4}:\d+)/)
          if (title) {
            shortcutDocs.push({
              title,
              sfs: sfsMatch ? sfsMatch[1] : null,
              link: href,
              type: title.includes('(EU)') ? 'eu' : 'shortcut',
            })
          }
        })
        sections.push({
          sectionNumber: '01',
          sectionName: 'GENVÄGAR TILL DE VIKTIGASTE DOKUMENTEN',
          documentCount: shortcutDocs.length,
          isExpanded: true,
          documents: shortcutDocs,
          subLists: [],
        })
      }

      // 2. LAGAR OCH FÖRORDNINGAR - Look for table-title with this text
      const tableTitles = document.querySelectorAll('.table-title')
      tableTitles.forEach((titleEl) => {
        const titleText = titleEl.textContent?.trim() || ''
        const container = titleEl.nextElementSibling

        if (titleText.toLowerCase().includes('lagar och förordningar')) {
          const subLists: { name: string; link: string }[] = []
          const treeLinks =
            container?.querySelectorAll('.table-treeview-list a') || []
          treeLinks.forEach((a) => {
            const text = a.textContent?.trim() || ''
            const href = (a as HTMLAnchorElement).href || ''
            if (text && href) {
              subLists.push({ name: text, link: href })
            }
          })
          sections.push({
            sectionNumber: '02',
            sectionName: 'LAGAR OCH FÖRORDNINGAR',
            documentCount: 0,
            isExpanded: true,
            documents: [],
            subLists,
          })
        }

        if (titleText.toLowerCase().includes('myndighetsföreskrifter')) {
          const subLists: { name: string; link: string }[] = []
          const treeLinks =
            container?.querySelectorAll('.table-treeview-list a') || []
          treeLinks.forEach((a) => {
            const text = a.textContent?.trim() || ''
            const href = (a as HTMLAnchorElement).href || ''
            if (text && href) {
              subLists.push({ name: text, link: href })
            }
          })
          sections.push({
            sectionNumber: '03',
            sectionName: 'MYNDIGHETSFÖRESKRIFTER',
            documentCount: subLists.length,
            isExpanded: true,
            documents: [],
            subLists,
          })
        }

        if (titleText.toLowerCase().includes('nyheter')) {
          // Parse news table - rows have: date | SFS link | title
          const newsTable = container?.querySelector('table.table-list')
          const rows = newsTable?.querySelectorAll('tbody tr') || []
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td')
            if (cells.length >= 2) {
              const date = cells[0]?.textContent?.trim() || ''
              const sfsLink = cells[1]?.querySelector('a')
              const sfs = sfsLink?.textContent?.trim() || ''
              const link = (sfsLink as HTMLAnchorElement)?.href || ''
              const title = cells[2]?.textContent?.trim() || ''
              if (date && sfs) {
                newsItems.push({ date, sfs, title, link })
              }
            }
          })
          sections.push({
            sectionNumber: '04',
            sectionName: 'NYHETER',
            documentCount: newsItems.length,
            isExpanded: true,
            documents: [],
            subLists: [],
          })
        }
      })

      // Calculate total documents
      const totalDocs = sections.reduce(
        (sum, s) => sum + s.documentCount + s.documents.length,
        0
      )

      return {
        sections,
        newsItems,
        totalDocuments: totalDocs,
      }
    })

    result.sections = pageData.sections
    result.newsItems = pageData.newsItems
    result.totalDocuments = pageData.totalDocuments

    console.log(
      `    Total shortcuts: ${result.sections.find((s) => s.sectionName.includes('GENVÄGAR'))?.documents.length || 0}`
    )
    console.log(`    Sections found: ${result.sections.length}`)
    result.sections.forEach((s) => {
      const docCount =
        s.documents.length > 0
          ? `${s.documents.length} docs`
          : `${s.subLists.length} sub-lists`
      console.log(`      - ${s.sectionName}: ${docCount}`)
    })
    console.log(`    News items: ${result.newsItems.length}`)
  } catch (error) {
    console.error(
      `    Error: ${error instanceof Error ? error.message : 'Unknown'}`
    )
  }

  return result
}

// ============================================
// LAGLISTA SCRAPER
// ============================================

async function scrapeLaglista(
  page: Page,
  name: string,
  listId: string
): Promise<Laglista> {
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
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Click "Öppna / Stäng rubriker" to expand all sections
    console.log('    Expanding all sections...')
    try {
      // Look for the expand button - it might be labeled differently
      const expandButton = await page
        .locator(
          'button:has-text("Öppna"), a:has-text("Öppna"), span:has-text("Öppna")'
        )
        .first()
      if ((await expandButton.count()) > 0) {
        await expandButton.click()
        await page.waitForTimeout(3000)
      } else {
        // Try clicking all section headers to expand
        const sectionHeaders = await page
          .locator('[class*="group"], [class*="header"], tr[onclick]')
          .all()
        for (const header of sectionHeaders.slice(0, 20)) {
          try {
            await header.click()
          } catch {
            /* ignore */
          }
        }
        await page.waitForTimeout(2000)
      }
    } catch {
      console.log('    Could not find expand button')
    }

    // Take screenshot after expansion
    const screenshotName = `laglista-${name.replace(/[^a-zA-Z0-9]/g, '_')}.png`
    result.screenshotPath = path.join(SCREENSHOT_DIR, screenshotName)
    await page.screenshot({ path: result.screenshotPath, fullPage: true })

    // Save HTML for all Laglistor to debug (sanitize filename)
    const safeName = name.replace(/[/\\?%*:|"<>]/g, '_')
    await saveHtmlForDebug(page, `laglista-${safeName}.html`)

    // Extract all document data using the correct DOM structure
    // Based on analysis of laglista-Miljö.html:
    // - Section headers: <div class="group-header">01 ALLMÄNNA REGLER</div>
    // - Document rows: <tr name="lawListDocumentRow">
    // - Cells: Index | Beteckning (with SFS, title, blue box comment) | Så här påverkas vi | Så här uppfyller vi kraven
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

      // Get page text for document count
      const pageText = document.body.innerText || ''
      const docCountMatch = pageText.match(/Antal dokument[:\s]*(\d+)/i)

      // Find all section headers: <div class="group-header">01 ALLMÄNNA REGLER</div>
      const sectionHeaders = document.querySelectorAll(
        '.group-header, div.group-header'
      )
      const sectionMap = new Map<string, (typeof sections)[0]>()

      sectionHeaders.forEach((header) => {
        const text = header.textContent?.trim() || ''
        const match = text.match(/^(\d{2})\s+(.+)$/)
        if (match) {
          const section = {
            sectionNumber: match[1],
            sectionName: match[2].trim(),
            documents: [],
          }
          sections.push(section)
          // Find the parent container to map documents to this section
          const container = header.closest(
            '[id^="lawListGroupContainer"], .lawlist-table, .table-container'
          )
          if (container) {
            sectionMap.set(container.id || container.className, section)
          }
        }
      })

      // Find all document rows: <tr name="lawListDocumentRow">
      const docRows = document.querySelectorAll('tr[name="lawListDocumentRow"]')

      docRows.forEach((row) => {
        const cells = row.querySelectorAll('td')
        if (cells.length < 2) return

        // Find which section this row belongs to
        const container = row.closest(
          '[id^="lawListGroupContainer"], .lawlist-table, .table-container'
        )
        let currentSection = sections[sections.length - 1] // Default to last section

        if (container) {
          // Find the section for this container by looking at nearby group-header
          const groupHeader = container.querySelector('.group-header')
          if (groupHeader) {
            const headerText = groupHeader.textContent?.trim() || ''
            const match = headerText.match(/^(\d{2})\s+/)
            if (match) {
              const foundSection = sections.find(
                (s) => s.sectionNumber === match[1]
              )
              if (foundSection) currentSection = foundSection
            }
          }
        }

        // If still no section, try to find from the row's parent table
        if (!currentSection || sections.length === 0) {
          // Create a default section if none found
          if (sections.length === 0) {
            currentSection = {
              sectionNumber: '00',
              sectionName: 'UNCATEGORIZED',
              documents: [],
            }
            sections.push(currentSection)
          }
        }

        // Extract data from cells
        // Cell 0: Index (e.g., "0100")
        // Cell 1: Beteckning (SFS number, amendment, title, blue box comment)
        // Cell 2: Så här påverkas vi
        // Cell 3: Så här uppfyller vi kraven

        const indexCell = cells[0]
        const beteckningCell = cells[1]
        const summaryCell = cells[2]
        const complianceCell = cells[3]

        // Extract index - look for the 4-digit number after "Index" span
        let index = ''
        const indexText = indexCell?.textContent?.trim() || ''
        const indexMatch = indexText.match(/(\d{4})/)
        if (indexMatch) index = indexMatch[1]

        // Extract from Beteckning cell
        const beteckningText = beteckningCell?.textContent?.trim() || ''
        if (!beteckningText || beteckningText.length < 5) return

        // Get the primary SFS link
        const sfsLink = beteckningCell?.querySelector('a.lawlist-signature')
        const sfsNumber = sfsLink?.textContent?.trim() || ''
        const link = (sfsLink as HTMLAnchorElement)?.href || null

        // Get amendment SFS (second SFS number on next line)
        const _allText = beteckningCell?.innerHTML || ''
        const sfsMatches = beteckningText.match(/SFS\s*\d{4}:\d+/gi) || []
        const amendmentSfs = sfsMatches.length > 1 ? sfsMatches[1] : null

        // Extract document name - it's usually after SFS numbers, in format "Name (year:number)"
        const nameMatch = beteckningText.match(
          /([A-ZÅÄÖ][a-zåäö\-]+(?:\s+[a-zåäöA-ZÅÄÖ\-]+)*)\s*\(\d{4}:\d+\)/
        )
        let documentName = nameMatch ? nameMatch[0] : ''

        // Fallback: get the text after SFS numbers but before the blue box
        if (!documentName) {
          const lines = beteckningText
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l)
          // Document name is usually on line 3 (after SFS and amendment)
          if (lines.length >= 3) {
            documentName = lines[2] || lines[1] || ''
          }
        }

        // Extract Notisum blue box comment
        const noticeDiv = beteckningCell?.querySelector(
          '.notice, .notice-info, .notice-inner'
        )
        let notisumComment: string | null = null
        if (noticeDiv) {
          notisumComment = noticeDiv.textContent?.trim() || null
        }

        // Get summary text (Så här påverkas vi)
        let summaryText: string | null = null
        if (summaryCell) {
          // Skip the narrow column title span
          const summarySpan = summaryCell.querySelector('.narrow-column-title')
          if (summarySpan) {
            summaryText =
              summaryCell.textContent
                ?.replace(summarySpan.textContent || '', '')
                .trim() || null
          } else {
            summaryText = summaryCell.textContent?.trim() || null
          }
        }

        // Get compliance text (Så här uppfyller vi kraven)
        let complianceText: string | null = null
        if (complianceCell) {
          const complianceSpan = complianceCell.querySelector(
            '.narrow-column-title'
          )
          if (complianceSpan) {
            complianceText =
              complianceCell.textContent
                ?.replace(complianceSpan.textContent || '', '')
                .trim() || null
          } else {
            complianceText = complianceCell.textContent?.trim() || null
          }
        }

        // Add document to section
        if (currentSection && (sfsNumber || documentName || link)) {
          currentSection.documents.push({
            index,
            sfsNumber,
            amendmentSfs,
            documentName: documentName || beteckningText.substring(0, 100),
            notisumComment,
            summaryText,
            complianceText,
            link,
          })
        }
      })

      // If we found document rows but no sections, try to find sections from group containers
      if (sections.length === 0 && docRows.length > 0) {
        // Fallback: create one section for all documents
        const defaultSection = {
          sectionNumber: '00',
          sectionName: 'ALL DOCUMENTS',
          documents: [] as (typeof sections)[0]['documents'],
        }
        sections.push(defaultSection)
      }

      return {
        sections,
        totalDocuments: docCountMatch
          ? parseInt(docCountMatch[1], 10)
          : docRows.length,
        lastUpdated: null,
        description: null,
      }
    })

    result.sections = listData.sections
    result.totalDocuments =
      listData.totalDocuments ||
      result.sections.reduce((sum, s) => sum + s.documents.length, 0)
    result.lastUpdated = listData.lastUpdated
    result.description = listData.description

    const docCount = result.sections.reduce(
      (sum, s) => sum + s.documents.length,
      0
    )
    console.log(`    Sections: ${result.sections.length}`)
    console.log(`    Documents extracted: ${docCount}`)
    console.log(`    Total documents (from page): ${result.totalDocuments}`)
    if (result.sections.length > 0) {
      result.sections.slice(0, 5).forEach((s) => {
        console.log(
          `      ${s.sectionNumber} ${s.sectionName}: ${s.documents.length} docs`
        )
      })
      if (result.sections.length > 5) {
        console.log(`      ... and ${result.sections.length - 5} more sections`)
      }
    }
  } catch (error) {
    console.error(
      `    Error: ${error instanceof Error ? error.message : 'Unknown'}`
    )
  }

  return result
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('='.repeat(70))
  console.log('NOTISUM ÄMNESFOKUS & LAGLISTOR SCRAPER')
  console.log('='.repeat(70))

  await ensureDirectories()

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  const page = await context.newPage()

  const results: ScrapeResult = {
    scrapedAt: new Date().toISOString(),
    amnesfokusPages: [],
    laglistor: [],
    summary: {
      totalAmnesfokus: 0,
      totalLaglistor: 0,
      totalDocumentsInLaglistor: 0,
    },
  }

  try {
    // Login
    const loggedIn = await waitForLogin(page)
    if (!loggedIn) {
      throw new Error('Login failed')
    }

    // ========================================
    // SCRAPE ÄMNESFOKUS PAGES
    // ========================================
    console.log('\n' + '='.repeat(70))
    console.log('SCRAPING ÄMNESFOKUS PAGES')
    console.log('='.repeat(70))

    for (const af of AMNESFOKUS_PAGES) {
      const afResult = await scrapeAmnesfokusPage(page, af.name, af.pageId)
      results.amnesfokusPages.push(afResult)
      await page.waitForTimeout(1000)
    }

    // ========================================
    // SCRAPE LAGLISTOR
    // ========================================
    console.log('\n' + '='.repeat(70))
    console.log('SCRAPING LAGLISTOR')
    console.log('='.repeat(70))

    for (const ll of LAGLISTOR) {
      const llResult = await scrapeLaglista(page, ll.name, ll.listId)
      results.laglistor.push(llResult)
      await page.waitForTimeout(1000)
    }

    // Calculate summary
    results.summary.totalAmnesfokus = results.amnesfokusPages.length
    results.summary.totalLaglistor = results.laglistor.length
    results.summary.totalDocumentsInLaglistor = results.laglistor.reduce(
      (sum, ll) =>
        sum + ll.sections.reduce((s, sec) => s + sec.documents.length, 0),
      0
    )
  } catch (error) {
    console.error('\nScraping failed:', error)
  } finally {
    console.log('\nClosing browser in 5 seconds...')
    await page.waitForTimeout(5000)
    await browser.close()
  }

  // ========================================
  // SAVE RESULTS
  // ========================================

  // Save full JSON
  const jsonPath = path.join(OUTPUT_DIR, 'notisum-full-data.json')
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2))
  console.log(`\nFull data saved: ${jsonPath}`)

  // Save Ämnesfokus summary CSV
  const afCsvPath = path.join(OUTPUT_DIR, 'amnesfokus-summary.csv')
  const afCsvHeader =
    'Name,PageId,URL,Total Documents,Sections Count,Shortcuts Count,SubLists Count,News Count\n'
  const afCsvRows = results.amnesfokusPages
    .map((af) => {
      const shortcuts =
        af.sections.find((s) => s.sectionName.includes('GENVÄGAR'))?.documents
          .length || 0
      const subLists = af.sections.reduce(
        (sum, s) => sum + s.subLists.length,
        0
      )
      return `"${af.name}","${af.pageId}","${af.url}",${af.totalDocuments},${af.sections.length},${shortcuts},${subLists},${af.newsItems.length}`
    })
    .join('\n')
  fs.writeFileSync(afCsvPath, afCsvHeader + afCsvRows)
  console.log(`Ämnesfokus summary saved: ${afCsvPath}`)

  // Save Ämnesfokus shortcuts (GENVÄGAR) as separate CSV with all document details
  const afDocsCsvPath = path.join(OUTPUT_DIR, 'amnesfokus-documents.csv')
  const afDocsCsvHeader = 'Ämnesfokus,Section,Document Title,SFS,Type,Link\n'
  const afDocsCsvRows = results.amnesfokusPages
    .flatMap((af) =>
      af.sections.flatMap((sec) =>
        sec.documents.map(
          (doc) =>
            `"${af.name}","${sec.sectionName}","${doc.title.replace(/"/g, '""')}","${doc.sfs || ''}","${doc.type}","${doc.link}"`
        )
      )
    )
    .join('\n')
  fs.writeFileSync(afDocsCsvPath, afDocsCsvHeader + afDocsCsvRows)
  console.log(`Ämnesfokus documents saved: ${afDocsCsvPath}`)

  // Save Ämnesfokus sub-lists (for Lagar och förordningar, Myndighetsföreskrifter)
  const afSubListsCsvPath = path.join(OUTPUT_DIR, 'amnesfokus-sublists.csv')
  const afSubListsCsvHeader = 'Ämnesfokus,Section,SubList Name,Link\n'
  const afSubListsCsvRows = results.amnesfokusPages
    .flatMap((af) =>
      af.sections.flatMap((sec) =>
        sec.subLists.map(
          (sub) =>
            `"${af.name}","${sec.sectionName}","${sub.name.replace(/"/g, '""')}","${sub.link}"`
        )
      )
    )
    .join('\n')
  fs.writeFileSync(afSubListsCsvPath, afSubListsCsvHeader + afSubListsCsvRows)
  console.log(`Ämnesfokus sub-lists saved: ${afSubListsCsvPath}`)

  // Save Ämnesfokus news items
  const afNewsCsvPath = path.join(OUTPUT_DIR, 'amnesfokus-news.csv')
  const afNewsCsvHeader = 'Ämnesfokus,Date,SFS,Title,Link\n'
  const afNewsCsvRows = results.amnesfokusPages
    .flatMap((af) =>
      af.newsItems.map(
        (news) =>
          `"${af.name}","${news.date}","${news.sfs}","${news.title.replace(/"/g, '""')}","${news.link}"`
      )
    )
    .join('\n')
  fs.writeFileSync(afNewsCsvPath, afNewsCsvHeader + afNewsCsvRows)
  console.log(`Ämnesfokus news saved: ${afNewsCsvPath}`)

  // Save Laglistor documents CSV
  const llCsvPath = path.join(OUTPUT_DIR, 'laglistor-documents.csv')
  const llCsvHeader =
    'Laglista,Section Number,Section Name,Index,SFS Number,Amendment SFS,Document Name,Notisum Comment,Summary (Så här påverkas vi),Compliance,Link\n'
  const llCsvRows = results.laglistor
    .flatMap((ll) =>
      ll.sections.flatMap((sec) =>
        sec.documents.map(
          (doc) =>
            `"${ll.name}","${sec.sectionNumber}","${sec.sectionName}","${doc.index}","${doc.sfsNumber}","${doc.amendmentSfs || ''}",` +
            `"${doc.documentName.replace(/"/g, '""')}","${(doc.notisumComment || '').replace(/"/g, '""').replace(/\n/g, ' ')}",` +
            `"${(doc.summaryText || '').replace(/"/g, '""').replace(/\n/g, ' ')}","${(doc.complianceText || '').replace(/"/g, '""').replace(/\n/g, ' ')}","${doc.link || ''}"`
        )
      )
    )
    .join('\n')
  fs.writeFileSync(llCsvPath, llCsvHeader + llCsvRows)
  console.log(`Laglistor documents saved: ${llCsvPath}`)

  // ========================================
  // PRINT SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(70))
  console.log('SCRAPING COMPLETE')
  console.log('='.repeat(70))
  console.log(`Ämnesfokus pages scraped: ${results.summary.totalAmnesfokus}`)
  console.log(`Laglistor scraped: ${results.summary.totalLaglistor}`)
  console.log(
    `Total documents in Laglistor: ${results.summary.totalDocumentsInLaglistor}`
  )
  console.log('\nFiles created:')
  console.log(`  - ${jsonPath}`)
  console.log(`  - ${afCsvPath}`)
  console.log(`  - ${llCsvPath}`)
  console.log(`  - Screenshots in: ${SCREENSHOT_DIR}`)
}

main().catch(console.error)
