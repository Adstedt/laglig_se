/**
 * Agency PDF Document Registry
 * Story 9.2: MSBFS & NFS regulation ingestion
 *
 * Typed registry of agency regulation PDFs for download and ingestion.
 * Designed to be extended for additional authorities in Story 9.3.
 */

// ============================================================================
// Types
// ============================================================================

export type AgencyAuthority =
  | 'msbfs'
  | 'nfs'
  | 'elsak-fs'
  | 'kifs'
  | 'bfs'
  | 'srvfs'
  | 'skvfs'
  | 'scb-fs'
  | 'ssmfs'
  | 'stafs'

export interface AgencyPdfDocument {
  /** e.g. "MSBFS 2020:1" */
  documentNumber: string
  /** Full Swedish title */
  title: string
  /** Direct URL to download the PDF */
  pdfUrl: string
  /** Landing page / source URL for the regulation */
  sourceUrl: string
  /** Which authority issued this regulation */
  authority: AgencyAuthority
  /** Source website domain */
  sourceDomain: string
  /** Whether this is a konsoliderad (consolidated) version */
  isConsolidated: boolean
  /** If true, store as metadata-only stub with external PDF link (no LLM processing) */
  stubOnly?: boolean
  /** Notes about the document (e.g. "200+ pages, may need chunking") */
  notes?: string
}

// ============================================================================
// MSBFS Documents (12)
// ============================================================================

export const MSBFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'MSBFS 2010:4',
    title:
      'Föreskrifter om vilka varor som ska anses utgöra brandfarliga eller explosiva varor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/84efa9ee-324a-4ebc-913a-753b06e4bf0d.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20104/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2011:3',
    title: 'Föreskrifter om transportabla tryckbärande anordningar',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/1c145d03-2aff-448d-a48d-8714761707c9.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20113/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2013:3',
    title:
      'Föreskrifter om tillstånd till hantering av brandfarliga gaser och vätskor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/61531c7c-d2a9-4585-8cc8-b7bbb87184aa.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20133/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2014:6',
    title:
      'Föreskrifter och allmänna råd om rengöring (sotning) och brandskyddskontroll',
    pdfUrl: 'https://www.mcf.se/siteassets/dokument/regler/rs/msbfs-2014-6/',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20146/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2015:8',
    title:
      'Föreskrifter om åtgärder för att förebygga och begränsa följderna av allvarliga kemikalieolyckor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/85c2e7e9-93bc-4bd8-a40f-d0c92f68210f.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20158/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2015:9',
    title: 'Föreskrifter om säkerhetsrådgivare för transport av farligt gods',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/bc656208-29e4-4c35-ab04-14f8ed38aeca.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20159/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2016:4',
    title:
      'Föreskrifter om tillstånd för överföring, import och export av explosiva varor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/b14110fc-174c-45f5-87a1-d48dd4b353be.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20164/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2018:3',
    title:
      'Föreskrifter om cisterner med anslutna rörledningar för brandfarliga vätskor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/48437bad-db50-4f07-b2bb-9c679b322abe.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20183/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2020:1',
    title:
      'Föreskrifter om hantering av brandfarlig gas och brandfarliga aerosoler',
    pdfUrl:
      'https://www.msb.se/siteassets/dokument/regler/forfattningar/msbfs-2020-1.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20201/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2023:2',
    title: 'Föreskrifter om hantering av brandfarliga vätskor',
    pdfUrl:
      'https://www.msb.se/contentassets/3235ab4305e849b6a8c2f4beb2d15d6f/msbfs-2023-2.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20232/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2024:10',
    title:
      'Föreskrifter om transport av farligt gods på väg och i terräng (ADR-S)',
    pdfUrl:
      'https://www.mcf.se/contentassets/23dbbff228564dcd937fa1ab1e9f62b9/adr-s-2025-klar.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-202410/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
    stubOnly: true,
    notes:
      'ADR-S: 1400+ pages with complex graphs/tables. Stored as stub with external PDF link only — content too large and visual for LLM extraction.',
  },
  {
    documentNumber: 'MSBFS 2025:2',
    title: 'Föreskrifter om hantering av explosiva varor',
    pdfUrl:
      'https://www.msb.se/contentassets/ce052b5c54294ca88bf95285aa947950/msbfs-2025-2.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20252/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
]

// ============================================================================
// NFS Documents (13)
// ============================================================================

