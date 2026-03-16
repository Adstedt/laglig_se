import { chromium } from 'playwright'

const BASE = 'https://laglig-se.vercel.app'
const EMAIL = 'alexander.adstedt+10@kontorab.se'
const PASSWORD = 'KBty8611!!!!'

const PAGES = [
  {
    label: '2025:1568',
    path: '/browse/lagar/forordning-20251568-om-avgifter-som-ror-typgodkann-2025-1568',
  },
  {
    label: '2025:1507',
    path: '/browse/lagar/cybersakerhetsforordning-20251507-2025-1507',
  },
  {
    label: '2025:1535',
    path: '/browse/lagar/forordning-20251535-om-vard-av-statens-konst-2025-1535',
  },
  {
    label: '2025:1574',
    path: '/browse/lagar/forordning-20251574-om-elbilspremie-2025-1574',
  },
  {
    label: '1977:1160',
    path: '/browse/lagar/arbetsmiljolag-19771160-1977-1160',
  },
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage()

  // Login
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30000,
  })
  await page.waitForLoadState('networkidle')
  // Select workspace
  const ws = page.locator('text=Grro').first()
  if (await ws.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ws.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  }

  for (const { label, path } of PAGES) {
    await page.goto(`${BASE}${path}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(2000)

    const info = await page.evaluate(() => {
      const doc = document.querySelector('.legal-document')
      if (!doc) return { error: 'No .legal-document' }

      // Raw tag analysis
      const allH3 = doc.querySelectorAll('h3')
      const h3Info = Array.from(allH3)
        .slice(0, 5)
        .map((h3) => ({
          class: h3.className,
          id: h3.id,
          text: h3.textContent?.trim().substring(0, 80),
          outerStart: h3.outerHTML.substring(0, 120),
        }))

      const allSections = doc.querySelectorAll('section')
      const sectionInfo = Array.from(allSections)
        .slice(0, 5)
        .map((s) => ({
          class: s.className,
          id: s.id,
        }))

      const allFooters = doc.querySelectorAll('footer')
      const footerInfo = Array.from(allFooters).map((f) => ({
        class: f.className,
        text: f.textContent?.trim().substring(0, 100),
      }))

      // Check article nesting
      const articles = doc.querySelectorAll('article')
      const innerArticle = doc.querySelector('article.legal-document')

      // First 500 chars of innerHTML
      const htmlPreview = doc.innerHTML.substring(0, 500)

      return {
        h3Count: allH3.length,
        h3Info,
        sectionCount: allSections.length,
        sectionInfo,
        footerInfo,
        articleCount: articles.length,
        hasInnerArticle: !!innerArticle,
        paragrafs: doc.querySelectorAll('a.paragraf').length,
        htmlPreview,
      }
    })

    console.log(`\n=== ${label} ===`)
    console.log(JSON.stringify(info, null, 2))
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
