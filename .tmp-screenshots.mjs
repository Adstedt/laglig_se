import { chromium } from '@playwright/test'

const outDir = '/Users/alexanderadstedt/Desktop/dev/laglig_se.nosync/laglig_se/_prototypes/landing-v2-screenshots'
const fs = await import('node:fs')
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto('http://localhost:3000/landing-v2', { waitUntil: 'networkidle', timeout: 60_000 })
await page.waitForTimeout(800)

// 1. Hero (above the fold)
await page.screenshot({ path: `${outDir}/01-hero.png` })
console.log('1. hero done')

// 2. Risk section
await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/02-risk.png` })
console.log('2. risk done')

// 3. Features row 1 + 2 (the bento) — scroll to features heading
await page.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find(el => el.textContent?.includes('Vi håller koll'))
  if (h) h.scrollIntoView({ block: 'start', behavior: 'instant' })
})
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/03-features-top.png`, fullPage: false })
console.log('3. features-top done')

// 4. Features row 3 — Compliance management (new)
await page.evaluate(() => {
  const h = [...document.querySelectorAll('span')].find(el => el.textContent?.trim() === 'Compliance management')
  if (h) h.scrollIntoView({ block: 'center', behavior: 'instant' })
})
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/04-features-compliance-mgmt.png` })
console.log('4. features-compliance done')

// 5. Click Krav & bevis card to expand
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('h3')]
  const t = cards.find(el => el.textContent?.includes('Krav'))
  if (t) {
    const card = t.closest('.cursor-pointer')
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const h = [...document.querySelectorAll('span')].find(el => el.textContent?.trim() === 'Compliance management')
  if (h) h.scrollIntoView({ block: 'start', behavior: 'instant' })
})
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/05-features-krav-expanded.png` })
console.log('5. krav-expanded done')

// 6. Free database section (new)
await page.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find(el => el.textContent?.includes('Slå upp en lag'))
  if (h) h.scrollIntoView({ block: 'center', behavior: 'instant' })
})
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/06-free-database.png` })
console.log('6. free-db done')

// 7. Hover navbar Regelverk to show dropdown
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(300)
const btn = page.getByRole('button', { name: 'Regelverk' })
await btn.hover()
await page.waitForTimeout(500)
await page.screenshot({ path: `${outDir}/07-navbar-dropdown.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } })
console.log('7. navbar done')

// 8. Full page (long screenshot for full review)
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(300)
await page.screenshot({ path: `${outDir}/08-fullpage.png`, fullPage: true })
console.log('8. fullpage done')

await browser.close()
console.log('all done →', outDir)