export const NFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'NFS 2001:2',
    title: 'Naturvårdsverkets allmänna råd om egenkontroll',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac5b4/globalassets/nfs/2001/nfs2001-02.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2001/nfs-2001-2/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2004:10',
    title:
      'Naturvårdsverkets föreskrifter om deponering, kriterier och förfaranden för mottagning av avfall vid anläggningar för deponering av avfall',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac5fa/globalassets/nfs/2004/nfs-2004-10k.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2004/nfs-200410/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'NFS 2004:15',
    title: 'Naturvårdsverkets allmänna råd om buller från byggplatser',
    pdfUrl:
      'https://www.naturvardsverket.se/491670/globalassets/nfs/2004/nfs2004_15.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2004/nfs-200415/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2015:2',
    title:
      'Naturvårdsverkets föreskrifter om spridning och viss övrig hantering av växtskyddsmedel',
    pdfUrl:
      'https://www.naturvardsverket.se/globalassets/nfs/2015/nfs-2015-2k-2.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2015/nfs-20152/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'NFS 2015:3',
    title:
      'Naturvårdsverkets föreskrifter om spridning av vissa biocidprodukter',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac50d/globalassets/nfs/2015/nfs-2015-03.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2015/nfs-20153/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2016:8',
    title: 'Naturvårdsverkets föreskrifter om miljörapport',
    pdfUrl:
      'https://www.naturvardsverket.se/4b01f0/globalassets/nfs/2016/nfs-2016-8-konsoliderad-2025-6.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2016/nfs-20168/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'NFS 2018:11',
    title:
      'Naturvårdsverkets föreskrifter om hantering av brännbart avfall och organiskt avfall',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac15d/globalassets/nfs/2018/nfs-2018-11.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2018/nfs-201811/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2020:5',
    title:
      'Naturvårdsverkets föreskrifter om rapporteringsskyldighet för farligt avfall',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac538/globalassets/nfs/2020/nfs-2020-5.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2020/nfs-20205/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2021:6',
    title:
      'Naturvårdsverkets föreskrifter om mätningar och provtagningar i vissa verksamheter',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac164/globalassets/nfs/2021/nfs_2021_6.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2021/nfs-20216/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2021:10',
    title:
      'Naturvårdsverkets föreskrifter om skydd mot mark- och vattenförorening vid hantering av brandfarliga vätskor och spilloljor',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac352/globalassets/nfs/2021/nfs-2021-10.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2021/nfs-202110/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2022:2',
    title: 'Naturvårdsverkets föreskrifter om transport av avfall',
    pdfUrl:
      'https://www.naturvardsverket.se/4ac5af/globalassets/nfs/2022/nfs-2022-2.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2022/nfs-20222---transport-av-avfall/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2023:2',
    title:
      'Naturvårdsverkets föreskrifter om uppgifter om avfall som ska lämnas till avfallsregistret',
    pdfUrl:
      'https://www.naturvardsverket.se/4acc62/globalassets/nfs/2023/nfs-2023-2.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2023/nfs-2023-2/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'NFS 2023:13',
    title:
      'Naturvårdsverkets föreskrifter om uppgifter om förpackningar och förpackningsavfall',
    pdfUrl:
      'https://www.naturvardsverket.se/4ae032/globalassets/nfs/2023/nfs-2023-13.pdf',
    sourceUrl:
      'https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/2023/nfs-2023-13/',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
  },
]

// ============================================================================
// ELSÄK-FS Documents (5) — Elsäkerhetsverket
// ============================================================================

export const ELSAK_FS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'ELSÄK-FS 2017:2',
    title:
      'Elsäkerhetsverkets föreskrifter och allmänna råd om elinstallationsarbete',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2017-2.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-2/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2017:3',
    title:
      'Elsäkerhetsverkets föreskrifter om elinstallationsföretag och om utförande av elinstallationsarbete',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2017-3-konsoliderad.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-3-konsoliderad-version/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'ELSÄK-FS 2022:1',
    title:
      'Elsäkerhetsverkets föreskrifter och allmänna råd om hur starkströmsanläggningar ska vara utförda',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2022-1.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2022-1/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2022:2',
    title:
      'Elsäkerhetsverkets föreskrifter och allmänna råd om skyltning av starkströmsanläggningar',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2022-2.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2022-2/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2022:3',
    title:
      'Elsäkerhetsverkets föreskrifter och allmänna råd om innehavarens kontroll av starkströmsanläggningar och elektriska utrustningar',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2022-3.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2022-3/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
]

// ============================================================================
// KIFS Documents (2) — Kemikalieinspektionen
// ============================================================================

