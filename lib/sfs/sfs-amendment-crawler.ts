/**
 * SFS Amendment Crawler
 *
 * Story 8.20: Continuous SFS Amendment Discovery
 *
 * Crawls svenskforfattningssamling.se to discover new SFS amendments and repeals.
 * Extracted from scripts/crawl-sfs-index.ts with incremental watermark support.
 */

import { constructPdfUrls } from './pdf-urls'

// =============================================================================
// Types
// =============================================================================

export type DocumentType = 'amendment' | 'repeal' | 'new_law'

export interface CrawledDocument {
  sfsNumber: string // "2026:145"
  title: string // "Lag om ändring i lagen (2023:875) om tilläggsskatt"
  publishedDate: string // "2026-02-10"
  documentType: DocumentType
  baseLawSfs: string | null // "2023:875" for amendments/repeals, null for new laws
  pdfUrl: string // Full URL to PDF
  htmlUrl: string // Full URL to HTML page
}

export interface CrawlIndexResult {
  year: number
  highestSfsNum: number
  documents: CrawledDocument[]
}

export interface CrawlerOptions {
  /** Minimum delay between requests in ms (default: 200) */
  requestDelayMs?: number
  /** Only discover SFS numbers above this watermark (numeric part after colon) */
  startFromSfsNumber?: number
  /** Custom fetch function for testing */
  fetchFn?: typeof fetch
}

export interface IndexPageRow {
  sfsNumber: string // "2026:124"
  title: string // "Lag om ändring i lagen (2023:875) om tilläggsskatt"
  publishedDate: string // "2026-03-03"
  numericPart: number // 124
}

export interface DiscoverOptions {
  /** Only discover SFS numbers above this numeric part (e.g. 91 means start from 92+) */
  afterNumericPart?: number
  /** Custom fetch function for testing */
  fetchFn?: typeof fetch
  /** Minimum delay between pagination requests in ms (default: 200) */
  requestDelayMs?: number
}

export interface DiscoverResult {
  documents: DiscoveredDocument[]
  pagesScanned: number
  highestNumericPart: number
}

export interface DiscoveredDocument {
  sfsNumber: string
  title: string
  publishedDate: string
  numericPart: number
  documentType: DocumentType
  baseLawSfs: string | null
  pdfUrl: string
  htmlUrl: string
}

const BASE_URL = 'https://svenskforfattningssamling.se'
const USER_AGENT = 'Laglig.se/1.0 (Legal research; contact@laglig.se)'

// =============================================================================
// Document Classification
// =============================================================================

/**
 * Classify a document by its title
 */
export function classifyDocument(title: string): DocumentType {
  const lowerTitle = title.toLowerCase()

  if (
    lowerTitle.includes('om ändring i') ||
    lowerTitle.includes('om ändring av')
  ) {
    return 'amendment'
  }

  if (lowerTitle.includes('om upphävande av')) {
    return 'repeal'
  }

  return 'new_law'
}

/**
 * Well-known Swedish laws whose common titles omit the SFS number.
 * Used as fallback when the regex can't extract an SFS number from the title.
 * Base forms (without definite article) are used so that includes() matches
 * both "brottsbalk" and "brottsbalken" in amendment titles.
 * Source: https://lagen.nu/
 */
