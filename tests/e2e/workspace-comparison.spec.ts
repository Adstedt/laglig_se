import { test, expect } from '@playwright/test'
import { mkdir } from 'fs/promises'
import { join } from 'path'

/**
 * Visual comparison between public and workspace law pages
 *
 * This test captures screenshots of both versions to compare UX differences:
 * - Public page: Full-width layout, own breadcrumbs
 * - Workspace page: Sidebar layout, workspace breadcrumbs, stays in authenticated context
 */

const SCREENSHOT_DIR = 'tests/e2e/screenshots/workspace-comparison'

// Sample law slugs to test - use actual slugs from the database
const TEST_LAWS = [
  'forordning-20251574-om-elbilspremie-2025-1574',
  'forordning-20251568-om-avgifter-som-ror-typgodkannande-inom-vagtrafikomradet-2025-1568',
]

test.describe('Public vs Workspace Law Page Comparison', () => {
  test.beforeAll(async () => {
    // Create screenshot directory
    await mkdir(SCREENSHOT_DIR, { recursive: true })
  })

  test('capture public law page layout', async ({ page }) => {
    const slug = TEST_LAWS[0]

    // Navigate to public law page
    await page.goto(`/lagar/${slug}`)

    // Wait for content to load
    await page.waitForSelector('h1')
    await page.waitForTimeout(500) // Allow animations to settle

    // Take full page screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `public-law-${slug}-full.png`),
      fullPage: true,
    })

    // Take viewport screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `public-law-${slug}-viewport.png`),
    })

    // Verify key elements exist
    await expect(page.locator('h1')).toBeVisible()

    // Public pages use Breadcrumb component with nav element
    const breadcrumb = page.locator('nav').first()
    await expect(breadcrumb).toBeVisible()

    console.log(`✓ Public page screenshot: ${slug}`)
  })

  test('capture workspace law page layout (requires auth)', async ({
    page,
  }) => {
    const slug = TEST_LAWS[0]

    // Try to access workspace page directly
    await page.goto(`/browse/lagar/${slug}`)

    // Check if we got redirected to login
    const currentUrl = page.url()

    if (currentUrl.includes('/login')) {
      console.log('⚠️ Workspace requires authentication - capturing login page')

      await page.screenshot({
        path: join(SCREENSHOT_DIR, `workspace-login-redirect.png`),
      })

      // Skip the rest if not authenticated
      test.skip(true, 'Authentication required - run with auth setup')
      return
    }

    // Wait for content to load
    await page.waitForSelector('h1')
    await page.waitForTimeout(500)

    // Take full page screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `workspace-law-${slug}-full.png`),
      fullPage: true,
    })

    // Take viewport screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `workspace-law-${slug}-viewport.png`),
    })

    // Verify workspace-specific elements
    await expect(page.locator('h1')).toBeVisible()

    // Check for sidebar presence (workspace layout)
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()

    console.log(`✓ Workspace page screenshot: ${slug}`)
  })

  test('compare page structure differences', async ({ page }) => {
    const slug = TEST_LAWS[0]

    // Capture public page structure
    await page.goto(`/lagar/${slug}`)
    await page.waitForSelector('h1')

    const publicStructure = {
      title: await page.locator('h1').textContent(),
      hasSidebar: (await page.locator('aside').count()) > 0,
      hasNav: (await page.locator('nav').count()) > 0,
      containerMaxWidth: await page.evaluate(() => {
        const container = document.querySelector('.container')
        return container ? getComputedStyle(container).maxWidth : 'none'
      }),
      mainWidth: await page.evaluate(() => {
        const main = document.querySelector('main')
        return main ? main.getBoundingClientRect().width : 0
      }),
    }

    console.log('\n📊 Public Page Structure:')
    console.log(JSON.stringify(publicStructure, null, 2))

    // Try workspace page
    await page.goto(`/browse/lagar/${slug}`)

    if (!page.url().includes('/login')) {
      await page.waitForSelector('h1')

      const workspaceStructure = {
        title: await page.locator('h1').textContent(),
        hasSidebar: (await page.locator('aside').count()) > 0,
        hasNav: (await page.locator('nav').count()) > 0,
        containerMaxWidth: await page.evaluate(() => {
          const container = document.querySelector('.container')
          return container ? getComputedStyle(container).maxWidth : 'none'
        }),
        mainWidth: await page.evaluate(() => {
          const main = document.querySelector('main')
          return main ? main.getBoundingClientRect().width : 0
        }),
      }

      console.log('\n📊 Workspace Page Structure:')
      console.log(JSON.stringify(workspaceStructure, null, 2))

      // Compare key differences
      console.log('\n🔍 Key Differences:')
      console.log(
        `- Has Sidebar: Public=${publicStructure.hasSidebar}, Workspace=${workspaceStructure.hasSidebar}`
      )
      console.log(
        `- Main width: Public=${publicStructure.mainWidth}px, Workspace=${workspaceStructure.mainWidth}px`
      )
    } else {
      console.log('\n⚠️ Cannot compare workspace (requires auth)')
    }
  })
})

test.describe('Catalogue Link Behavior', () => {
  test('public catalogue links to public detail pages', async ({ page }) => {
    await page.goto('/rattskallor/lagar')
    await page.waitForSelector('a[data-position]')

    // Get first result link
    const firstResult = page.locator('a[data-position="1"]').first()
    const href = await firstResult.getAttribute('href')

    console.log(`Public catalogue first link: ${href}`)

    // Should link to /lagar/... (not /browse/lagar/...)
    expect(href).toMatch(/^\/lagar\//)
    expect(href).not.toContain('/browse/')

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'public-catalogue-links.png'),
    })
  })

  test('workspace catalogue links to workspace detail pages', async ({
    page,
  }) => {
    await page.goto('/browse/lagar')

    if (page.url().includes('/login')) {
      test.skip(true, 'Authentication required')
      return
    }

    await page.waitForSelector('a[data-position]')

    // Get first result link
    const firstResult = page.locator('a[data-position="1"]').first()
    const href = await firstResult.getAttribute('href')

    console.log(`Workspace catalogue first link: ${href}`)

    // Should link to /browse/lagar/... (workspace prefix)
    expect(href).toMatch(/^\/browse\/lagar\//)

    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'workspace-catalogue-links.png'),
    })
  })
})