export const KIFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'KIFS 2017:7',
    title:
      'Kemikalieinspektionens föreskrifter om kemiska produkter och biotekniska organismer',
    pdfUrl:
      'https://www.kemi.se/download/18.409a5d0a193955be16be5e6/1733838775330/KIFS-2017-7-konsoliderad.pdf',
    sourceUrl:
      'https://www.kemi.se/lagar-och-regler/lagstiftningar-inom-kemikalieomradet/kemikalieinspektionens-foreskrifter-kifs/kifs-20177',
    authority: 'kifs',
    sourceDomain: 'kemi.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'KIFS 2022:3',
    title: 'Kemikalieinspektionens föreskrifter om bekämpningsmedel',
    pdfUrl:
      'https://www.kemi.se/download/18.691651b517fd1cf3f271825/1649074954677/KIFS%202022_3.pdf',
    sourceUrl:
      'https://www.kemi.se/lagar-och-regler/lagstiftningar-inom-kemikalieomradet/kemikalieinspektionens-foreskrifter-kifs/kifs-20223',
    authority: 'kifs',
    sourceDomain: 'kemi.se',
    isConsolidated: false,
  },
]

// ============================================================================
// BFS Documents (1) — Boverket
// ============================================================================

export const BFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'BFS 2011:16',
    title:
      'Boverkets föreskrifter och allmänna råd om funktionskontroll av ventilationssystem (OVK)',
    pdfUrl:
      'https://www.boverket.se/resources/constitutiontextstore/ovk/PDF/konsoliderad_ovk_bfs_2011-16.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-16',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: true,
  },
]

// ============================================================================
// SRVFS Documents (2) — Legacy Räddningsverket (hosted by MCF)
// ============================================================================

export const SRVFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'SRVFS 2004:3',
    title:
      'Statens räddningsverks allmänna råd och kommentarer om systematiskt brandskyddsarbete',
    pdfUrl:
      'https://www.msb.se/siteassets/dokument/regler/rs/51dc9127-8bb3-4bee-8606-98f694a4a5b6.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/srvfs-20043/',
    authority: 'srvfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SRVFS 2004:7',
    title:
      'Statens räddningsverks föreskrifter om explosionsfarlig miljö vid hantering av brandfarliga gaser och vätskor',
    pdfUrl:
      'https://www.msb.se/siteassets/dokument/regler/rs/ecc1e5ce-c311-433d-b3e5-f4f63b008386.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/srvfs-20047/',
    authority: 'srvfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
]

// ============================================================================
// SKVFS Documents (1) — Skatteverket
// ============================================================================

export const SKVFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'SKVFS 2015:6',
    title: 'Skatteverkets föreskrifter om personalliggare',
    pdfUrl:
      'https://web.archive.org/web/20240515232329/http://www4.skatteverket.se/download/18.190ee20e163797380b13eea/1698824249985/SKVFS%202015_06.pdf',
    sourceUrl: 'https://www4.skatteverket.se/rattsligvagledning/341539.html',
    authority: 'skvfs',
    sourceDomain: 'skatteverket.se',
    isConsolidated: false,
  },
]

// ============================================================================
// SCB-FS Documents (1) — Statistiska centralbyrån
// ============================================================================

export const SCB_FS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'SCB-FS 2025:19',
    title:
      'Statistiska centralbyråns föreskrifter om uppgifter till statistik över företags miljöskyddskostnader',
    pdfUrl:
      'https://www.scb.se/contentassets/fc434ac2550548bcbab57886c357c81c/92030-scb-fs-2025-19-mkost_pdfkorr.pdf',
    sourceUrl:
      'https://www.scb.se/om-scb/scbs-verksamhet/regelverk-och-policyer/foreskrifter/uppgiftslamnande/scb-fs-202519/',
    authority: 'scb-fs',
    sourceDomain: 'scb.se',
    isConsolidated: false,
    notes: 'Replaces SCB-FS 2024:25 which was removed from SCB website.',
  },
]

// ============================================================================
// SSMFS Documents (1) — Strålsäkerhetsmyndigheten
// ============================================================================

export const SSMFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'SSMFS 2018:2',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om anmälningspliktiga verksamheter',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/e731676ddfcd43cbb9bdbc0c01cd5ab6/ssmfs-20182-stralsakerhetsmyndighetens-foreskrifter-om-anmalningspliktiga-verksamheter-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/SSMFS-20182/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
]

// ============================================================================
// STAFS Documents (1) — Swedac
// ============================================================================

