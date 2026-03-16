import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const EMAIL = 'alexander.adstedt+10@kontorab.se'
const PASSWORD = 'KBty8611!!!!'

const PAGES = [
  {
    label: 'SFS 2025:1568 (Typgodkännande)',
    path: '/browse/lagar/forordning-20251568-om-avgifter-som-ror-typgodkann-2025-1568',
  },
  {
    label: 'SFS 2025:1507 (Cybersäkerhet)',
    path: '/browse/lagar/cybersakerhetsforordning-20251507-2025-1507',
  },
  {
    label: 'SFS 2025:1535 (Vård av statens konst)',
    path: '/browse/lagar/forordning-20251535-om-vard-av-statens-konst-2025-1535',
  },
  {
    label: 'SFS 2025:1574 (Elbilspremie)',
    path: '/browse/lagar/forordning-20251574-om-elbilspremie-2025-1574',
  },
  {
    label: 'SFS 1977:1160 (Arbetsmiljölag)',
    path: '/browse/lagar/arbetsmiljolag-19771160-1977-1160',
  },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 1200 } })
  ).newPage()

  // Login
  console.log('Logging in to localhost...')
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30000,
  })
  await page.waitForLoadState('networkidle')
  console.log('Post-login URL:', page.url())

  // Select workspace
  const ws = page.locator('text=Grro').first()
  if (await ws.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ws.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  }
  console.log('Ready:', page.url())

  for (let i = 0; i < PAGES.length; i++) {
    const { label, path } = PAGES[i]!
    const idx = String(i + 1).padStart(2, '0')
    const slug = slugify(label)
    console.log(`\n=== ${label} ===`)

    await page.goto(`${BASE}${path}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(2000)

    // Top screenshot
    await page.screenshot({
      path: `data/review-screenshots/local-${idx}-${slug}-top.png`,
      fullPage: false,
    })

    // Scroll down to content area (past hero card)
    await page.evaluate(() => window.scrollTo(0, 500))
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `data/review-screenshots/local-${idx}-${slug}-content.png`,
      fullPage: false,
    })

    // Scroll to ~40% to see middle sections
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight * 0.4)
    )
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `data/review-screenshots/local-${idx}-${slug}-mid.png`,
      fullPage: false,
    })

    // Scroll to ~80% to see bottom/transition provisions
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight * 0.8)
    )
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `data/review-screenshots/local-${idx}-${slug}-bottom.png`,
      fullPage: false,
    })

    // DOM analysis
    const info = await page.evaluate(() => {
      const doc = document.querySelector('.legal-document')
      if (!doc) return { error: 'No .legal-document found' }

      const allH3 = doc.querySelectorAll('h3')
      const h3Classes = Array.from(allH3)
        .slice(0, 8)
        .map((h3) => ({
          class: h3.className,
          text: h3.textContent?.trim().substring(0, 60),
        }))

      const sections = doc.querySelectorAll('section')
      const sectionClasses = Array.from(sections)
        .slice(0, 5)
        .map((s) => ({
          class: s.className,
          id: s.id,
        }))

      const footer = doc.querySelector('footer')
      const footerClass = footer?.className || null
      const footerText = footer?.textContent?.trim().substring(0, 150) || null

      const articles = doc.querySelectorAll('article')

      // Check for double borders on first kapitel
      const firstKapitel = doc.querySelector('section.kapitel')
      let kapitelBorder = '',
        h2InKapitelBorder = ''
      if (firstKapitel) {
        kapitelBorder =
          getComputedStyle(firstKapitel).borderTopWidth +
          ' ' +
          getComputedStyle(firstKapitel).borderTopStyle
        const h2 = firstKapitel.querySelector('h2')
        if (h2)
          h2InKapitelBorder =
            getComputedStyle(h2).borderTopWidth +
            ' ' +
            getComputedStyle(h2).borderTopStyle
      }

      // Check lovhead visibility
      const lovhead = doc.querySelector('.lovhead')
      const lovheadDisplay = lovhead ? getComputedStyle(lovhead).display : 'n/a'

      return {
        h3Total: allH3.length,
        h3paragraph: doc.querySelectorAll('h3.paragraph').length,
        h3Classes,
        sectionTotal: sections.length,
        sectionKapitel: doc.querySelectorAll('section.kapitel').length,
        sectionClasses,
        paragrafs: doc.querySelectorAll('a.paragraf').length,
        footerBack: doc.querySelectorAll('footer.back').length,
        footerClass,
        footerText,
        articles: articles.length,
        innerArticle: doc.querySelectorAll('article.legal-document').length,
        lovheadDisplay,
        kapitelBorder,
        h2InKapitelBorder,
        firstChars: doc.innerHTML.substring(0, 300),
      }
    })

    console.log(JSON.stringify(info, null, 2))
  }

  await browser.close()
  console.log('\n=== Done ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
