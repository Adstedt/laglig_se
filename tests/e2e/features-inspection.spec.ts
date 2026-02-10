import { test } from '@playwright/test'

test('inspect features section - bento layout', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Set a larger viewport to see the full section
  await page.setViewportSize({ width: 1440, height: 900 })

  // Scroll to features section
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section')
    for (const s of sections) {
      if (s.textContent?.includes('Sluta oroa')) {
        s.scrollIntoView({ behavior: 'instant', block: 'start' })
        break
      }
    }
  })
  await page.waitForTimeout(800)

  // Screenshot initial state (Laglista should be auto-expanded)
  await page.screenshot({
    path: 'test-results/features/01-initial-auto-expanded.png',
    fullPage: false,
  })

  // Scroll down to see the expanded content + bento layout
  await page.evaluate(() => {
    window.scrollBy(0, 150)
  })
  await page.waitForTimeout(300)

  await page.screenshot({
    path: 'test-results/features/02-laglista-expanded.png',
    fullPage: false,
  })

  // Click on Notiser to switch
  const notiserCard = page.locator('h3:has-text("Proaktiva notiser")').first()
  await notiserCard.click()
  await page.waitForTimeout(600)

  await page.screenshot({
    path: 'test-results/features/03-notiser-expanded.png',
    fullPage: false,
  })

  // Scroll down to see AI hero card
  await page.evaluate(() => {
    window.scrollBy(0, 300)
  })
  await page.waitForTimeout(300)

  await page.screenshot({
    path: 'test-results/features/04-ai-hero-visible.png',
    fullPage: false,
  })

  // Click AI hero card
  const aiCard = page.locator('h3:has-text("AI-assistent")').first()
  await aiCard.click({ force: true })
  await page.waitForTimeout(800)

  // Scroll to show AI expanded
  await page.evaluate(() => {
    window.scrollBy(0, 200)
  })
  await page.waitForTimeout(300)

  await page.screenshot({
    path: 'test-results/features/05-ai-expanded.png',
    fullPage: false,
  })

  // Full page screenshot
  await page.screenshot({
    path: 'test-results/features/06-fullpage.png',
    fullPage: true,
  })

  // Mobile view
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(500)

  // Scroll to features section on mobile
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section')
    for (const s of sections) {
      if (s.textContent?.includes('Sluta oroa')) {
        s.scrollIntoView({ behavior: 'instant', block: 'start' })
        break
      }
    }
  })
  await page.waitForTimeout(500)

  await page.screenshot({
    path: 'test-results/features/07-mobile-initial.png',
    fullPage: false,
  })

  // Scroll down on mobile to see more
  await page.evaluate(() => {
    window.scrollBy(0, 400)
  })
  await page.waitForTimeout(300)

  await page.screenshot({
    path: 'test-results/features/08-mobile-scrolled.png',
    fullPage: false,
  })

  // Mobile full page
  await page.screenshot({
    path: 'test-results/features/09-mobile-fullpage.png',
    fullPage: true,
  })
})