const NAMED_LAW_SFS: [string, string][] = [
  // -- Familjerätt --
  ['föräldrabalk', '1949:381'],
  ['ärvdabalk', '1958:637'],
  ['äktenskapsbalk', '1987:230'],
  ['lagen om personnamn', '2016:1013'],
  ['sambolag', '2003:376'],

  // -- Arbetsrätt --
  ['medbestämmandelag', '1976:580'],
  ['lag om anställningsskydd', '1982:80'],
  ['lagen om rättegången i arbetstvister', '1974:371'],
  ['semesterlag', '1977:480'],
  ['arbetstidslag', '1982:673'],
  ['lag om offentlig anställning', '1994:260'],
  ['visselblåsarlagen', '2021:890'],

  // -- Allmän avtalsrätt --
  ['avtalslag', '1915:218'],
  ['prokuralag', '1974:158'],
  ['lag om avtalsvillkor mellan näringsidkare', '1984:292'],
  ['lag om avtalsvillkor i konsumentförhållanden', '1994:1512'],
  ['kommissionslag', '2009:865'],

  // -- Speciell avtalsrätt --
  ['köplag', '1990:931'],
  ['konsumentköplag', '2022:260'],
  ['gåvolag', '1936:83'],
  ['konsumenttjänstlag', '1985:716'],
  ['lag om internationella köp', '1987:822'],
  ['distans- och hemförsäljningslag', '2005:59'],

  // -- Fordringsrätt --
  ['skuldebrevslag', '1936:81'],
  ['räntelag', '1975:635'],
  ['preskriptionslag', '1981:130'],

  // -- Sakrätt --
  ['lösöresköpslag', '1845:50_s.1'],
  ['samäganderättslag', '1904:48_s.1'],
  ['förmånsrättslag', '1970:979'],
  ['lag om godtrosförvärv av lösöre', '1986:796'],

  // -- Skadeståndsrätt --
  ['skadeståndslag', '1972:207'],
  ['trafikskadelag', '1975:1410'],
  ['brottsskadelag', '2014:322'],
  ['produktansvarslag', '1992:18'],
  ['patientskadelag', '1996:799'],

  // -- IT-rätt --
  ['dataskyddslag', '2018:218'],
  ['bbs-lag', '1998:112'],
  ['e-handelslag', '2002:562'],
  ['lag om elektronisk kommunikation', '2022:482'],
  [
    'lag om informationssäkerhet för samhällsviktiga och digitala tjänster',
    '2018:1174',
  ],

  // -- Immaterialrätt --
  ['varumärkeslag', '2010:1877'],
  ['upphovsrättslag', '1960:729'],
  ['patentlag', '2024:945'],
  ['mönsterskyddslag', '1970:485'],
  ['lag om företagsnamn', '2018:1653'],

  // -- Fastighetsrätt --
  ['jordabalk', '1970:994'],
  ['fastighetsbildningslag', '1970:988'],
  ['expropriationslag', '1972:719'],
  ['plan- och bygglag', '2010:900'],
  ['bostadsrättslag', '1991:614'],
  ['miljöbalk', '1998:808'],

  // -- Associationsrätt --
  ['lag om handelsbolag och enkla bolag', '1980:1102'],
  ['lag om ekonomiska föreningar', '2018:672'],
  ['stiftelselag', '1994:1220'],
  ['årsredovisningslag', '1995:1554'],
  ['bokföringslag', '1999:1078'],
  ['aktiebolagslag', '2005:551'],

  // -- Straffrätt --
  ['brottsbalk', '1962:700'],
  ['trafikbrottslag', '1951:649'],
  ['narkotikastrafflag', '1968:64'],
  ['skattebrottslag', '1971:69'],
  ['smugglingslag', '2000:1225'],

  // -- Processrätt --
  ['rättegångsbalk', '1942:740'],
  ['utsökningsbalk', '1981:774'],
  ['konkurslag', '1987:672'],
  ['lag om domstolsärenden', '1996:242'],
  ['lag om skiljeförfarande', '1999:116'],

  // -- Statsrätt --
  ['tryckfrihetsförordningen', '1949:105'],
  ['successionsordningen', '1810:0926'],
  ['regeringsformen', '1974:152'],
  ['riksdagsordningen', '2014:801'],
  ['yttrandefrihetsgrundlag', '1991:1469'],
  ['europakonventionen', '1994:1219'],
  ['utlänningslag', '2005:716'],

  // -- Skatterätt --
  ['inkomstskattelag', '1999:1229'],
  ['skatteförfarandelag', '2011:1244'],
  ['fastighetstaxeringslag', '1979:1152'],
  ['lag om särskild inkomstskatt för utomlands bosatta', '1991:586'],
  ['mervärdesskattelag', '2023:200'],
  ['lag mot skatteflykt', '1995:575'],

  // -- Allmän förvaltningsrätt --
  ['förvaltningslag', '2017:900'],
  ['offentlighets- och sekretesslag', '2009:400'],
  ['förvaltningsprocesslag', '1971:291'],
  ['avgiftsförordning', '1992:191'],
  ['lag om offentlig upphandling', '2016:1145'],

  // -- Speciell förvaltningsrätt --
  ['socialförsäkringsbalk', '2010:110'],
  ['fängelselag', '2010:610'],
  ['hälso- och sjukvårdslag', '2017:30'],
  ['polislag', '1984:387'],
  ['ordningslag', '1993:1617'],
  ['socialtjänstlag', '2001:453'],
  ['lag om signalspaning i försvarsunderrättelseverksamhet', '2008:717'],

  // -- Kommunalrätt --
  ['kommunallag', '2017:725'],

  // -- Marknadsrätt --
  ['marknadsföringslag', '2008:486'],
  ['konkurrenslag', '2008:579'],

  // -- Previously hardcoded (not on lagen.nu but seen in amendment titles) --
  ['handelsbalken', '1736:0123 2'],
  ['giftermålsbalken', '1920:405'],
  ['sjölagen', '1994:1009'],
  ['försäkringskassebalken', '2010:111'],
]

