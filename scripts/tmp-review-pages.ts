import { chromium } from 'playwright'

const BASE = 'https://laglig-se.vercel.app'
const EMAIL = 'alexander.adstedt+10@kontorab.se'
const PASSWORD = 'KBty8611!!!!'
const WORKSPACE = 'Grro'

const PAGES_TO_REVIEW = [
  // The two just-normalized flat docs
  {
    label: 'SFS 2025:1568 (Typgodkännande)',
    path: '/browse/lagar/forordning-20251568-om-avgifter-som-ror-typgodkann-2025-1568',
  },
  {
    label: 'SFS 2025:1507 (Cybersäkerhet)',
    path: '/browse/lagar/cybersakerhetsforordning-20251507-2025-1507',
  },
  // Previously normalized chaptered docs
  {
    label: 'SFS 1977:1160 (Arbetsmiljölag)',
    path: '/browse/lagar/arbetsmiljolag-19771160-1977-1160',
  },
  {
    label: 'SFS 2025:1535 (Vård av statens konst)',
    path: '/browse/lagar/forordning-20251535-om-vard-av-statens-konst-2025-1535',
  },
  {
    label: 'SFS 2025:1574 (Elbilspremie)',
    path: '/browse/lagar/forordning-20251574-om-elbilspremie-2025-1574',
  },
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  // --- Login ---
  console.log('Logging in...')
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"], input[name="email"]', EMAIL)
  await page.fill('input[type="password"], input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30000,
  })
  await page.waitForLoadState('networkidle')
  console.log('Post-login URL:', page.url())

  // --- Select workspace if needed ---
  const url = page.url()
  if (
    url.includes('workspace') ||
    url.includes('select') ||
    url.includes('onboarding')
  ) {
    console.log('Looking for workspace selection...')
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'data/review-screenshots/00-workspace-select.png',
      fullPage: false,
    })
    // Try clicking the workspace by name
    const wsButton = page.locator(`text=${WORKSPACE}`).first()
    if (await wsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Clicking workspace...')
      await wsButton.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
    }
  }
  console.log('Current URL:', page.url())
  await page.screenshot({
    path: 'data/review-screenshots/00-after-login.png',
    fullPage: false,
  })

  // --- Visit each page ---
  for (let i = 0; i < PAGES_TO_REVIEW.length; i++) {
    const { label, path } = PAGES_TO_REVIEW[i]!
    console.log(`\n--- ${label} ---`)
    console.log(`Navigating to: ${BASE}${path}`)

    await page.goto(`${BASE}${path}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(2000) // Let rendering settle

    const idx = String(i + 1).padStart(2, '0')

    // Top of page screenshot
    await page.screenshot({
      path: `data/review-screenshots/${idx}-${slugify(label)}-top.png`,
      fullPage: false,
    })

    // Full page screenshot
    await page.screenshot({
      path: `data/review-screenshots/${idx}-${slugify(label)}-full.png`,
      fullPage: true,
    })

    // Scroll to middle and screenshot
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight / 2)
    )
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `data/review-screenshots/${idx}-${slugify(label)}-mid.png`,
      fullPage: false,
    })

    // Scroll to bottom and screenshot
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `data/review-screenshots/${idx}-${slugify(label)}-bottom.png`,
      fullPage: false,
    })

    // Collect structural info
    const info = await page.evaluate(() => {
      const doc = document.querySelector('.legal-document')
      if (!doc) return { error: 'No .legal-document found' }

      const chapters = doc.querySelectorAll('section.kapitel')
      const h2s = doc.querySelectorAll('h2')
      const h3paras = doc.querySelectorAll('h3.paragraph')
      const paragrafs = doc.querySelectorAll('a.paragraf')
      const footer = doc.querySelector('footer.back')
      const lovhead = doc.querySelector('.lovhead')
      const tables = doc.querySelectorAll('table')
      const tocEntries = document.querySelectorAll('[class*="toc"] a, nav a')

      // Check for double borders (computed styles)
      const firstKapitel = chapters[0]
      let firstKapitelBorder = ''
      let firstH2Border = ''
      if (firstKapitel) {
        firstKapitelBorder = getComputedStyle(firstKapitel).borderTopWidth
        const h2 = firstKapitel.querySelector('h2')
        if (h2) firstH2Border = getComputedStyle(h2).borderTopWidth
      }

      return {
        hasLegalDocument: true,
        chapters: chapters.length,
        h2s: h2s.length,
        h3paragraphs: h3paras.length,
        paragrafs: paragrafs.length,
        hasFooter: !!footer,
        hasLovhead: !!lovhead,
        lovheadVisible: lovhead
          ? getComputedStyle(lovhead).display !== 'none'
          : false,
        tables: tables.length,
        tocEntries: tocEntries.length,
        firstKapitelBorderTop: firstKapitelBorder,
        firstH2InsideKapitelBorderTop: firstH2Border,
        bodyText: doc.textContent?.substring(0, 200) || '',
      }
    })
    console.log('Structure:', JSON.stringify(info, null, 2))
  }

  await browser.close()
  console.log('\n=== Done. Screenshots saved to data/review-screenshots/ ===')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
