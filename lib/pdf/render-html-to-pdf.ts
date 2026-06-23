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

// IMPORTANT: `@sparticuz/chromium` and `puppeteer-core` are imported
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
  // the escape hatch for Windows/macOS dev laptops where `@sparticuz/chromium`
  // (a Linux-x64 serverless binary) will not execute. Production leaves the
  // env var unset and falls through to the serverless path below.
  const localPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (localPath && localPath.length > 0) {
    return {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: localPath,
      headless: true,
    }
  }

  const { default: chromium } = await import('@sparticuz/chromium')
  return {
    args: chromium.args,
    executablePath: await chromium.executablePath(),
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
