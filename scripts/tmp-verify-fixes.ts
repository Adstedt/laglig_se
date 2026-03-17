import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const EMAIL = 'alexander.adstedt+10@kontorab.se'
const PASSWORD = 'KBty8611!!!!'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 1200 } })
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
  const ws = page.locator('text=Grro').first()
  if (await ws.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ws.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  }

  // Check SFS 2025:1507 — preamble fix + lovhead hidden
  console.log('=== SFS 2025:1507 ===')
  await page.goto(
    `${BASE}/browse/lagar/cybersakerhetsforordning-20251507-2025-1507`,
    { waitUntil: 'networkidle', timeout: 30000 }
  )
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: 'data/review-screenshots/verify-1507-top.png',
    fullPage: false,
  })

  const info1507 = await page.evaluate(() => {
    const doc = document.querySelector('.legal-document')
    if (!doc) return { error: 'No .legal-document' }
    const lovhead = doc.querySelector('.lovhead')
    const h3s = Array.from(doc.querySelectorAll('h3'))
      .slice(0, 6)
      .map((h3) => ({
        class: h3.className,
        text: h3.textContent?.trim().substring(0, 60),
      }))
    return {
      lovheadDisplay: lovhead ? getComputedStyle(lovhead).display : 'n/a',
      first6H3s: h3s,
    }
  })
  console.log(JSON.stringify(info1507, null, 2))

  // Check SFS 2025:1568 — lovhead hidden
  console.log('\n=== SFS 2025:1568 ===')
  await page.goto(
    `${BASE}/browse/lagar/forordning-20251568-om-avgifter-som-ror-typgodkann-2025-1568`,
    { waitUntil: 'networkidle', timeout: 30000 }
  )
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: 'data/review-screenshots/verify-1568-top.png',
    fullPage: false,
  })

  const info1568 = await page.evaluate(() => {
    const doc = document.querySelector('.legal-document')
    if (!doc) return { error: 'No .legal-document' }
    const lovhead = doc.querySelector('.lovhead')
    return {
      lovheadDisplay: lovhead ? getComputedStyle(lovhead).display : 'n/a',
    }
  })
  console.log(JSON.stringify(info1568, null, 2))

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
