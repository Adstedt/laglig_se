import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
  username: process.env.NOTISUM_USERNAME || 'pr32602',
  password: process.env.NOTISUM_PASSWORD || 'KBty8611!',
  baseUrl: process.env.NOTISUM_BASE_URL || 'https://www.notisum.se',
  outputDir: path.join(__dirname, '../output/laglistor-data'),
  timeout: 60000,
  slowMo: 300,
}

const LAGLISTOR = [
  {
    name: 'Lista-72162',
    url: 'https://www.notisum.se/Rn/lawlist/?listid=72162',
    id: 'lista-72162',
  },
]

// Full list (add back when testing is complete):
// { name: 'Lista-68381', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=68381', id: 'lista-68381' },
// { name: 'Lista-68304', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=68304', id: 'lista-68304' },
// { name: 'Lista-2172', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=2172', id: 'lista-2172' },
// { name: 'Lista-70895', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=70895', id: 'lista-70895' },
// { name: 'Lista-70894', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=70894', id: 'lista-70894' },
// { name: 'Lista-8467', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=8467', id: 'lista-8467' },
// { name: 'Lista-26487', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=26487', id: 'lista-26487' },
// { name: 'Lista-11145', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=11145', id: 'lista-11145' },
// { name: 'Lista-797', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=797', id: 'lista-797' },
// { name: 'Lista-1728', url: 'https://www.notisum.se/Rn/Wide2.aspx?pageid=521&listid=1728', id: 'lista-1728' },

interface LawEntry {
  category: string
  sfs: string
  beteckning: string
  'beteckning-senast-utgåva': string
  titel: string
  beskrivning: string
  uppdateringsdatum: string
  url?: string
  påverkan?: string
}

interface LaglistaData {
  name: string
  url: string
  scrapedAt: string
  totalEntries: number
  entries: LawEntry[]
}

class LaglistorScraperV2 {
  private browser: Browser | null = null
  private page: Page | null = null

