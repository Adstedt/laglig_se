// Generate Linear-style focal "partial" screenshots for the landing-v3 mobile
// fallback: capture each surface at scale 1, then crop to the most legible,
// meaningful region (the rest bleeds off behind a fade in the UI). Run with the
// dev server on :3000:  node scripts/capture-landing-mobile-shots.mjs
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const OUT = 'public/images/landing-v3'

// Focal crop per surface, as fractions {l,t,w,h} of the full capture. Tuned so
// that, shown fit-to-width on a ~390px phone, text stays readable (~10–12px).
const TARGETS = [
  { id: 'cap-hero', file: 'hero', crop: { l: 0.0, t: 0.05, w: 0.47, h: 0.66 } },
  { id: 'cap-efterlevnad', file: 'showcase-efterlevnad', crop: { l: 0.0, t: 0.06, w: 0.46, h: 0.5 } },
  { id: 'cap-lagandringar', file: 'showcase-lagandringar', crop: { l: 0.09, t: 0.185, w: 0.5, h: 0.56 } },
  { id: 'cap-uppgifter', file: 'showcase-uppgifter', crop: { l: 0.0, t: 0.085, w: 0.44, h: 0.9 } },
  { id: 'cap-styrdokument', file: 'showcase-styrdokument', crop: { l: 0.0, t: 0.075, w: 0.46, h: 0.52 } },
  { id: 'cap-kontroll', file: 'showcase-kontroll', crop: { l: 0.0, t: 0.075, w: 0.46, h: 0.46 } },
]

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({
  viewport: { width: 1760, height: 1400 },
  deviceScaleFactor: 2,
})

await page.goto('http://localhost:3000/cap-shot', {
  waitUntil: 'domcontentloaded',
})

const reject = page.getByRole('button', { name: /Bara nödvändiga/i })
try {
  await reject.first().click({ timeout: 5000 })
} catch {
  // banner may already be dismissed
}

await page.evaluate(() => {
  document.querySelectorAll('body *').forEach((el) => {
    if (getComputedStyle(el).position === 'fixed') el.style.display = 'none'
  })
})

await page.locator('#cap-hero').waitFor({ state: 'visible', timeout: 30000 })
await page.locator('#cap-kontroll').waitFor({ state: 'visible', timeout: 30000 })
await page.waitForTimeout(4000)

for (const t of TARGETS) {
  const el = page.locator(`#${t.id}`)
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const buf = await el.screenshot()
  const img = sharp(buf)
  const meta = await img.metadata()
  const left = Math.round(meta.width * t.crop.l)
  const top = Math.round(meta.height * t.crop.t)
  const width = Math.min(Math.round(meta.width * t.crop.w), meta.width - left)
  const height = Math.min(Math.round(meta.height * t.crop.h), meta.height - top)
  await sharp(buf)
    .extract({ left, top, width, height })
    .webp({ quality: 86 })
    .toFile(`${OUT}/${t.file}.webp`)
  console.log(`✓ ${t.file}.webp  crop ${width}x${height}  (src ${meta.width}x${meta.height})`)
}

await browser.close()
console.log('done')
