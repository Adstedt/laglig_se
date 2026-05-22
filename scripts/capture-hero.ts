/* eslint-disable no-console */
/**
 * Captures the landing-page hero screenshot (Laglistor / Efterlevnad view) for the
 * Nordviken demo workspace, in light + dark mode, as crisp retina PNGs.
 *
 * Auth: mints a NextAuth v4 session cookie for the +111 user (no password needed)
 * and presets the active-workspace cookie so we land straight on Nordviken.
 *
 * Run: pnpm tsx scripts/capture-hero.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { chromium } from 'playwright'
// eslint-disable-next-line import/first
import { encode } from 'next-auth/jwt'

const USER = {
  id: 'cee3f852-5e08-46e2-be3b-bbde7d152108',
  email: 'alexander.adstedt+111@kontorab.se',
  name: 'Alexander Adstedt',
}
const WS_ID = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1' // Nordviken Hotell & Konferens AB
const BASE = 'http://localhost:3000'

async function capture(theme: 'light' | 'dark') {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET missing')

  const token = await encode({
    token: { id: USER.id, sub: USER.id, email: USER.email, name: USER.name },
    secret,
  })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'active_workspace_id',
      value: WS_ID,
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ])
  // Preset persisted UI state to match the real workspace: collapsed left sidebar,
  // folded AI chat panel, dismissed cookie banner, and the chosen theme.
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t as string)
      localStorage.setItem(
        'layout-storage',
        '{"state":{"leftSidebarCollapsed":true,"rightSidebarFolded":true,"accordionStates":{"Laglistor":true}},"version":0}'
      )
      localStorage.setItem(
        'laglig_consent_v1',
        '{"version":1,"acceptedAt":"2026-05-21T07:55:49.808Z","categories":{"analytics":true}}'
      )
    } catch {
      /* noop */
    }
  }, theme)

  const page = await context.newPage()
  await page.goto(`${BASE}/laglistor`, { waitUntil: 'domcontentloaded' })

  // Wait for the grouped compliance view to render
  await page
    .getByText('Arbetsrätt', { exact: true })
    .first()
    .waitFor({ timeout: 30000 })

  // Expand only the Arbetsrätt group via its own chevron
  const arbetsratt = page.getByText('Arbetsrätt', { exact: true }).first()
  const chevron = arbetsratt.locator(
    'xpath=preceding::button[@title="Expandera"][1]'
  )
  await chevron.click()

  // Let rows + avatar images settle
  await page
    .locator('img[src*="demo-team"]')
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {})
  await page.waitForTimeout(900)

  // Hide the floating chat launcher; zoom out slightly so all 7 columns fit a normal width
  await page.addStyleTag({
    content: 'button.fixed.bottom-6.right-6{display:none!important}',
  })
  await page.evaluate(() => {
    document.documentElement.style.zoom = '0.88'
  })
  await page.waitForTimeout(500)

  const out = resolve(
    process.cwd(),
    'public/landing-v3',
    `hero-laglistor-${theme}.png`
  )
  await page.screenshot({ path: out }) // captures the 1920x1080 viewport at DPR 2
  console.log(`✓ ${theme} → ${out}`)

  await browser.close()
}

;(async () => {
  await capture('light')
  await capture('dark')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
