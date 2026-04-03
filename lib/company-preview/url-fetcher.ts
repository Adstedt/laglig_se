import dns from 'dns/promises'

const MAX_BODY_SIZE = 100 * 1024 // 100KB
const RAW_FETCH_TIMEOUT_MS = 5000
const JINA_FETCH_TIMEOUT_MS = 15000 // Jina needs more time to render JS
const MAX_REDIRECTS = 2
const MAX_TEXT_LENGTH = 12000 // ~3000 tokens
const JINA_BASE_URL = 'https://r.jina.ai'

// Private/reserved IP ranges (SSRF protection — used by raw fetch fallback)
const PRIVATE_IP_RANGES = [
  /^127\./, // 127.0.0.0/8
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // 169.254.0.0/16
  /^0\./, // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10
  /^198\.1[89]\./, // 198.18.0.0/15
]

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '::' || ip === '0:0:0:0:0:0:0:1') {
    return true
  }
  return PRIVATE_IP_RANGES.some((range) => range.test(ip))
}

async function resolveAndCheckIp(hostname: string): Promise<void> {
  let addresses: string[]
  try {
    addresses = await dns.resolve4(hostname)
  } catch {
    // If DNS resolution fails, let the fetch fail naturally
    return
  }

  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      throw new Error(`SSRF blocked: private IP ${ip} for hostname ${hostname}`)
    }
  }
}

function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function stripHtmlToText(html: string): string {
  // Remove script and style elements entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Strip Jina Reader metadata headers from response.
 * Jina prepends "Title: ...\nURL Source: ...\nMarkdown Content:\n" before the actual content.
 */
function stripJinaMetadata(text: string): string {
  // Remove the metadata block at the start
  const contentMarker = 'Markdown Content:'
  const markerIndex = text.indexOf(contentMarker)
  if (markerIndex !== -1) {
    return text.slice(markerIndex + contentMarker.length).trim()
  }
  return text.trim()
}

/**
 * Strip markdown image references and link formatting, keeping only text content.
 * Jina returns markdown with image refs that add noise for LLM analysis.
 */
function stripMarkdownNoise(text: string): string {
  return (
    text
      // Remove image references: ![alt](url) or [![alt](url)](url)
      .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove standalone URLs on their own line
      .replace(/^https?:\/\/\S+$/gm, '')
      // Collapse excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Fetch URL content via Jina Reader (renders JS, handles cookie consent).
 * Returns extracted text or null on failure. Never throws.
 */
async function fetchWithJina(url: string): Promise<string | null> {
  try {
    const jinaUrl = `${JINA_BASE_URL}/${url}`
    const response = await fetch(jinaUrl, {
      headers: {
        Accept: 'text/plain',
        // Jina-specific: bypass cookie consent popups
        'X-Remove-Selector':
          '.cookie-banner, .cookie-consent, [class*="cookie"], [id*="cookie"], .coi-banner, #coiOverlay',
        'X-No-Cache': 'true',
      },
      signal: AbortSignal.timeout(JINA_FETCH_TIMEOUT_MS),
    })

    if (!response.ok) return null

    const rawText = await response.text()
    if (!rawText || rawText.length < 50) return null

    const content = stripMarkdownNoise(stripJinaMetadata(rawText))
    if (!content || content.length < 20) return null

    if (content.length > MAX_TEXT_LENGTH) {
      return content.slice(0, MAX_TEXT_LENGTH)
    }

    return content
  } catch {
    return null
  }
}

/**
 * Fetch URL content directly with SSRF protection (fallback for when Jina is unavailable).
 * Returns extracted text or null on failure. Never throws.
 */
async function fetchDirect(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url)

    // DNS resolution check for private IPs
    await resolveAndCheckIp(parsed.hostname)

    // Fetch with timeout and manual redirect following (max 2 hops per AC 8)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), RAW_FETCH_TIMEOUT_MS)

    let response: Response
    let currentUrl = url
    try {
      let redirectCount = 0
      while (true) {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Laglig.se Bot/1.0',
            Accept: 'text/html',
          },
        })

        // Follow redirects manually to enforce limit and re-check IPs
        if (
          response.status >= 300 &&
          response.status < 400 &&
          response.headers.get('location')
        ) {
          redirectCount++
          if (redirectCount > MAX_REDIRECTS) {
            return null
          }

          const redirectTarget = new URL(
            response.headers.get('location')!,
            currentUrl
          )
          if (
            redirectTarget.protocol !== 'http:' &&
            redirectTarget.protocol !== 'https:'
          ) {
            return null
          }
          await resolveAndCheckIp(redirectTarget.hostname)
          currentUrl = redirectTarget.href
          continue
        }

        break
      }
    } finally {
      clearTimeout(timeout)
    }

    // Validate Content-Type
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return null
    }

    // Stream response with size limit
    const reader = response.body?.getReader()
    if (!reader) return null

    const chunks: Uint8Array[] = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalSize += value.byteLength
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel()
        break
      }
      chunks.push(value)
    }

    const decoder = new TextDecoder('utf-8', { fatal: false })
    const html = decoder.decode(
      new Uint8Array(
        chunks.reduce((acc, chunk) => {
          const result = new Uint8Array(acc.length + chunk.length)
          result.set(acc)
          result.set(chunk, acc.length)
          return result
        }, new Uint8Array(0))
      )
    )

    const text = stripHtmlToText(html)

    if (text.length > MAX_TEXT_LENGTH) {
      return text.slice(0, MAX_TEXT_LENGTH)
    }

    return text || null
  } catch {
    return null
  }
}

/**
 * Fetch URL content with SSRF protection.
 * Strategy: Jina Reader first (renders JS, handles cookies), raw fetch fallback.
 * Returns extracted text content or null on any failure.
 * Never throws.
 */
export async function fetchUrlContent(url: string): Promise<string | null> {
  if (!isValidPublicUrl(url)) return null

  // Try Jina Reader first — handles SPAs, JS rendering, and cookie consent
  const jinaResult = await fetchWithJina(url)
  if (jinaResult) return jinaResult

  // Fallback to direct fetch — works for static sites, avoids Jina dependency
  return fetchDirect(url)
}
