import { chromium } from 'playwright'

async function checkScroll() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || '')
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || '')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|laglistor)/, { timeout: 15000 })

  // Check multiple pages
  const pagesToCheck = [
    '/laglistor',
    '/dashboard',
    '/browse/lagar',
  ]

  for (const pageUrl of pagesToCheck) {
    console.log('\n=== Checking', pageUrl, '===')
    await page.goto('http://localhost:3000' + pageUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Check page dimensions
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const windowWidth = await page.evaluate(() => window.innerWidth)
    const htmlWidth = await page.evaluate(() => document.documentElement.scrollWidth)

    console.log('Window width:', windowWidth)
    console.log('Body scroll width:', bodyWidth)
    console.log('HTML scroll width:', htmlWidth)
    console.log('Has horizontal scroll:', bodyWidth > windowWidth || htmlWidth > windowWidth)

    if (bodyWidth > windowWidth || htmlWidth > windowWidth) {
      // Find elements causing overflow
      const overflowingElements = await page.evaluate(() => {
        const results: string[] = []
        const all = document.querySelectorAll('*')
        const viewportWidth = window.innerWidth

        all.forEach(el => {
          const rect = el.getBoundingClientRect()
          if (rect.right > viewportWidth + 5) {
            const tagName = el.tagName
            const id = el.id ? '#' + el.id : ''
            const classList = el.classList.length > 0 ? '.' + Array.from(el.classList).join('.') : ''
            const overflow = Math.round(rect.right - viewportWidth)
            results.push(tagName + id + classList + ' - right: ' + rect.right + 'px (overflow: ' + overflow + 'px)')
          }
        })
        return results.slice(0, 10)
      })

      console.log('Overflowing elements:')
      overflowingElements.forEach(el => console.log(' -', el))

      await page.screenshot({ path: 'scroll-check-' + pageUrl.replace(/\//g, '-') + '.png', fullPage: false })
    }
  }

  // Also check laglistor in table view
  console.log('\n=== Checking /laglistor (table view) ===')
  await page.goto('http://localhost:3000/laglistor', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Click table view toggle
  const tableToggle = page.getByRole('radio', { name: /tabellvy/i })
  if (await tableToggle.isVisible()) {
    await tableToggle.click()
    await page.waitForTimeout(2000)

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const windowWidth = await page.evaluate(() => window.innerWidth)
    console.log('Window width:', windowWidth)
    console.log('Body scroll width:', bodyWidth)
    console.log('Has horizontal scroll:', bodyWidth > windowWidth)

    if (bodyWidth > windowWidth) {
      const overflowingElements = await page.evaluate(() => {
        const results: string[] = []
        const all = document.querySelectorAll('*')
        const viewportWidth = window.innerWidth

        all.forEach(el => {
          const rect = el.getBoundingClientRect()
          if (rect.right > viewportWidth + 5) {
            const tagName = el.tagName
            const id = el.id ? '#' + el.id : ''
            const classList = el.classList.length > 0 ? '.' + Array.from(el.classList).join('.') : ''
            const overflow = Math.round(rect.right - viewportWidth)
            results.push(tagName + id + classList + ' - right: ' + rect.right + 'px (overflow: ' + overflow + 'px)')
          }
        })
        return results.slice(0, 15)
      })

      console.log('Overflowing elements:')
      overflowingElements.forEach(el => console.log(' -', el))

      await page.screenshot({ path: 'scroll-check-table-view.png', fullPage: false })
    }
  }

  await browser.close()
}

checkScroll().catch(console.error)