/**
 * Extract the base law SFS number from an amendment/repeal title.
 *
 * Handles three cases:
 * 1. Standard: "Lag om ändring i lagen (2023:875) om tilläggsskatt" → "2023:875"
 * 2. Chained: "Förordning om ändring i förordningen (2024:21) om ändring i
 *    förordningen (2020:750) om ..." → "2020:750" (resolves to deepest base law)
 * 3. Named: "Lag om ändring i brottsbalken" → "1962:700" (lookup table)
 */
export function extractBaseLawSfs(title: string): string | null {
  // For chained amendments ("ändring i ... om ändring i ..."), the last SFS
  // number in the chain is the true base law. Extract all SFS numbers after
  // "ändring i/av" or "upphävande av" and take the last one.
  const chainPattern =
    /om (?:ändring i|ändring av|upphävande av)[^(]*\((\d{4}:\d+)\)/gi
  const allMatches = [...title.matchAll(chainPattern)]
  if (allMatches.length > 0) {
    // Last match is the deepest base law in the chain
    return allMatches[allMatches.length - 1]![1]!
  }

  // Fallback: first SFS number in parentheses
  const altMatch = title.match(/\((\d{4}:\d+)\)/)
  if (altMatch?.[1]) {
    return altMatch[1]
  }

  // Fallback: well-known named laws without SFS number in title
  const lowerTitle = title.toLowerCase()
  for (const [lawName, sfsNumber] of NAMED_LAW_SFS) {
    if (lowerTitle.includes(lawName)) {
      return sfsNumber
    }
  }

  return null
}

/**
 * Extract the numeric portion of an SFS number (the part after the colon).
 * Returns NaN for invalid input.
 */
export function extractSfsNumericPart(sfsNumber: string): number {
  const parts = sfsNumber.split(':')
  if (parts.length !== 2 || !parts[1]) return NaN
  return parseInt(parts[1], 10)
}

// =============================================================================
// Rate Limiting
// =============================================================================

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// =============================================================================
// HTML Parsing
// =============================================================================

/**
 * Parse the index page HTML to extract the highest SFS number for the year.
 * Returns all SFS numbers found on the page.
 */
export function parseIndexPageSfsNumbers(html: string, year: number): number[] {
  const matches = [
    ...html.matchAll(/data-lable="SFS-nummer"[^>]*>(\d{4}):(\d+)/g),
  ]
  return matches
    .filter((m) => m[1] === String(year))
    .map((m) => parseInt(m[2]!, 10))
}

/**
 * Check if the index page has a "next" pagination link.
 */
export function getNextPageNumber(html: string): number | null {
  const match = html.match(
    /<li\s+class="next"[^>]*>[\s\S]*?<a\s+href="[^"]*[?%].*?page[=%3D]*(\d+)/i
  )
  if (match) {
    return parseInt(match[1]!, 10)
  }
  return null
}

/**
 * Parse full rows from the SFS index page HTML.
 * Each row contains SFS number, title, and publication date.
 *
 * Expected HTML structure:
 * ```html
 * <tr>
 *   <td><span data-lable="SFS-nummer">2026:124</span></td>
 *   <td><span data-lable="Rubrik"><a href="...">Lag om ändring i ...</a></span></td>
 *   <td><span data-lable="Publicerad">2026-03-03</span></td>
 * </tr>
 * ```
 */
