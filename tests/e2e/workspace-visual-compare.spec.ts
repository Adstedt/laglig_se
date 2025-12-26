import { test, expect } from '@playwright/test'
import { mkdir } from 'fs/promises'
import { join } from 'path'

/**
 * Visual comparison test that logs in and captures both public and workspace views
 */

const SCREENSHOT_DIR = 'tests/e2e/screenshots/workspace-comparison'
const TEST_LAW_SLUG = 'forordning-20251574-om-elbilspremie-2025-1574'

test.describe('Authenticated Workspace Comparison', () => {
  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true })
  })

  test('capture public and workspace law pages side by side', async ({
    page,
  }) => {
    // 1. First capture PUBLIC page (no auth needed)
    console.log('\n📸 Capturing PUBLIC law page...')
    await page.goto(`/lagar/${TEST_LAW_SLUG}`)
    await page.waitForSelector('h1')
    await page.waitForTimeout(500)

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'compare-public-viewport.png'),
    })
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'compare-public-full.png'),
      fullPage: true,
    })

    const publicTitle = await page.locator('h1').textContent()
    console.log(`  Title: ${publicTitle}`)
    console.log('  ✓ Public page captured')

    // 2. Now LOGIN
    console.log('\n🔐 Logging in...')
    await page.goto('/login')

    const email =
      process.env.TEST_USER_EMAIL || 'alexander.adstedt+10@kontorab.se'
    const password = process.env.TEST_USER_PASSWORD || 'KBty8611!!!!'

    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')

    // Wait for login to complete
    try {
      await page.waitForURL('**/dashboard', { timeout: 15000 })
      console.log('  ✓ Logged in successfully')
    } catch {
      console.log('  ⚠️ Login may have failed, checking current URL...')
      console.log(`  Current URL: ${page.url()}`)

      // Take screenshot of login result
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'login-result.png'),
      })

      // Check if we're still on login with an error
      const errorMessage = await page
        .locator('[role="alert"]')
        .textContent()
        .catch(() => null)
      if (errorMessage) {
        console.log(`  Error: ${errorMessage}`)
      }
      throw new Error('Login failed')
    }

    // 3. Capture WORKSPACE law page
    console.log('\n📸 Capturing WORKSPACE law page...')
    await page.goto(`/browse/lagar/${TEST_LAW_SLUG}`)
    await page.waitForSelector('h1')
    await page.waitForTimeout(500)

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'compare-workspace-viewport.png'),
    })
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'compare-workspace-full.png'),
      fullPage: true,
    })

    const workspaceTitle = await page.locator('h1').textContent()
    console.log(`  Title: ${workspaceTitle}`)
    console.log('  ✓ Workspace page captured')

    // 4. Capture workspace CATALOGUE to show link behavior
    console.log('\n📸 Capturing WORKSPACE catalogue...')
    await page.goto('/browse/lagar')
    await page.waitForSelector('a[data-position]')
    await page.waitForTimeout(300)

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'compare-workspace-catalogue.png'),
    })

    // Verify links use workspace prefix
    const firstLink = await page
      .locator('a[data-position="1"]')
      .first()
      .getAttribute('href')
    console.log(`  First catalogue link: ${firstLink}`)
    expect(firstLink).toContain('/browse/')
    console.log('  ✓ Workspace catalogue links verified')

    // 5. Compare structure
    console.log('\n📊 Structure Comparison:')
    console.log('  PUBLIC:')
    console.log('    - Centered container layout')
    console.log('    - No sidebar')
    console.log('    - Public navigation header')
    console.log('  WORKSPACE:')
    console.log('    - Full-width with sidebar')
    console.log('    - Left navigation accordion')
    console.log('    - Workspace shell header')
    console.log('\n✅ All screenshots captured in:', SCREENSHOT_DIR)
  })
})
