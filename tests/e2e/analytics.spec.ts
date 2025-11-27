import { test, expect } from '@playwright/test'

test.describe('Analytics', () => {
  test('Analytics script loads', async ({ page }) => {
    await page.goto('/')
    const script = page.locator('script[src*="vercel-analytics"]')
    await expect(script).toBeAttached({ timeout: 5000 })
  })

  test('SpeedInsights script loads', async ({ page }) => {
    await page.goto('/')
    const script = page.locator('script[src*="speed-insights"]')
    await expect(script).toBeAttached({ timeout: 5000 })
  })

  test('No console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    await page.click('text=Funktioner')
    const analyticsErrors = errors.filter(
      (e) => e.includes('analytics') || e.includes('vitals')
    )
    expect(analyticsErrors).toHaveLength(0)
  })
})