export function parseIndexPageRows(html: string, year: number): IndexPageRow[] {
  const rows: IndexPageRow[] = []

  // Match each table row that contains SFS data
  const rowRegex =
    /<tr[^>]*>[\s\S]*?data-lable="SFS-nummer"[^>]*>(\d{4}):(\d+)[\s\S]*?data-lable="Rubrik"[^>]*>([\s\S]*?)<\/span>[\s\S]*?data-lable="Publicerad"[^>]*>(\d{4}-\d{2}-\d{2})<\/span>[\s\S]*?<\/tr>/gi

  let match
  while ((match = rowRegex.exec(html)) !== null) {
    const [, sfsYear, sfsNum, rubrikHtml, publishedDate] = match
    if (sfsYear !== String(year)) continue
    if (!sfsNum || !rubrikHtml || !publishedDate) continue

    const numericPart = parseInt(sfsNum, 10)
    if (isNaN(numericPart)) continue

    // Extract title from the Rubrik cell (strip HTML tags)
    const title = rubrikHtml.replace(/<[^>]+>/g, '').trim()
    if (!title) continue

    rows.push({
      sfsNumber: `${sfsYear}:${sfsNum}`,
      title,
      publishedDate,
      numericPart,
    })
  }

  return rows
}

/**
 * Parse a document page HTML to extract metadata.
 */
export function parseDocumentPage(
  html: string,
  sfsNumber: string
): Omit<CrawledDocument, 'sfsNumber'> | null {
  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^|]+)\|/i)
  const title = titleMatch ? titleMatch[1]!.trim() : null

  if (!title) return null

  // Extract PDF URL from the download link
  const pdfMatch = html.match(/href="([^"]*\/sfs\/[^"]+\.pdf)"/i)
  const pdfPath = pdfMatch ? pdfMatch[1]!.replace(/^\.\./, '') : null
  const pdfUrl = pdfPath
    ? `${BASE_URL}${pdfPath.startsWith('/') ? '' : '/'}${pdfPath}`
    : ''

  // Extract publication date from PDF path
  let publishedDate = `${sfsNumber.split(':')[0]}-01-01`
  if (pdfPath) {
    const monthMatch = pdfPath.match(/\/sfs\/(\d{4}-\d{2})\//)
    if (monthMatch) {
      publishedDate = `${monthMatch[1]}-01`
    }
  }

  const documentType = classifyDocument(title)
  const baseLawSfs =
    documentType === 'amendment' || documentType === 'repeal'
      ? extractBaseLawSfs(title)
      : null

  const [sfsYear, sfsNum] = sfsNumber.split(':')

  return {
    title,
    publishedDate,
    documentType,
    baseLawSfs,
    pdfUrl,
    htmlUrl: `${BASE_URL}/doc/${sfsYear}${sfsNum}.html`,
  }
}

// =============================================================================
// Crawler Functions
// =============================================================================

async function fetchPage(
  url: string,
  fetchFn: typeof fetch
): Promise<string | null> {
  const response = await fetchFn(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
    },
  })

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} for ${url}`
    )
  }

  return response.text()
}

/**
 * @deprecated Use `discoverFromIndex()` instead — it parses titles/dates from the index
 * page directly (no individual doc page fetches) and supports pagination.
 *
 * Crawl the current year's index page to find the highest SFS number.
 * If no watermark is provided, traverses all pagination pages to build a full index.
 * With a watermark, only page 1 is needed (it shows the most recent documents).
 */
export async function crawlCurrentYearIndex(
  year: number,
  options: CrawlerOptions = {}
): Promise<CrawlIndexResult> {
  const { requestDelayMs = 200, startFromSfsNumber, fetchFn = fetch } = options

  const indexUrl = `${BASE_URL}/regulations/${year}/index.html`
  const html = await fetchPage(indexUrl, fetchFn)

  if (!html) {
    return { year, highestSfsNum: 0, documents: [] }
  }

  const sfsNumbers = parseIndexPageSfsNumbers(html, year)

  if (sfsNumbers.length === 0) {
    return { year, highestSfsNum: 0, documents: [] }
  }

  const highestSfsNum = Math.max(...sfsNumbers)

  // Determine the range to crawl
  const startFrom = startFromSfsNumber ? startFromSfsNumber + 1 : 1

  if (startFrom > highestSfsNum) {
    // No new documents above watermark
    return { year, highestSfsNum, documents: [] }
  }

  // Crawl individual document pages for the range
  const documents: CrawledDocument[] = []

  for (let num = startFrom; num <= highestSfsNum; num++) {
    if (num > startFrom) {
      await delay(requestDelayMs)
    }

    const sfsNumber = `${year}:${num}`
    const docUrl = `${BASE_URL}/doc/${year}${num}.html`

    try {
      const docHtml = await fetchPage(docUrl, fetchFn)
      if (!docHtml) continue // Document doesn't exist (gap in numbering)

      const parsed = parseDocumentPage(docHtml, sfsNumber)
      if (!parsed) continue

      documents.push({
        sfsNumber,
        ...parsed,
      })
    } catch (error) {
      console.error(
        `[SFS-CRAWLER] Error fetching ${sfsNumber}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  return { year, highestSfsNum, documents }
}

