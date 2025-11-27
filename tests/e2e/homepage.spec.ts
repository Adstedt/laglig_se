import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders all main sections', async ({ page }) => {
    // Navbar
    await expect(page.locator('nav')).toBeVisible()
    await expect(
      page.locator('nav').getByRole('link', { name: 'Laglig.se' })
    ).toBeVisible()

    // Hero - bold statement headline
    await expect(
      page.getByRole('heading', { level: 1, name: /lagefterlevnad/i })
    ).toBeVisible()
    await expect(
      page.getByText('Över 1 000 svenska företag använder Laglig.se').first()
    ).toBeVisible()

    // Logo cloud / stats section
    await expect(
      page.getByText('10 000+', { exact: true }).first()
    ).toBeVisible()
    await expect(page.getByText('Svenska lagar indexerade')).toBeVisible()

    // Features section
    await expect(
      page.getByRole('heading', { name: /allt du behöver för fullständig/i })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Personlig laglista' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Proaktiva notiser' })
    ).toBeVisible()

    // How it works section
    await expect(
      page.getByRole('heading', { name: /kom igång på under 3 minuter/i })
    ).toBeVisible()
    await expect(page.getByText('Ange org-nummer')).toBeVisible()

    // Testimonials section
    await expect(
      page.getByRole('heading', { name: /företag som sover gott/i })
    ).toBeVisible()

    // Compliance section
    await expect(
      page.getByRole('heading', { name: /audit-redo på 5 minuter/i })
    ).toBeVisible()

    // Pricing section (defaults to yearly)
    await expect(
      page.getByRole('heading', { name: /enkla, transparenta priser/i })
    ).toBeVisible()
    // Yearly prices: Solo 333 kr/mån (3990/12), Team 749 kr/mån (8990/12)
    await expect(page.getByText('333')).toBeVisible()
    await expect(page.getByText('749')).toBeVisible()

    // FAQ section
    await expect(
      page.getByRole('heading', { name: 'Vanliga frågor' })
    ).toBeVisible()

    // CTA section
    await expect(
      page.getByRole('heading', {
        name: /redo att ta kontroll/i,
      })
    ).toBeVisible()

    // Footer
    await expect(page.locator('footer')).toBeVisible()
    await expect(
      page.getByText('Juridisk ansvarsfriskrivning', { exact: false })
    ).toBeVisible()
  })

  test('navigation links scroll to correct sections', async ({ page }) => {
    // Click on Pricing link in navbar
    await page.getByRole('link', { name: 'Priser' }).first().click()

    // Verify pricing section is in viewport
    const pricingSection = page.locator('#pricing')
    await expect(pricingSection).toBeInViewport()
  })

  test('primary CTA navigates to onboarding', async ({ page }) => {
    await page
      .getByRole('link', { name: /kom igång gratis/i })
      .first()
      .click()
    await expect(page).toHaveURL('/onboarding')
  })

  test('mobile menu opens and closes', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Click hamburger menu
    await page.getByTestId('mobile-menu-trigger').click()

    // Verify menu is visible
    await expect(page.getByRole('dialog')).toBeVisible()

    // Verify menu links are visible
    await expect(
      page.getByRole('dialog').getByRole('link', { name: 'Priser' })
    ).toBeVisible()

    // Close menu
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('FAQ accordion expands and collapses', async ({ page }) => {
    // Find and click FAQ question
    const faqQuestion = page.getByRole('button', {
      name: 'Hur lång tid tar det att komma igång?',
    })
    await faqQuestion.click()

    // Verify answer is visible
    await expect(
      page.getByText('Under 3 minuter. Ange ditt organisationsnummer')
    ).toBeVisible()

    // Click again to collapse
    await faqQuestion.click()

    // Verify answer is hidden
    await expect(
      page.getByText('Under 3 minuter. Ange ditt organisationsnummer')
    ).not.toBeVisible()
  })

  test('pricing toggle switches between monthly and yearly', async ({
    page,
  }) => {
    // Find pricing section
    await page.locator('#pricing').scrollIntoViewIfNeeded()

    // Default is yearly (based on updated pricing section)
    // Click monthly toggle button
    await page.getByRole('button', { name: /månadsvis/i }).click()

    // Should show monthly pricing
    await expect(page.getByText('399').first()).toBeVisible()
    await expect(page.getByText('899').first()).toBeVisible()

    // Click yearly toggle button
    await page.getByRole('button', { name: /årsvis/i }).click()

    // Should show yearly pricing
    await expect(page.getByText('3 990 kr/år')).toBeVisible()
    await expect(page.getByText('8 990 kr/år')).toBeVisible()
  })

  test('pricing cards display correct tier information', async ({ page }) => {
    // Solo tier
    await expect(
      page.getByRole('heading', { name: 'Solo', exact: true })
    ).toBeVisible()
    await expect(page.getByText('För egenföretagare')).toBeVisible()

    // Team tier (highlighted)
    await expect(
      page.getByRole('heading', { name: 'Team', exact: true })
    ).toBeVisible()
    await expect(page.getByText('Populärast')).toBeVisible()

    // Enterprise tier
    await expect(
      page.getByRole('heading', { name: 'Enterprise', exact: true })
    ).toBeVisible()
    await expect(page.getByText('Offert')).toBeVisible()
  })

  test('responsive layout at key breakpoints', async ({ page }) => {
    // Mobile (320px)
    await page.setViewportSize({ width: 320, height: 568 })
    await expect(page.getByTestId('mobile-menu-trigger')).toBeVisible()

    // Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByTestId('mobile-menu-trigger')).not.toBeVisible()
    await expect(
      page.locator('nav').getByRole('link', { name: 'Priser' })
    ).toBeVisible()

    // Desktop (1280px)
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.getByTestId('mobile-menu-trigger')).not.toBeVisible()
  })

  test('footer has all required sections', async ({ page }) => {
    const footer = page.locator('footer')

    // Logo
    await expect(footer.getByRole('link', { name: 'Laglig.se' })).toBeVisible()

    // Menu links
    await expect(footer.getByRole('link', { name: 'Priser' })).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Om oss' })).toBeVisible()

    // Legal links
    await expect(
      footer.getByRole('link', { name: 'Integritetspolicy' })
    ).toBeVisible()
    await expect(
      footer.getByRole('link', { name: 'Användarvillkor' })
    ).toBeVisible()

    // Newsletter form
    await expect(footer.getByPlaceholder('din@email.se')).toBeVisible()

    // Legal disclaimer
    await expect(footer.getByText('Juridisk ansvarsfriskrivning')).toBeVisible()

    // Copyright
    await expect(footer.getByText(/© \d{4} Laglig\.se/)).toBeVisible()
  })

  test('hero shows core value flow', async ({ page }) => {
    // Check hero product preview shows core flow
    await expect(
      page.getByRole('heading', { name: 'Din laglista', exact: true })
    ).toBeVisible()
    await expect(page.getByText('23 lagar gäller ditt företag')).toBeVisible()
    await expect(page.getByText('Notis vid ändring').first()).toBeVisible()
    await expect(page.getByText('Uppgift skapas').first()).toBeVisible()
  })

  test('testimonials display measurable outcomes', async ({ page }) => {
    // Check for metric highlights
    await expect(page.getByText('200k')).toBeVisible()
    await expect(page.getByText('sparat i böter')).toBeVisible()
    await expect(page.getByText('10h')).toBeVisible()
    await expect(page.getByText('sparade per månad')).toBeVisible()
  })
})