export const STAFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'STAFS 2020:1',
    title: 'Swedacs föreskrifter och allmänna råd om ackreditering',
    pdfUrl: 'https://www.swedac.se/wp-content/uploads/2020/04/stafs-2020_1.pdf',
    sourceUrl:
      'https://www.swedac.se/dokument/swedacs-foreskrifter-och-allmanna-rad-om-ackreditering-4/',
    authority: 'stafs',
    sourceDomain: 'swedac.se',
    isConsolidated: false,
  },
]

// ============================================================================
// Registry Helpers
// ============================================================================

/** Get all documents for a given authority */
export function getRegistryByAuthority(
  authority: AgencyAuthority
): AgencyPdfDocument[] {
  switch (authority) {
    case 'msbfs':
      return MSBFS_REGISTRY
    case 'nfs':
      return NFS_REGISTRY
    case 'elsak-fs':
      return ELSAK_FS_REGISTRY
    case 'kifs':
      return KIFS_REGISTRY
    case 'bfs':
      return BFS_REGISTRY
    case 'srvfs':
      return SRVFS_REGISTRY
    case 'skvfs':
      return SKVFS_REGISTRY
    case 'scb-fs':
      return SCB_FS_REGISTRY
    case 'ssmfs':
      return SSMFS_REGISTRY
    case 'stafs':
      return STAFS_REGISTRY
    default:
      throw new Error(`Unknown authority: ${authority}`)
  }
}

/** All registry arrays for iteration */
const ALL_REGISTRIES: AgencyPdfDocument[][] = [
  MSBFS_REGISTRY,
  NFS_REGISTRY,
  ELSAK_FS_REGISTRY,
  KIFS_REGISTRY,
  BFS_REGISTRY,
  SRVFS_REGISTRY,
  SKVFS_REGISTRY,
  SCB_FS_REGISTRY,
  SSMFS_REGISTRY,
  STAFS_REGISTRY,
]

/** Get a single document by document number */
export function getDocumentByNumber(
  documentNumber: string
): AgencyPdfDocument | undefined {
  for (const registry of ALL_REGISTRIES) {
    const found = registry.find((d) => d.documentNumber === documentNumber)
    if (found) return found
  }
  return undefined
}

/** All supported authority values */
export const SUPPORTED_AUTHORITIES: AgencyAuthority[] = [
  'msbfs',
  'nfs',
  'elsak-fs',
  'kifs',
  'bfs',
  'srvfs',
  'skvfs',
  'scb-fs',
  'ssmfs',
  'stafs',
]

/**
 * Generate a URL-friendly slug from a document number.
 * "MSBFS 2020:1" → "msbfs-2020-1"
 * "NFS 2023:13" → "nfs-2023-13"
 */
export function generateAgencySlug(documentNumber: string): string {
  return documentNumber
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/:/g, '-')
    .replace(/\./g, '')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generate the article ID for HTML output.
 * "MSBFS 2020:1" → "MSBFS2020-1"
 * Follows the pattern from Dev Notes: {AUTHORITY}{YEAR}-{NUMBER}
 */
export function generateArticleId(documentNumber: string): string {
  return documentNumber.replace(/\s+/g, '').replace(/:/g, '-')
}

/**
 * Generate the local PDF filename.
 * "MSBFS 2020:1" → "MSBFS-2020-1.pdf"
 */
export function getPdfFileName(documentNumber: string): string {
  return documentNumber.replace(/\s+/g, '-').replace(/:/g, '-') + '.pdf'
}

/**
 * Build metadata for an agency PDF document.
 */
export function buildAgencyMetadata(
  doc: AgencyPdfDocument,
  tokenUsage: { input: number; output: number },
  cost: number
): AgencyPdfMetadata {
  return {
    source: doc.sourceDomain,
    method: 'claude-pdf-ingestion' as const,
    model: 'claude-sonnet-4-5-20250929',
    pdfUrl: doc.pdfUrl,
    processedAt: new Date().toISOString(),
    tokenUsage,
    cost,
    tier: 'STANDALONE' as const,
    isConsolidated: doc.isConsolidated,
    ...(doc.notes ? { notes: doc.notes } : {}),
  }
}

export interface AgencyPdfMetadata {
  source: string
  method: 'claude-pdf-ingestion'
  model: string
  pdfUrl: string
  processedAt: string
  tokenUsage: { input: number; output: number }
  cost: number
  tier: 'STANDALONE'
  isConsolidated: boolean
  notes?: string
  adrs_strategy?: 'full' | 'per-chapter'
}