/**
 * Crawl a single document page by SFS number.
 */
export async function crawlDocumentPage(
  sfsNumber: string,
  options: CrawlerOptions = {}
): Promise<CrawledDocument | null> {
  const { fetchFn = fetch } = options

  const [year, num] = sfsNumber.split(':')
  if (!year || !num) return null

  const docUrl = `${BASE_URL}/doc/${year}${num}.html`

  const html = await fetchPage(docUrl, fetchFn)
  if (!html) return null

  const parsed = parseDocumentPage(html, sfsNumber)
  if (!parsed) return null

  return { sfsNumber, ...parsed }
}

// =============================================================================
// Fast Index-Based Discovery (replaces crawlCurrentYearIndex for cron use)
// =============================================================================

/**
 * Discover new SFS documents from the index page(s).
 *
 * Key improvements over crawlCurrentYearIndex:
 * - Parses title + date directly from index rows (no individual doc page fetches)
 * - Follows pagination via getNextPageNumber()
 * - Stops paginating when all rows on a page are at or below the watermark
 * - Enriches each row with documentType, baseLawSfs, pdfUrl
 */
export async function discoverFromIndex(
  year: number,
  options: DiscoverOptions = {}
): Promise<DiscoverResult> {
  const { afterNumericPart, fetchFn = fetch, requestDelayMs = 200 } = options

  const allRows: IndexPageRow[] = []
  let pagesScanned = 0
  let currentPage: number | null = null // null = first page (no ?page= param)

  // Paginate through index pages
  while (true) {
    // URL pattern: .../regulations/YYYY/index.html (page 0)
    //              .../regulations/YYYY/index.html%3Fpage=N.html (page N)
    const indexUrl =
      currentPage !== null
        ? `${BASE_URL}/regulations/${year}/index.html%3Fpage=${currentPage}.html`
        : `${BASE_URL}/regulations/${year}/index.html`

    if (pagesScanned > 0) {
      await delay(requestDelayMs)
    }

    const html = await fetchPage(indexUrl, fetchFn)
    pagesScanned++

    if (!html) break

    const rows = parseIndexPageRows(html, year)
    if (rows.length === 0) break

    allRows.push(...rows)

    // If all rows on this page are at or below watermark, stop paginating
    // (index is in descending order — once we're past the watermark, all
    // subsequent pages are also below it)
    if (
      afterNumericPart !== undefined &&
      rows.every((r) => r.numericPart <= afterNumericPart)
    ) {
      break
    }

    // Check for next page
    const nextPage = getNextPageNumber(html)
    if (nextPage === null) break

    currentPage = nextPage
  }

  if (allRows.length === 0) {
    return { documents: [], pagesScanned, highestNumericPart: 0 }
  }

  // Deduplicate rows (same SFS number can appear on overlapping pages)
  const seen = new Set<string>()
  const uniqueRows: IndexPageRow[] = []
  for (const row of allRows) {
    if (!seen.has(row.sfsNumber)) {
      seen.add(row.sfsNumber)
      uniqueRows.push(row)
    }
  }

  const highestNumericPart = Math.max(...uniqueRows.map((r) => r.numericPart))

  // Filter to rows above watermark
  const filtered =
    afterNumericPart !== undefined
      ? uniqueRows.filter((r) => r.numericPart > afterNumericPart)
      : uniqueRows

  // Enrich each row with classification and URLs
  const documents: DiscoveredDocument[] = filtered.map((row) => {
    const documentType = classifyDocument(row.title)
    const baseLawSfs =
      documentType === 'amendment' || documentType === 'repeal'
        ? extractBaseLawSfs(row.title)
        : null

    const urls = constructPdfUrls(row.sfsNumber, row.publishedDate)

    return {
      sfsNumber: row.sfsNumber,
      title: row.title,
      publishedDate: row.publishedDate,
      numericPart: row.numericPart,
      documentType,
      baseLawSfs,
      pdfUrl: urls.pdf,
      htmlUrl: urls.html,
    }
  })

  return { documents, pagesScanned, highestNumericPart }
}
