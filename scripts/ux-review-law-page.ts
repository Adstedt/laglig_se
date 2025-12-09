import { chromium } from 'playwright'

async function reviewLawPage() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

  const url = 'http://localhost:3000/lagar/arbetsmiljolag-19771160-1977-1160'
  console.log('Navigating to:', url)

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Screenshot 1: Header and top of page
  await page.screenshot({
    path: 'screenshots/ux-review-1-header.png',
    fullPage: false
  })
  console.log('1. Header screenshot saved')

  // Screenshot 2: Scroll to see related documents section
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'screenshots/ux-review-2-related-docs.png',
    fullPage: false
  })
  console.log('2. Related docs section screenshot saved')

  // Screenshot 3: Scroll to chapter 1 content
  await page.evaluate(() => window.scrollTo(0, 800))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'screenshots/ux-review-3-chapter1.png',
    fullPage: false
  })
  console.log('3. Chapter 1 content screenshot saved')

  // Screenshot 4: Scroll to chapter 2 to see chapter heading styling
  const chapter2 = await page.$('h3[name="K2"]')
  if (chapter2) {
    await chapter2.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'screenshots/ux-review-4-chapter2.png',
      fullPage: false
    })
    console.log('4. Chapter 2 heading screenshot saved')
  }

  // Screenshot 5: Scroll to chapter 6 to see future amendment highlight
  const chapter6 = await page.$('h3[name="K6"]')
  if (chapter6) {
    await chapter6.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'screenshots/ux-review-5-chapter6.png',
      fullPage: false
    })
    console.log('5. Chapter 6 screenshot saved')
  }

  // Screenshot 6: Find the future amendment section (17 §)
  const futureAmendment = await page.$('.future-amendment-highlight')
  if (futureAmendment) {
    await futureAmendment.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'screenshots/ux-review-6-future-amendment.png',
      fullPage: false
    })
    console.log('6. Future amendment highlight screenshot saved')
  } else {
    console.log('6. No future amendment highlight found')
  }

  // Screenshot 7: Scroll to bottom to see cross-references
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1000))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'screenshots/ux-review-7-bottom.png',
    fullPage: false
  })
  console.log('7. Bottom section screenshot saved')

  // Screenshot 8: Check floating action button (scroll back up a bit then down)
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(1000)
  await page.screenshot({
    path: 'screenshots/ux-review-8-fab.png',
    fullPage: false
  })
  console.log('8. FAB visibility screenshot saved')

  // Collect page metrics
  console.log('\n--- Page Analysis ---')

  const metrics = await page.evaluate(() => {
    const body = document.body
    const pageHeight = body.scrollHeight

    // Count elements
    const chapters = document.querySelectorAll('h3[name^="K"]').length
    const paragraphs = document.querySelectorAll('a.paragraf').length
    const futureAmendments = document.querySelectorAll('.future-amendment-highlight').length

    // Check for TOC
    const toc = document.querySelector('.sfstoc')

    // Check banner
    const banner = document.querySelector('[class*="amber"]') || document.querySelector('[class*="warning"]')

    // Check related docs section
    const relatedDocs = document.querySelector('[class*="related"]') ||
                        Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Relaterade'))

    // Check FAB
    const fab = document.querySelector('button[class*="fixed"]') ||
                document.querySelector('[class*="floating"]')

    return {
      pageHeight,
      chapters,
      paragraphs,
      futureAmendments,
      hasToc: !!toc,
      hasBanner: !!banner,
      hasRelatedDocs: !!relatedDocs,
      hasFab: !!fab
    }
  })

  console.log('Page height:', metrics.pageHeight, 'px')
  console.log('Chapters:', metrics.chapters)
  console.log('Paragraphs (§):', metrics.paragraphs)
  console.log('Future amendments highlighted:', metrics.futureAmendments)
  console.log('Has TOC:', metrics.hasToc)
  console.log('Has warning banner:', metrics.hasBanner)
  console.log('Has related docs section:', metrics.hasRelatedDocs)
  console.log('Has floating action button:', metrics.hasFab)

  await browser.close()
  console.log('\nDone! Screenshots saved to screenshots/ux-review-*.png')
}

reviewLawPage().catch(console.error)