  async init() {
    console.log('🚀 Initializing Laglistor Scraper V2...')
    this.browser = await chromium.launch({
      headless: false,
      slowMo: CONFIG.slowMo,
    })
    this.page = await this.browser.newPage()
    await this.page.setViewportSize({ width: 1920, height: 1080 })

    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true })
    }
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized')

    console.log('🔐 Logging into Notisum...')
    await this.page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' })

    // Click the login button using page.click which is more reliable
    try {
      await this.page.click('a:has-text("Logga in till Notisum")', {
        timeout: 5000,
      })
      await this.page.waitForLoadState('networkidle')
      await this.page.waitForTimeout(2000)
    } catch (e) {
      console.log('  (Login button not found or already on login page)')
    }

    // Fill in credentials
    await this.page.fill('input[type="text"]', CONFIG.username)
    await this.page.fill('input[type="password"]', CONFIG.password)
    console.log('✅ Credentials filled')

    console.log('\n⚠️  ===============================================')
    console.log('⚠️  PLEASE SOLVE THE RECAPTCHA AND CLICK LOGIN')
    console.log('⚠️  ===============================================\n')

    await this.page.waitForNavigation({
      timeout: 300000,
      waitUntil: 'networkidle',
    })
    console.log('✅ Login successful!')
  }

  async scrapeLaglista(laglista: {
    name: string
    url: string
    id: string
  }): Promise<LaglistaData> {
    if (!this.page) throw new Error('Page not initialized')

    console.log(`\n📋 Scraping: ${laglista.name}`)
    await this.page.goto(laglista.url, { waitUntil: 'networkidle' })
    await this.page.waitForTimeout(3000)

    // TEST: Skip expanding to see if content is already expanded
    console.log('📂 Skipping expand (testing if already expanded)...')
    // await this.expandAllCategories();
    await this.page.waitForTimeout(3000)

    // Scroll to load everything
    console.log('⬇️  Scrolling to load all content...')
    await this.autoScroll()

    // Take full screenshot
    const screenshotPath = path.join(
      CONFIG.outputDir,
      `${laglista.id}_full.png`
    )
    await this.page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`📸 Screenshot saved: ${screenshotPath}`)

    // Extract all law entries
    console.log('📝 Extracting all law entries...')
    const entries = await this.extractAllLaws()

    console.log(`✅ Extracted ${entries.length} law entries`)

    return {
      name: laglista.name,
      url: laglista.url,
      scrapedAt: new Date().toISOString(),
      totalEntries: entries.length,
      entries,
    }
  }

  async expandAllCategories() {
    if (!this.page) return

    console.log('  🔘 Checking if sections need to be expanded...')

    try {
      // Check if content is already expanded by counting visible law entries
      const visibleLaws = await this.page.evaluate(() => {
        const tables = document.querySelectorAll('table')
        let count = 0
        tables.forEach((table) => {
          const rows = table.querySelectorAll('tr')
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td')
            if (cells.length >= 2) {
              const secondCell = cells[1].textContent || ''
              if (
                secondCell.match(/SFS\s*\d{4}:\d+/i) ||
                secondCell.length > 100
              ) {
                count++
              }
            }
          })
        })
        return count
      })

      console.log(
        `  📊 Found ${visibleLaws} potentially visible laws before expanding`
      )

      // Only click expand if we found very few laws (likely collapsed)
      if (visibleLaws < 10) {
        await this.page.click('text=Öppna / Stäng rubriker', { timeout: 5000 })
        console.log(
          '  ✅ Clicked expand button, waiting for sections to load...'
        )
        await this.page.waitForTimeout(5000)
      } else {
        console.log('  ✅ Content already expanded, skipping button click\n')
        await this.page.waitForTimeout(2000)
      }

      console.log('  ✅ Sections ready!\n')
    } catch (e) {
      console.log(
        '  ⚠️  Could not find expand button, sections may already be expanded'
      )
    }
  }

  async autoScroll() {
    if (!this.page) return

    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0
        const distance = 500
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight) {
            clearInterval(timer)
            window.scrollTo(0, 0) // Scroll back to top
            resolve()
          }
        }, 100)
      })
    })

    await this.page.waitForTimeout(10000) // Increased wait time for content to load
  }

  async extractAllLaws(): Promise<LawEntry[]> {
    if (!this.page) return []

    // First, let's diagnose the page structure
    const pageInfo = await this.page.evaluate(() => {
      return {
        tables: document.querySelectorAll('table').length,
        divs: document.querySelectorAll('div').length,
        sfsMatches:
          document.body.innerHTML.match(/SFS\s*\d{4}:\d+/gi)?.length || 0,
        afsMatches:
          document.body.innerHTML.match(/AFS\s*\d{4}:\d+/gi)?.length || 0,
      }
    })

    console.log(
      `  🔍 Page structure: ${pageInfo.tables} tables, ${pageInfo.divs} divs, ${pageInfo.sfsMatches} SFS matches, ${pageInfo.afsMatches} AFS matches`
    )

    const entries = await this.page.evaluate(() => {
      const results: any[] = []
      let currentCategory = 'Ingen kategori'

      // Helper function to find category headers in the DOM
      const findCategoryFromContext = (element: Element): string | null => {
        // Look backwards in the DOM to find a category header
        let current: Element | null = element

        while (current) {
          const text = current.textContent?.trim() || ''

          // Match category patterns like "01 ALLMÄNNA REGLER", "02 HR", etc.
          if (text.match(/^0\d\s+[A-ZÅÄÖ]/i) && text.length < 60) {
            return text
          }

          // Check previous sibling
          if (current.previousElementSibling) {
            current = current.previousElementSibling
          } else if (current.parentElement) {
            // Go up to parent and try its previous sibling
            current = current.parentElement.previousElementSibling
          } else {
            break
          }
        }

        return null
      }

      // Find all table rows in the document
      const allTables = Array.from(document.querySelectorAll('table'))

      for (const table of allTables) {
        // Check if there's a category header before or within this table
        const categoryCandidate = findCategoryFromContext(table)
        if (categoryCandidate) {
          currentCategory = categoryCandidate
        }

        const rows = Array.from(table.querySelectorAll('tr'))

        for (const row of rows) {
          // Check if this row itself is a category header
          const cells = Array.from(row.querySelectorAll('td, th'))

          // Check for category header row
          for (const cell of cells) {
            const cellText = cell.textContent?.trim() || ''
            if (cellText.match(/^0\d\s+[A-ZÅÄÖ]/i) && cellText.length < 60) {
              currentCategory = cellText
              break
            }
          }

          // Check if this row contains law data (2 cells minimum)
          if (cells.length >= 2) {
            const firstCell = cells[0] as any
            const secondCell = cells[1] as any

            const firstCellText = firstCell?.textContent?.trim() || ''
            const secondCellText = secondCell?.textContent?.trim() || ''

            // Skip if it's a category header row
            if (firstCellText.match(/^0\d\s+[A-ZÅÄÖ]/i)) {
              continue
            }

            // Check if second cell contains law information
            const hasSFS = secondCellText.match(/SFS\s*\d{4}:\d+/i)
            const hasOtherRef = secondCellText.match(
              /(SCB-FS|AFS|MSBFS|ELSÄK-FS|[A-ZÅÄÖ]+-FS)\s*\d{4}:\d+/i
            )
            const hasEURef = secondCellText.match(/\(EU\)\s*nr\s*\d+\/\d+/i)
            const isLongEnough = secondCellText.length > 30

            if (
              (hasSFS || hasOtherRef || hasEURef || isLongEnough) &&
              !firstCellText.includes('Antal dokument')
            ) {
              // Extract URL from anchor tag in second cell
              let url = ''
              const anchor = secondCell.querySelector('a')
              if (anchor && anchor.href) {
                url = anchor.href
              }

              // Clean the text first - remove "Beteckning" prefix that appears before references
              let cleanedCellText = secondCellText.replace(
                /^Beteckning\s*/i,
                ''
              )

              // Extract ALL types of law references (SFS, SCB-FS, AFS, MSBFS, etc.)
              const allSFS = cleanedCellText.match(/SFS\s*\d{4}:\d+/gi) || []
              const allOtherRefs =
                cleanedCellText.match(
                  /(SCB-FS|AFS|MSBFS|ELSÄK-FS|[A-ZÅÄÖ]+-FS)\s*\d{4}:\d+/gi
                ) || []
              const allEURefs =
                cleanedCellText.match(/\(EU\)\s*nr\s*\d+\/\d+/gi) || []

              // Combine all references
              const allRefs = [...allSFS, ...allOtherRefs, ...allEURefs]

              // Primary reference (SFS if exists, otherwise first other ref)
              const primarySFS =
                allSFS[0] || allOtherRefs[0] || allEURefs[0] || ''
              const lastSFS =
                allSFS[allSFS.length - 1] ||
                allOtherRefs[allOtherRefs.length - 1] ||
                allEURefs[allEURefs.length - 1] ||
                primarySFS

              // User doesn't need the title field - skip extraction
              const titel = ''

              // Get full text and clean it step by step
              let cleanedText = secondCellText

              // Step 1: Remove the word "Beteckning" at the very beginning
              cleanedText = cleanedText.replace(/^Beteckning\s*/i, '')

              // Step 2: Remove all references (SFS, AFS, MSBFS, EU, etc.)
              allRefs.forEach((ref: string) => {
                const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                cleanedText = cleanedText.replace(
                  new RegExp(escapedRef, 'g'),
                  ''
                )
              })

              // Step 3: Remove common extra text patterns
              // Remove "Notisum innehåller kommentarer..." and similar
              cleanedText = cleanedText.replace(
                /Notisum innehåller kommentarer[^.]*\./gi,
                ''
              )
              cleanedText = cleanedText.replace(
                /Notisum har kommentarer[^.]*\./gi,
                ''
              )

              // Remove "(ersätter ...)" text
              cleanedText = cleanedText.replace(/\(ersätter[^)]*\)/gi, '')

              // Remove chapter references
              cleanedText = cleanedText.replace(/\(\d+\s+kap[^)]*\)/gi, '')

              // Step 5: Clean up excessive whitespace and leading punctuation
              cleanedText = cleanedText.replace(/\s+/g, ' ').trim()

              // Remove leading periods, commas, or other punctuation
              cleanedText = cleanedText.replace(/^[.,;:\s]+/, '')

              const beskrivning = cleanedText.trim()

              // Clean up category name - remove leading numbers like "01 "
              const cleanCategory = currentCategory.replace(/^\d{2}\s+/, '')

              const entry: any = {
                category: cleanCategory,
                sfs: primarySFS,
                beteckning: primarySFS,
                'beteckning-senast-utgåva': lastSFS,
                titel: titel,
                beskrivning: beskrivning,
                uppdateringsdatum: lastSFS,
              }

              // Add URL if found
              if (url) {
                entry.url = url
              }

              results.push(entry)
            }
          }
        }
      }

      return results
    })

    return entries
  }

  async saveResults(data: LaglistaData) {
    const jsonPath = path.join(
      CONFIG.outputDir,
      `${data.name.toLowerCase()}.json`
    )
    const csvPath = path.join(
      CONFIG.outputDir,
      `${data.name.toLowerCase()}.csv`
    )
    const mdPath = path.join(CONFIG.outputDir, `${data.name.toLowerCase()}.md`)

    // Save JSON
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8')
    console.log(`✅ JSON saved: ${jsonPath}`)

    // Save CSV
    const csv = this.generateCSV(data)
    fs.writeFileSync(csvPath, csv, 'utf-8')
    console.log(`✅ CSV saved: ${csvPath}`)

    // Save Markdown
    const md = this.generateMarkdown(data)
    fs.writeFileSync(mdPath, md, 'utf-8')
    console.log(`✅ Markdown saved: ${mdPath}`)
  }

  generateCSV(data: LaglistaData): string {
    let csv =
      'Kategori,SFS,Beteckning,Beteckning-senast-utgåva,Titel,Beskrivning,Uppdateringsdatum,Påverkan\n'

    for (const entry of data.entries) {
      const row = [
        entry.category,
        entry.sfs,
        entry.beteckning,
        entry['beteckning-senast-utgåva'],
        entry.titel,
        entry.beskrivning.replace(/"/g, '""').replace(/\n/g, ' '),
        entry.uppdateringsdatum,
        (entry.påverkan || '').replace(/"/g, '""').replace(/\n/g, ' '),
      ]
        .map((field) => `"${field}"`)
        .join(',')

      csv += row + '\n'
    }

    return csv
  }

  generateMarkdown(data: LaglistaData): string {
    let md = `# ${data.name} - Komplett Laglista\n\n`
    md += `**Scraped:** ${data.scrapedAt}\n`
    md += `**URL:** ${data.url}\n`
    md += `**Total entries:** ${data.totalEntries}\n\n`
    md += `---\n\n`

    // Group by category
    const byCategory: { [key: string]: LawEntry[] } = {}
    for (const entry of data.entries) {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = []
      }
      byCategory[entry.category].push(entry)
    }

    for (const [category, entries] of Object.entries(byCategory)) {
      md += `## ${category}\n\n`
      md += `**Antal lagar:** ${entries.length}\n\n`

      for (const entry of entries) {
        md += `### ${entry.sfs} - ${entry.titel}\n\n`
        md += `**Beteckning:** ${entry.beteckning}\n`
        md += `**Beteckning senast utgåva:** ${entry['beteckning-senast-utgåva']}\n`
        md += `**Titel:** ${entry.titel}\n\n`
        md += `**Beskrivning:**\n${entry.beskrivning}\n\n`
        if (entry.påverkan) {
          md += `**Påverkan:**\n${entry.påverkan}\n\n`
        }
        md += `**Uppdateringsdatum:** ${entry.uppdateringsdatum}\n\n`
        md += `---\n\n`
      }
    }

    return md
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close()
      console.log('🧹 Browser closed')
    }
  }

  async run() {
    try {
      await this.init()
      await this.login()

      for (const laglista of LAGLISTOR) {
        const data = await this.scrapeLaglista(laglista)
        await this.saveResults(data)
      }

      console.log('\n✅ All laglistor scraped successfully!')
      console.log(`📁 Results saved to: ${CONFIG.outputDir}`)
    } catch (error) {
      console.error('❌ Scraper failed:', error)
    } finally {
      await this.cleanup()
    }
  }
}

const scraper = new LaglistorScraperV2()
scraper.run().catch(console.error)
