/**
 * Story 21.12 — Shared HTML→PDF rendering helper.
 *
 * Extracted from `lib/documents/tiptap-to-pdf.ts` so both the Tiptap document
 * export pipeline and the revisionsrapport PDF wrapper converge on a single
 * Puppeteer launch path. Architecture §6.1 line 498 mandates this refactor
 * as a zero-risk extraction: behaviour is unchanged for existing callers
 * (same Puppeteer config, same margins, same error semantics).
 *
 * Pure orchestration — the `html` argument is rendered verbatim; this module
 * owns no content styling. Callers compose their own self-contained HTML
 * documents (with inline `<style>`) before invoking.
 *
 * Local-dev on Windows/macOS: `@sparticuz/chromium` ships a Linux-x64
 * serverless binary that cannot run on dev laptops. Set
 * `PUPPETEER_EXECUTABLE_PATH` in `.env.local` to your system Chrome/Edge —
 * the helper prefers it over the serverless binary when present. Production
 * on Vercel Linux runtime continues to use `@sparticuz/chromium`.
 *
 * Windows default: `C:\Program Files\Google\Chrome\Application\chrome.exe`
 * macOS default: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
 */

// IMPORTANT: `@sparticuz/chromium-min` and `puppeteer-core` are imported
// dynamically (inside the functions below), NOT at the top level. A static
// import pulls puppeteer-core into the *static* module graph of every route or
// server-action bundle that transitively reaches this file — e.g. the
// /laglistor/kontroller/[cycleId] action bundle imports it via
// compliance-audit-report. Only the dedicated PDF routes have the
// puppeteer/@puppeteer/browsers files traced into their serverless function
// (see PDF_RUNTIME_INCLUDES in next.config.mjs); on any other route the eager
// import throws ERR_MODULE_NOT_FOUND at module-load time and 500s every request
// (including unrelated server actions). Deferring to a runtime `await import()`
// keeps puppeteer out of those static graphs entirely — it loads only when a
// PDF is actually rendered, on a route where the files exist.
//
// We use `@sparticuz/chromium-min` (NOT the full `@sparticuz/chromium`): the
// full package bundles a ~64 MB brotli Chromium binary into the function, and
// pnpm's symlinked node_modules makes Vercel ship it twice (~127 MB), blowing
// the 250 MB function-size cap. `-min` ships no binary; the brotli pack is
// downloaded once per cold start (cached in /tmp) from `CHROMIUM_PACK_URL`.

// The brotli Chromium pack location is read from CHROMIUM_PACK_URL at call time
// (see resolveLaunchConfig). It is configurable via env so the pack can move to
// our own storage (Supabase/Blob) WITHOUT a code change — only the env var
// changes. IMPORTANT: it must point at a pack matching the installed
// @sparticuz/chromium-min version (143.0.4); bumping the package means updating
// the URL too.

export interface RenderOptions {
  format?: 'A4' | 'Letter'
  margin?: { top: string; bottom: string; left: string; right: string }
  printBackground?: boolean
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
}

const DEFAULT_MARGIN = {
  top: '2cm',
  bottom: '2cm',
  left: '2cm',
  right: '2cm',
}

async function resolveLaunchConfig(): Promise<{
  args: string[]
  executablePath: string
  headless: boolean
}> {
  // If the dev has pointed us at a local browser via env, honour it. This is
  // the escape hatch for Windows/macOS dev laptops where the serverless
  // Chromium binary will not execute. Production leaves this env var unset and
  // falls through to the chromium-min + remote-pack path below.
  const localPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (localPath && localPath.length > 0) {
    return {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: localPath,
      headless: true,
    }
  }

  // Production (serverless): chromium-min has no bundled binary, so it MUST be
  // told where to fetch the brotli pack. Fail loudly + actionably if the env
  // var is missing rather than letting @sparticuz throw a cryptic
  // "input directory does not exist" deep in executablePath().
  const packUrl = process.env.CHROMIUM_PACK_URL
  if (!packUrl || packUrl.length === 0) {
    throw new Error(
      'CHROMIUM_PACK_URL is not set. PDF rendering uses @sparticuz/chromium-min, ' +
        'which downloads the Chromium pack at runtime. Set CHROMIUM_PACK_URL to a ' +
        'pack tarball matching @sparticuz/chromium-min@143.0.4 — e.g. the GitHub ' +
        'release pack ' +
        'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar ' +
        '(or your own hosted copy). For local dev set PUPPETEER_EXECUTABLE_PATH to a system Chrome instead.'
    )
  }

  const { default: chromium } = await import('@sparticuz/chromium-min')
  return {
    args: chromium.args,
    executablePath: await chromium.executablePath(packUrl),
    headless: true,
  }
}

/**
 * Render an HTML string to PDF bytes via headless Chromium.
 *
 * Always wraps browser lifecycle in try/finally so `browser.close()` runs
 * even on render failure — prevents orphaned Chromium processes on Vercel.
 */
export async function renderHtmlToPdf(
  html: string,
  options?: RenderOptions
): Promise<Buffer> {
  const launchConfig = await resolveLaunchConfig()
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.launch(launchConfig)

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfOptions: Parameters<typeof page.pdf>[0] = {
      format: options?.format ?? 'A4',
      margin: options?.margin ?? DEFAULT_MARGIN,
      printBackground: options?.printBackground ?? true,
    }

    if (options?.displayHeaderFooter) {
      pdfOptions.displayHeaderFooter = true
      if (options.headerTemplate !== undefined) {
        pdfOptions.headerTemplate = options.headerTemplate
      }
      if (options.footerTemplate !== undefined) {
        pdfOptions.footerTemplate = options.footerTemplate
      }
    }

    const pdf = await page.pdf(pdfOptions)
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
