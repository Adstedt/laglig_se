import { test, expect } from '@playwright/test'

/**
 * Story 4.16: E2E tests for Google OAuth sign-in
 *
 * These tests verify the Google sign-in button renders correctly and
 * triggers the OAuth flow with the right parameters. The full OAuth
 * round-trip (Google consent → callback → session) is verified manually
 * since it requires a real Google account.
 */

test.describe('Google OAuth Sign-In', () => {
  test('login page shows Google sign-in button with divider', async ({
    page,
  }) => {
    await page.goto('/login')

    // Google button is visible
    const googleButton = page.getByRole('button', {
      name: /logga in med google/i,
    })
    await expect(googleButton).toBeVisible()

    // "eller" divider is visible between Google button and email form
    await expect(page.getByText('eller', { exact: true })).toBeVisible()

    // Email/password form still exists below the divider
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('signup page shows Google sign-up button with divider', async ({
    page,
  }) => {
    await page.goto('/signup')

    const googleButton = page.getByRole('button', {
      name: /registrera dig med google/i,
    })
    await expect(googleButton).toBeVisible()

    // "eller" divider is visible
    await expect(page.getByText('eller', { exact: true })).toBeVisible()

    // Regular signup form still exists
    await expect(page.locator('input[name="name"]')).toBeVisible()
  })

  test('clicking Google button initiates OAuth flow with correct params', async ({
    page,
  }) => {
    await page.goto('/login')

    // Intercept the outbound navigation to Google's OAuth endpoint
    const oauthRequestPromise = page.waitForRequest((request) =>
      request.url().includes('accounts.google.com')
    )

    // Click the Google button
    await page.getByRole('button', { name: /logga in med google/i }).click()

    // Verify the OAuth request goes to the right place
    const oauthRequest = await oauthRequestPromise
    const oauthUrl = new URL(oauthRequest.url())

    // Redirect URI should point to our Supabase callback
    const redirectUri = oauthUrl.searchParams.get('redirect_uri')
    expect(redirectUri).toContain('supabase.co/auth/v1/callback')

    // Should request openid + email + profile scopes
    const scope = oauthUrl.searchParams.get('scope') ?? ''
    expect(scope).toContain('email')
    expect(scope).toContain('profile')
  })

  test('login page shows oauth_failed error from query param', async ({
    page,
  }) => {
    await page.goto('/login?error=oauth_failed')

    await expect(
      page.getByText(/inloggning med google misslyckades/i)
    ).toBeVisible()
  })

  test('login page shows email_exists_with_password error from query param', async ({
    page,
  }) => {
    await page.goto('/login?error=email_exists_with_password')

    await expect(
      page.getByText(/redan registrerad med ett lösenord/i)
    ).toBeVisible()
  })
})
