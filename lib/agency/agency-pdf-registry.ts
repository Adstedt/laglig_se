/**
 * Agency PDF Document Registry
 * Story 9.2: MSBFS & NFS regulation ingestion
 * Story 8.17: Registry expansion + content hashes for change detection
 *
 * Typed registry of agency regulation PDFs for download and ingestion.
 * Designed to be extended for additional authorities in Story 9.3.
 */

import { createHash } from 'crypto'

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
// MSBFS Documents (64) — includes 3 MCFFS (new designation from 2026)
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
    sourceUrl: 'https://lagen.nu/msbfs/2020:1',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
    notes: 'Landing page missing on mcf.se, using lagen.nu fallback',
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
  {
    documentNumber: 'MSBFS 2020:6',
    title: 'Föreskrifter om informationssäkerhet för statliga myndigheter',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2020-6-foreskrifter-om-informationssakerhet-for-statliga-myndigheter.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20206/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2020:7',
    title:
      'Föreskrifter om säkerhetsåtgärder i informationssystem för statliga myndigheter',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2020-7-foreskrifter-om-sakerhetsatgarder-i-informationssystem-for-statliga-myndigheter.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20207/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2020:8',
    title:
      'Föreskrifter om rapportering av it-incidenter för statliga myndigheter',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2020-8-foreskrifter-om-rapportering-av-it-incidenter-for-statliga-myndigheter.pdf',
    sourceUrl:
      'https://www.mcf.se/sv/regler/gallande-regler/foreskrifter-om-rapportering-av-it-incidenter-for-statliga-myndigheter-msbfs-20208/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2024:5',
    title:
      'Föreskrifter om statliga myndigheters redovisning av risk- och sårbarhetsanalyser',
    pdfUrl:
      'https://www.mcf.se/contentassets/5b2258f8e66c444aaa6ae308e13ede22/msbfs-2024-5.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20245/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
    notes: 'Replaced MSBFS 2016:7.',
  },
  {
    documentNumber: 'MSBFS 2025:4',
    title:
      'Föreskrifter och allmänna råd om statliga myndigheters uppgifter inför och vid höjd beredskap',
    pdfUrl:
      'https://www.mcf.se/contentassets/c9b7b373563f43eaa163d52494284ef2/msbfs-2025-4.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20254/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  // --- Story 8.17: 46 new MSBFS/MCFFS entries below ---
  {
    documentNumber: 'MSBFS 2009:1',
    title:
      'Föreskrifter om ändring i vissa författningar som beslutats av Statens räddningsverk, Krisberedskapsmyndigheten eller Sprängämnesinspektionen',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/39a5696f-7409-4966-aa70-2725860360dd.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20091/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2009:4',
    title:
      'Föreskrifter om ackreditering av organ som ska utföra kontroll av tankar avsedda för transport av farligt gods på land',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/38fb0955-a096-4ae6-b459-e07a77b3e58e.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20094/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2009:5',
    title:
      'Föreskrifter om ackreditering av organ som ska utföra certifiering av förpackningar, IBC-behållare och storförpackningar för transport av farligt gods på land',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/91d950c4-d253-4a5e-a7fe-ca367ff4abfc.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20095/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2009:6',
    title:
      'Föreskrifter om upphävande av Sprängämnesinspektionens föreskrifter (SÄIFS 2001:2) om brandfarliga gaser och vätskor i husvagnar, husbilar, manskapsvagnar m.m.',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/c34efdb2-4013-4651-af38-19e74e9d1708.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20096/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2009:7',
    title: 'Föreskrifter och allmänna råd om ledningssystem för naturgas',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/30646012-6392-4f90-a6bf-500ce7d4f647.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20097/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2011:4',
    title:
      'Föreskrifter om ackreditering av organ som ska kontrollera fordon för transport av farligt gods',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/02357304-5d4c-4a71-a70a-bce784a84638.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20114/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2011:5',
    title: 'Föreskrifter om varning utomhus',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/c3a9c12b-922f-4d15-bec7-56530c925e32.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20115/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2012:1',
    title:
      'Föreskrifter om upphävande av vissa författningar som beslutats av Krisberedskapsmyndigheten',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/aeaebd9c-7de5-4a70-96b7-8f50f53fbd69.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20121/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2012:3',
    title:
      'Föreskrifter om upphävande av Statens räddningsverks föreskrifter (2006:11) om förpackning och märkning av explosiva varor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/69251ab1-fa9c-4910-bd91-fe7408310c70.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20123/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2012:4',
    title:
      'Föreskrifter om upphävande av SÄIFS 1996:3 om förbudsanslag och varningsanslag samt märkning av rörledningar vid hantering av brandfarliga och explosiva varor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/19b716a6-81af-4ca4-a03f-cc196ad0ead5.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20124/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2013:1',
    title:
      'Föreskrifter om länsstyrelsens planer för hantering av översvämningsrisker (riskhanteringsplaner)',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/c47e6d96-e159-436c-8320-8c53aa9e5694.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20131/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2014:2',
    title: 'Allmänna råd om skyldigheter vid farlig verksamhet',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/77e70309-8617-45a5-8020-85c33237ddbd.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20142/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2015:4',
    title:
      'Föreskrifter och allmänna råd om landstings risk- och sårbarhetsanalyser',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/ab59ff87-822f-4aa9-8d37-41e43a63b4b4.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20154/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2015:6',
    title:
      'Föreskrifter om tillhandahållande av pyrotekniska artiklar och ammunition',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/169ccc8a-26ff-4fba-aa46-cdc3e8708dc8.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20156/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2016:6',
    title:
      'Föreskrifter om upphävande av Statens räddningsverks föreskrifter (SRVFS 2007:3) om erkännande av utländska yrkeskvalifikationer',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/822340df-1f58-4153-a03f-2cfad25cdd23.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20166/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2017:3',
    title:
      'Föreskrifter om information vid nödsituationer där det finns risk för strålning',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/db726845-587e-4503-aa43-90638fdf0a9c.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20173/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2018:2',
    title:
      'Föreskrifter om upphävande av Sprängämnesinspektionens föreskrifter och allmänna råd (SÄIFS 2000:6) om gasapparater',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/eda59568-2d7e-4ffa-bf2a-c36886aa0ef4.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20182/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2018:4',
    title: 'Föreskrifter om folkrättsliga rådgivare vid länsstyrelserna',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/ab079f1e-49d0-491b-b70b-ad9586e8590b.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20184/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2018:12',
    title:
      'Föreskrifter om ändring i föreskrifterna (MSBFS 2010:4) om vilka varor som ska anses utgöra brandfarliga eller explosiva varor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs2018_12.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-201812/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2018:13',
    title:
      'Föreskrifter och allmänna råd om hantering av ammoniumnitratemulsioner, -suspensioner och -geler (ANE)',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs2018_13.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-201813/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2019:2',
    title:
      'Föreskrifter om ändring i föreskrifterna (MSBFS 2016:4) om tillstånd för överföring, import och export av explosiva varor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2019-2-foreskrifter-om-andring-i-msbfs-2016-4.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20192/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2020:2',
    title:
      'Föreskrifter om vissa undantag för Försvarsmakten och gästande utländska militära förband vid hantering och transport av farliga ämnen',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2020-2.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20202/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2020:5',
    title:
      'Föreskrifter om ändring av MSBFS 2015:9 om säkerhetsrådgivare för transport av farligt gods',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-20205-foreskrifter-om-andring-av-myndigheten-for-samhallsskydd-och-beredskaps-foreskrifter-msbfs-20159-om-sakerhetsradgivare-for-transport-av-farligt-gods.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20205/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2020:11',
    title:
      'Föreskrifter om upphävande av Statens räddningsverks föreskrifter om skriftlig redogörelse för brandskyddet (SRVFS 2003:10) och allmänna råd och kommentarer om skriftlig redogörelse för brandskyddet (SRVFS 2004:4)',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2020-11.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-202011/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2021:1',
    title:
      'Föreskrifter och allmänna råd om innehåll och struktur i kommunens handlingsprogram för förebyggande verksamhet och räddningstjänst',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2021-01-foreskrifter-och-allmanna-rad-om-innehall-och-struktur-i-kommunens-handlingsprogram-for-forebyggande--verksa.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20211/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2021:3',
    title: 'Föreskrifter om deltagare i verksamhet med explosiva varor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2021-3-foreskrifter-om-deltagare-i-verksamhet-med-explosiva-varor.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20213/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2021:4',
    title:
      'Föreskrifter och allmänna råd om ledning av kommunal räddningstjänst',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2021-4-foreskrifter-och-allmanna-rad-om-ledning-av-kommunal-raddningstjanst.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20214/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2021:5',
    title:
      'Föreskrifter om undersökningsrapport efter kommunal räddningsinsats',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2021-foreskrifter-om-undersokningsrapport-efter-kommunal-raddningsinsats.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20215/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2021:8',
    title:
      'Föreskrifter och allmänna råd om hur kommunen ska planera och utföra sin tillsyn enligt lagen (2003:778) om skydd mot olyckor',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2021-8-foreskrifter-om-hur-kommunen-ska-planera-och-utfora-sin-tillsyn-enligt-lagen-om-skydd-mot-olyckor.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20218/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2022:1',
    title:
      'Föreskrifter och allmänna råd om behörighet att vara räddningschef eller räddningsledare i kommunal räddningstjänst',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2022-1-behorighet-att-vara-raddningschef-eller-raddningsledare.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20221/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2022:2',
    title:
      'Föreskrifter om förmåner till instruktörer inom frivillig försvarsutbildning',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/forfattningar/msbfs-2022-2.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20222/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2024:6',
    title:
      'Förordning om upphävande av MSBFS 2020:3 om omsorg för barn med vårdnadshavare i samhällsviktig verksamhet',
    pdfUrl:
      'https://www.mcf.se/contentassets/cc2fd9372e8a49e8bafb206858d00817/msbfs-2024-6-forordning.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20246/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2024:7',
    title:
      'Föreskrifter om det nationella tillståndsregistret för explosiva varor (NATEV)',
    pdfUrl:
      'https://www.mcf.se/contentassets/e773fe756208408ca55be5f698b65d17/msbfs-2024-7.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20247/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2024:9',
    title:
      'Föreskrifter om vilka samhällsviktiga verksamheter som omfattas av lagen (2023:560) om granskning av utländska direktinvesteringar',
    pdfUrl:
      'https://www.mcf.se/contentassets/7f034b28e4804e5e9908a958319f8f60/msbfs-2024-9.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20249/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2024:11',
    title: 'Föreskrifter om transport av farligt gods på järnväg (RID-S)',
    pdfUrl:
      'https://www.mcf.se/contentassets/77a1cd6cca7d478f97984499e5e8276c/rid-s-2025-klar.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-202411/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
    stubOnly: true,
    notes:
      'RID-S: Similar to ADR-S, very large with complex tables. Stored as stub.',
  },
  {
    documentNumber: 'MSBFS 2024:14',
    title:
      'Föreskrifter om ledighet och fritid under tjänstgöring för totalförsvarspliktiga som fullgör civilplikt i det civila försvaret',
    pdfUrl:
      'https://www.mcf.se/contentassets/e46355dae538400bb92d8c32ee340199/msbfs-2024-14.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-202414/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:1',
    title:
      'Föreskrifter och allmänna råd om planläggning för utrymning under höjd beredskap',
    pdfUrl:
      'https://www.mcf.se/contentassets/fb126badeab34608872650faa5bfc73c/msbfs-2025-1.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20251/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:3',
    title: 'Föreskrifter om civila myndigheters signalskyddsberedskap',
    pdfUrl:
      'https://www.mcf.se/contentassets/d378ffa645df4c3e8897aaa736fce14d/msbfs-2025-3.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20253/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:5',
    title:
      'Föreskrifter om anmälningsskyldighet vid användning av explosiva varor eller förvaring av explosiva varor i flyttbart förråd',
    pdfUrl:
      'https://www.mcf.se/contentassets/3e4db5d448524e7aa4b16ea73cda420e/msbfs-2025-5.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20255/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:6',
    title:
      'Föreskrifter om behörighetskrav för antagning till utbildning i skydd mot olyckor',
    pdfUrl:
      'https://www.mcf.se/contentassets/4a5ffbcec157465b87ca8a9728605c3f/msbfs-2025-6.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20256/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:7',
    title:
      'Föreskrifter om krigsplacering av totalförsvarspliktiga som ska fullgöra civilplikt i det civila försvaret',
    pdfUrl:
      'https://www.mcf.se/contentassets/99ae178cb4ae454e91a73b106008f94e/msbfs-2025-7.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20257/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:8',
    title:
      'Föreskrifter om utbildning av totalförsvarspliktiga som fullgör civilplikt i det civila försvaret',
    pdfUrl:
      'https://www.mcf.se/contentassets/a44dd430f4b44683b2e458085e7a887f/msbfs-2025-8.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20258/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:9',
    title:
      'Föreskrifter om upphävande av MSBFS 2018:8, MSBFS 2018:9, MSBFS 2018:10, MSBFS 2018:11 och MSBFS 2024:4',
    pdfUrl:
      'https://www.mcf.se/contentassets/cce72f43045d4b48989a402e9451225b/msbfs-2025-9.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-20259/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'MSBFS 2025:10',
    title:
      'Upphävande av Statens räddningsverks allmänna råd och kommentarer om ersättning till kommuner för räddningstjänst och viss sanering (SRVFS 2004:11)',
    pdfUrl:
      'https://www.mcf.se/contentassets/93a14934fbc047d397742fb180a69a46/msbfs-2025-10.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/msbfs-202510/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  // --- MCFFS (MCF = new name for MSB from 2026-01-01) ---
  {
    documentNumber: 'MCFFS 2026:1',
    title:
      'Föreskrifter om anmälan och identifiering av väsentliga och viktiga verksamhetsutövare',
    pdfUrl:
      'https://www.mcf.se/contentassets/2fb733fa000a4bba98cf9b406f4c9153/mcffs-2026-1.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/mcffs-20261/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
    notes: 'MCFFS = new designation after MSB renamed to MCF (2026-01-01)',
  },
  {
    documentNumber: 'MCFFS 2026:2',
    title:
      'Föreskrifter och allmänna råd om hur kommunen ska planera och utföra sin tillsyn enligt lagen (2010:1011) om brandfarliga och explosiva varor',
    pdfUrl:
      'https://www.mcf.se/contentassets/71f9e9b82ced453a9ea351729b12c56d/mcffs-2026-2.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/mcffs-20262/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
    notes: 'MCFFS = new designation after MSB renamed to MCF (2026-01-01)',
  },
  {
    documentNumber: 'MCFFS 2026:3',
    title:
      'Föreskrifter om tillstånd till överföring, import och export av explosiva varor',
    pdfUrl:
      'https://www.mcf.se/contentassets/25c17deb6d0e4fc5bc05b0f91d4be2ab/mcffs-2026-3.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/mcffs-20263/',
    authority: 'msbfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
    notes: 'MCFFS = new designation after MSB renamed to MCF (2026-01-01)',
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
    sourceUrl: 'https://lagen.nu/nfs/2001:2',
    authority: 'nfs',
    sourceDomain: 'naturvardsverket.se',
    isConsolidated: false,
    notes:
      'Landing page removed from naturvardsverket.se, using lagen.nu fallback',
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
// ELSÄK-FS Documents (20) — Elsäkerhetsverket
// ============================================================================

export const ELSAK_FS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'ELSÄK-FS 2011:2',
    title:
      'Elsäkerhetsverkets föreskrifter om elstängselapparater och till dessa anslutna elstängsel',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2011-2.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2011-2/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2011:3',
    title: 'Elsäkerhetsverkets föreskrifter om ansökan om drifttillstånd',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2011-3.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2011-3/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2011:4',
    title:
      'Elsäkerhetsverkets föreskrifter om anmälan av ibruktagande av en kontaktledning',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2011-4.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2011-4/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2012:1',
    title:
      'Elsäkerhetsverkets föreskrifter om anmälan av olycksfall, allvarliga tillbud och driftstörningar',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2012-1.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2012-1/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2016:1',
    title: 'Elsäkerhetsverkets föreskrifter om elektrisk utrustning',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2016-1.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2016-1/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2016:2',
    title:
      'Elsäkerhetsverkets föreskrifter om elektrisk utrustning och elektriska skyddssystem avsedda för användning i potentiellt explosiva atmosfärer',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2016-2.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2016-2/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2016:3',
    title: 'Elsäkerhetsverkets föreskrifter om elektromagnetisk kompatibilitet',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2016-3.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2016-3/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2017:1',
    title:
      'Elsäkerhetsverkets föreskrifter om ersättning och avgifter vid marknadskontroll av viss elektrisk utrustning',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2017-1.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-1/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
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
    documentNumber: 'ELSÄK-FS 2017:4',
    title: 'Elsäkerhetsverkets föreskrifter om auktorisation som elinstallatör',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2017-4-konsoliderad.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-4-konsoliderad-version/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'ELSÄK-FS 2019:1',
    title:
      'Elsäkerhetsverkets föreskrifter om stickproppar och uttag för allmänbruk',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2019-1.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2019-1/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
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
  // --- Story 8.17: 5 new ELSÄK-FS entries below ---
  {
    documentNumber: 'ELSÄK-FS 2003:3',
    title:
      'Elsäkerhetsverkets föreskrifter om upphävande av föreskrifter om elektrisk utrustning för explosionsfarlig miljö',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2003-3.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2003-3/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2008:4',
    title:
      'Elsäkerhetsverkets föreskrifter om upphävande av föreskrifter om elektriska starkströmsanläggningar',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2008-4.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2008-4/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2011:1',
    title:
      'Elsäkerhetsverkets föreskrifter om elektriska egenskaper för leksaker',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2011-1.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2011-1/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2014:1',
    title:
      'Elsäkerhetsverkets föreskrifter om upphävande av avgiftsföreskrifter',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2014-1.pdf',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2014-1/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'ELSÄK-FS 2021:7',
    title:
      'Elsäkerhetsverkets föreskrifter om upphävande av föreskrifter om elsäkerhet vid arbete i yrkesmässig verksamhet',
    pdfUrl:
      'https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-2021-7',
    sourceUrl:
      'https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2021-7/',
    authority: 'elsak-fs',
    sourceDomain: 'elsakerhetsverket.se',
    isConsolidated: false,
    notes: 'Server URL lacks .pdf extension but serves valid PDF',
  },
]

// ============================================================================
// KIFS Documents (3) — Kemikalieinspektionen
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
    documentNumber: 'KIFS 2017:8',
    title:
      'Kemikalieinspektionens föreskrifter om leksakers brännbarhet och kemiska egenskaper',
    pdfUrl:
      'https://www.kemi.se/download/18.6c26dc74178e406dc61e61/1656494745713/KIFS-2017-8-konsoliderad.pdf',
    sourceUrl:
      'https://www.kemi.se/lagar-och-regler/lagstiftningar-inom-kemikalieomradet/kemikalieinspektionens-foreskrifter-kifs/kifs-20178',
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
// BFS Documents (55) — Boverket
// ============================================================================

export const BFS_REGISTRY: AgencyPdfDocument[] = [
  // --- Existing entry ---
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
  // --- Story 8.17: New building regulations (BFS 2024 series) ---
  {
    documentNumber: 'BFS 2024:4',
    title:
      'Boverkets föreskrifter om aktsamhet vid bygg-, rivnings- och markåtgärder',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-4/pdf/BFS2024-4.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-4',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:6',
    title:
      'Boverkets föreskrifter och allmänna råd om bärförmåga, stadga och beständighet i byggnader m.m.',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-6/pdf/BFS2024-6.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-6',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:7',
    title:
      'Boverkets föreskrifter och allmänna råd om säkerhet i händelse av brand i byggnader',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-7/pdf/BFS2024-7.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-7',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:8',
    title:
      'Boverkets föreskrifter om skydd med hänsyn till hygien, hälsa och miljö samt hushållning med vatten och avfall',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-8/pdf/BFS2024-8.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-8',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:9',
    title: 'Boverkets föreskrifter om säkerhet vid användning av byggnader',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-9/pdf/BFS2024-9.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-9',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:10',
    title: 'Boverkets föreskrifter om skydd mot buller i byggnader',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-10/pdf/BFS2024-10.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-10',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:11',
    title: 'Boverkets föreskrifter om bostäders lämplighet för sitt ändamål',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-11/pdf/BFS2024-11.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-11',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:12',
    title:
      'Boverkets föreskrifter om byggnaders tillgänglighet och användbarhet för personer med nedsatt rörelse- eller orienteringsförmåga',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-12/pdf/BFS2024-12.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-12',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2024:13',
    title: 'Boverkets föreskrifter om krav på tomter m.m.',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-13/pdf/BFS2024-13.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-13',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  // --- Old building codes (transition period until 2026-06-30) ---
  {
    documentNumber: 'BFS 2011:6',
    title: 'Boverkets byggregler – föreskrifter och allmänna råd (BBR)',
    pdfUrl:
      'https://rinfo.boverket.se/BFS2011-6/dok/BFS2024-5_konsolidering.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-6',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: true,
    stubOnly: true,
    notes: 'BBR - hundreds of pages, too large for LLM pipeline',
  },
  {
    documentNumber: 'BFS 2011:10',
    title:
      'Boverkets föreskrifter och allmänna råd om tillämpning av europeiska konstruktionsstandarder (EKS)',
    pdfUrl:
      'https://www.boverket.se/resources/constitutiontextstore/eks/PDF/konsoliderad_eks_bfs_2011-10.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-10',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: true,
    stubOnly: true,
    notes: 'EKS - hundreds of pages, too large for LLM pipeline',
  },
  // --- Planning regulations ---
  {
    documentNumber: 'BFS 2024:2',
    title: 'Boverkets föreskrifter om översiktsplan',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-2/pdf/BFS2024-2.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-2',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2025:1',
    title: 'Boverkets föreskrifter om regionplan',
    pdfUrl: 'https://rinfo.boverket.se/BFS2025-1/pdf/BFS2025-1.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2025-1',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2020:5',
    title: 'Boverkets föreskrifter om detaljplan',
    pdfUrl: 'https://rinfo.boverket.se/BFS2020-5/pdf/BFS2020-5.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2020-5',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2020:6',
    title: 'Boverkets allmänna råd om redovisning av reglering i detaljplan',
    pdfUrl: 'https://rinfo.boverket.se/BFS2020-6/pdf/BFS2020-6.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2020-6',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2020:8',
    title: 'Boverkets föreskrifter och allmänna råd om planbeskrivning',
    pdfUrl: 'https://rinfo.boverket.se/BFS2020-8/pdf/BFS2020-8.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2020-8',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  // --- Certification regulations ---
  {
    documentNumber: 'BFS 2024:1',
    title:
      'Boverkets föreskrifter och allmänna råd om certifierade byggprojekteringsföretag',
    pdfUrl: 'https://rinfo.boverket.se/BFS2024-1/pdf/BFS2024-1.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2024-1',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:14',
    title:
      'Boverkets föreskrifter och allmänna råd om certifiering av kontrollansvariga',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-14/pdf/BFS2011-14.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-14',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:15',
    title:
      'Boverkets föreskrifter och allmänna råd om certifiering av sakkunniga avseende kulturvärden',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-15/pdf/BFS2011-15.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-15',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:17',
    title:
      'Boverkets föreskrifter och allmänna råd om certifiering av sakkunniga inom brandskydd',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-17/pdf/BFS2011-17.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-17',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:18',
    title:
      'Boverkets föreskrifter och allmänna råd om certifiering av sakkunniga av tillgänglighet',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-18/pdf/BFS2011-18.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-18',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2007:5',
    title:
      'Boverkets föreskrifter och allmänna råd för certifiering av energiexpert',
    pdfUrl: 'https://rinfo.boverket.se/BFS2007-5/pdf/BFS2007-5.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2007-5',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2013:3',
    title:
      'Boverkets föreskrifter och allmänna råd om certifiering av vissa tjänster på energiområdet',
    pdfUrl: 'https://rinfo.boverket.se/BFS2013-3/pdf/BFS2013-3.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2013-3',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2023:9',
    title: 'Boverkets föreskrifter om avgifter för godkännande av intygsgivare',
    pdfUrl: 'https://rinfo.boverket.se/BFS2023-9/pdf/BFS2023-9.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2023-9',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  // --- Energy regulations ---
  {
    documentNumber: 'BFS 2007:4',
    title:
      'Boverkets föreskrifter och allmänna råd om energideklaration för byggnader',
    pdfUrl: 'https://rinfo.boverket.se/BFS2007-4/pdf/BFS2007-4.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2007-4',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2016:12',
    title:
      'Boverkets föreskrifter och allmänna råd om fastställande av byggnadens energianvändning vid normalt brukande (BEN)',
    pdfUrl: 'https://rinfo.boverket.se/BFS2016-12/pdf/BFS2016-12.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2016-12',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2022:3',
    title:
      'Boverkets föreskrifter och allmänna råd om energimätning i byggnader',
    pdfUrl: 'https://rinfo.boverket.se/BFS2022-3/pdf/BFS2022-3.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2022-3',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2013:8',
    title:
      'Boverkets föreskrifter om utredning om alternativa energiförsörjningssystem',
    pdfUrl: 'https://rinfo.boverket.se/BFS2013-8/pdf/BFS2013-8.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2013-8',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  // --- Lifts and motor-driven devices ---
  {
    documentNumber: 'BFS 2011:12',
    title:
      'Boverkets föreskrifter och allmänna råd om hissar och vissa andra motordrivna anordningar',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-12/pdf/BFS2011-12.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-12',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
    stubOnly: true,
    notes: 'Over 100 PDF pages, exceeds Claude API limit',
  },
  {
    documentNumber: 'BFS 2025:11',
    title:
      'Boverkets föreskrifter om krav för användning av motordrivna anordningar',
    pdfUrl: 'https://rinfo.boverket.se/BFS2025-11/pdf/BFS2025-11.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2025-11',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2025:12',
    title:
      'Boverkets föreskrifter om kontroll samt ackreditering av kontrollorgan för motordrivna anordningar',
    pdfUrl: 'https://rinfo.boverket.se/BFS2025-12/pdf/BFS2025-12.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2025-12',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2025:13',
    title:
      'Boverkets föreskrifter om hissar och säkerhetskomponenter till hissar',
    pdfUrl: 'https://rinfo.boverket.se/BFS2025-13/pdf/BFS2025-13.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2025-13',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  // --- Other valid base regulations ---
  {
    documentNumber: 'BFS 2025:2',
    title:
      'Boverkets föreskrifter och allmänna råd om ekonomiska planer, kostnadskalkyler, intygsgivare och intygsgivning',
    pdfUrl: 'https://rinfo.boverket.se/BFS2025-2/pdf/BFS2025-2.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2025-2',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2021:7',
    title: 'Boverkets föreskrifter om klimatdeklaration för byggnader',
    pdfUrl: 'https://rinfo.boverket.se/BFS2021-7/pdf/BFS2021-7.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2021-7',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2021:2',
    title:
      'Boverkets föreskrifter och allmänna råd om utrustning för laddning av elfordon',
    pdfUrl: 'https://rinfo.boverket.se/BFS2021-2/pdf/BFS2021-2.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2021-2',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2020:2',
    title:
      'Boverkets allmänna råd om omgivningsbuller utomhus från industriell verksamhet',
    pdfUrl: 'https://rinfo.boverket.se/BFS2020-2/pdf/BFS2020-2.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2020-2',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2018:12',
    title: 'Boverkets föreskrifter om bostadsanpassningsbidrag',
    pdfUrl: 'https://rinfo.boverket.se/BFS2018-12/pdf/BFS2018-12.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2018-12',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2018:7',
    title:
      'Boverkets föreskrifter och allmänna råd om bidrag till åtgärder mot radon i småhus',
    pdfUrl: 'https://rinfo.boverket.se/BFS2018-7/pdf/BFS2018-7.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2018-7',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2017:2',
    title:
      'Boverkets föreskrifter om statsbidrag till allmänna samlingslokaler',
    pdfUrl: 'https://rinfo.boverket.se/BFS2017-2/pdf/BFS2017-2.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2017-2',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2017:1',
    title: 'Boverkets allmänna råd om bredbandsanslutning',
    pdfUrl: 'https://rinfo.boverket.se/BFS2017-1/pdf/BFS2017-1.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2017-1',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2016:5',
    title:
      'Boverkets föreskrifter och allmänna råd om anpassningar och avsteg för tillfälliga anläggningsboenden',
    pdfUrl: 'https://rinfo.boverket.se/BFS2016-5/pdf/BFS2016-5.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2016-5',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:19',
    title:
      'Boverkets föreskrifter och allmänna råd om typgodkännande och tillverkningskontroll',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-19/pdf/BFS2011-19.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-19',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:13',
    title:
      'Boverkets föreskrifter och allmänna råd om avhjälpande av enkelt avhjälpta hinder',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-13/pdf/BFS2011-13.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-13',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:11',
    title:
      'Boverkets föreskrifter och allmänna råd om effektivitetskrav för nya värmepannor som eldas med flytande eller gasformigt bränsle',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-11/pdf/BFS2011-11.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-11',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  // --- General advice (Allmänna råd) ---
  {
    documentNumber: 'BFS 2015:1',
    title:
      'Boverkets allmänna råd om friyta för lek och utevistelse vid fritidshem, förskolor, skolor',
    pdfUrl: 'https://rinfo.boverket.se/BFS2015-1/pdf/BFS2015-1.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2015-1',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2013:15',
    title: 'Boverkets allmänna råd om rivningsavfall',
    pdfUrl: 'https://rinfo.boverket.se/BFS2013-15/pdf/BFS2013-15.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2013-15',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2013:11',
    title: 'Boverkets allmänna råd om brandbelastning',
    pdfUrl: 'https://rinfo.boverket.se/BFS2013-11/pdf/BFS2013-11.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2013-11',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2013:7',
    title:
      'Boverkets föreskrifter och allmänna råd om språkkrav för prestandadeklarationer',
    pdfUrl: 'https://rinfo.boverket.se/BFS2013-7/pdf/BFS2013-7.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2013-7',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2012:12',
    title:
      'Boverkets allmänna råd om anmälan för åtgärder som inte är bygglovspliktiga',
    pdfUrl: 'https://rinfo.boverket.se/BFS2012-12/pdf/BFS2012-12.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2012-12',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2012:8',
    title:
      'Boverkets allmänna råd om den kontrollansvariges självständiga ställning',
    pdfUrl: 'https://rinfo.boverket.se/BFS2012-8/pdf/BFS2012-8.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2012-8',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2012:7',
    title: 'Boverkets allmänna råd om funktionskontroll av ventilationssystem',
    pdfUrl: 'https://rinfo.boverket.se/BFS2012-7/pdf/BFS2012-7.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2012-7',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2011:27',
    title:
      'Boverkets allmänna råd om analytisk dimensionering av byggnaders brandskydd',
    pdfUrl: 'https://rinfo.boverket.se/BFS2011-27/pdf/BFS2011-27.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2011-27',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2016:16',
    title:
      'Boverkets allmänna råd om ersättning för provningskostnader vid marknadskontroll av byggprodukter',
    pdfUrl: 'https://rinfo.boverket.se/BFS2016-16/pdf/BFS2016-16.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2016-16',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'BFS 2017:7',
    title:
      'Boverkets allmänna råd om ekonomiska planer och kostnadskalkyler för bostadsrättsföreningar',
    pdfUrl: 'https://rinfo.boverket.se/BFS2017-7/pdf/BFS2017-7.pdf',
    sourceUrl: 'https://forfattningssamling.boverket.se/detaljer/BFS2017-7',
    authority: 'bfs',
    sourceDomain: 'boverket.se',
    isConsolidated: false,
  },
]

// ============================================================================
// SRVFS Documents (7) — Legacy Räddningsverket (hosted by MCF)
// ============================================================================

export const SRVFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'SRVFS 1993:6',
    title:
      'Statens räddningsverks föreskrifter om provning, certifiering och kontroll av komponenter till skyddsrum',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/766d3729-cad1-4ab6-894e-461b9bbbccd1.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/srvfs-19936/',
    authority: 'srvfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
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
  {
    documentNumber: 'SRVFS 2006:3',
    title:
      'Statens räddningsverks allmänna råd och kommentarer om brandskydd i gästhamnar',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/f58d8814-c46a-4f8a-8e47-343efbb8544c.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/srvfs-20063/',
    authority: 'srvfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SRVFS 2007:1',
    title:
      'Statens räddningsverks allmänna råd och kommentarer om brandvarnare i bostäder',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/48edc0c8-c291-4ff7-aed4-d0c5105b6eeb.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/srvfs-20071/',
    authority: 'srvfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SRVFS 2007:5',
    title:
      'Statens räddningsverks allmänna råd och kommentarer om utrustning för vattenlivräddning vid hamnar, kajer, badplatser och liknande vattennära anläggningar',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/b4233754-5601-4189-baf8-2df9eab13de4.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/srvfs-20075/',
    authority: 'srvfs',
    sourceDomain: 'mcf.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SRVFS 2008:3',
    title:
      'Statens räddningsverks allmänna råd och kommentarer om brandskydd i hotell, pensionat, vandrarhem och liknande anläggningar',
    pdfUrl:
      'https://www.mcf.se/siteassets/dokument/regler/rs/f2d0051e-7fc9-4f88-a08d-c4087088da1f.pdf',
    sourceUrl: 'https://www.mcf.se/sv/regler/gallande-regler/srvfs-20083/',
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
// SSMFS Documents (40) — Strålsäkerhetsmyndigheten
// ============================================================================

export const SSMFS_REGISTRY: AgencyPdfDocument[] = [
  {
    documentNumber: 'SSMFS 2014:4',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om laser, starka laserpekare och intensivt pulserat ljus',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/0fe4c6bd44c64bd6948a9d7c2b40653d/ssmfs-20144-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-laser-starka-laserpekare-och-intensivt-pulserat-ljus-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2014/ssmfs-20144/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2018:1',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om grundläggande bestämmelser för tillståndspliktig verksamhet med joniserande strålning',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/edd48d6fa0114e9cb3ae07f3956babcc/ssmfs-20181-stralsakerhetsmyndighetens-foreskrifter-om-grundlaggande-bestammelser-for-tillstandspliktig-verksamhet-med-joniserande-stralning-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20181/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
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
  {
    documentNumber: 'SSMFS 2018:3',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om undantag från strålskyddslagen och om friklassning av material, byggnadsstrukturer och områden',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/fd378df462fa47a58935551d27bace50/ssmfs-20183-stralsakerhetsmyndighetens-foreskrifter-om-undantag-fran-stralskyddslagen-och-om-friklassning-av-material-byggnadsstrukturer-och-omraden.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20183/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2018:5',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om medicinska exponeringar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/5ca0970e939642f68ac4b0f5adfd391a/ssmfs-20185-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-medicinska-exponeringar-konsoliderad-version2.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20185/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2018:6',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om industriell radiografering',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/9c2f6f3923fa44098f8c006e5e9ce269/ssmfs-20186-stralsakerhetsmyndighetens-foreskrifter-om-industriell-radiografering.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20186/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2018:10',
    title: 'Strålsäkerhetsmyndighetens föreskrifter om radon på arbetsplatser',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/b37d087c7a704be29a6adfbddfa9d1bf/ssmfs-201810-stralsakerhetsmyndighetens-foreskrifter-om-radon-pa-arbetsplatser.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-201810/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2018:11',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om exponering för kosmisk strålning i flyg- och rymdverksamhet',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/caabe6ce617248bb974419537ac3586d/ssmfs-201811-stralsakerhetsmyndighetens-foreskrifter-om-exponering-for-kosmisk-stralning-i-flyg--och-rymdverksamhet.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-201811/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2025:1',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om kosmetiska solarier och artificiella solningsanläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/8dbd453345894b088797423c9c2b4291/stralsakerhetsmyndighetens-foreskrifter-ssmfs-20251-om-kosmetiska-solarier-och-artificiella-solningsanlaggningar.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2025/ssmfs-20251/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2008:18',
    title:
      'Strålsäkerhetsmyndighetens allmänna råd om begränsning av allmänhetens exponering för elektromagnetiska fält',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/c4057ae5e05b4bf198e9fc8e6ae78bcb/ssmfs-200818-stralsakerhetsmyndighetens-allmanna-rad-om-begransning-av-allmanhetens-exponering-for-elektromagnetiska-falt.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200818/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  // --- Story 8.17: 30 new SSMFS entries below ---
  {
    documentNumber: 'SSMFS 2008:1',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om säkerhet i kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/6b6ce39b86b845c998cdc0062c07353e/ssmfs-20081-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-sakerhet-i-karntekniska-anlaggningar-konsoliderad-version',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-20081/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:3',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om kontroll av kärnämne m.m.',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/312cb222816447e0ad6978ed2db9bad2/ssmfs-20083-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-kontroll-av-karnamne-mm-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-20083/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:12',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om fysiskt skydd av kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/7bcb3ba95d5b47b09f4f183622e4a13f/ssmfs-200812-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-fysiskt-skydd-av-karntekniska-anlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200812/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:13',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om mekaniska anordningar i vissa kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/cfa8774e1f0c4542a1795115039b8c77/ssmfs-200813-stralsakerhetsmyndighetens-foreskrifter-om-mekaniska-anordningar-i-vissa-karntekniska-anlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200813/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:21',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om säkerhet vid slutförvaring av kärnämne och kärnavfall',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/62a08705503a42c59e55599ceb93f5c6/ssmfs-200821-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-sakerhet-vid-slutforvaring-av-karnamne-och-karnavfall-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200821/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:23',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om skydd av människors hälsa och miljön vid utsläpp av radioaktiva ämnen från vissa kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/54597d9d80e0480f8ea97221fc78c0dd/ssmfs-200823-stralsakerhetsmyndighetens-foreskrifter-om-skydd-av-manniskors-halsa-och-miljon-vid-utslapp-av-radioaktiva-amnen-fran-vissa-karntekniska-anlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200823/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:24',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om strålskyddsföreståndare vid kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/c25ca73935334c69ab6224ffd0eed7b4/ssmfs-200824-stralsakerhetsmyndighetens-foreskrifter-om-stralskyddsforestandare-vid-karntekniska-anlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200824/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:26',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om personstrålskydd i verksamhet med joniserande strålning vid kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/b7962b6144894a55ab2410793521cde9/ssmfs-200826-stralsakerhetsmyndighetens-foreskrifter-om-personstralskydd-i-verksamhet-med-joniserande-stralning-vid-karntekniska-anlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200826/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:32',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om kompetens hos driftpersonal vid reaktoranläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/4d7f43900df449c5a0bde28fa998fdcd/ssmfs-200832-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-kompetens-hos-driftpersonal-vid-reaktoranlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200832/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:37',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om skydd av människors hälsa och miljön vid slutligt omhändertagande av använt kärnbränsle och kärnavfall',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/07c1cb6c92a2430791ad53d9004ac668/ssmfs-200837-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-skydd-av-manniskors-halsa-och-miljon-vid-slutligt-omhander-tagande-av-anvant-karnbransle-och-karnavfall-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200837/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:38',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om arkivering vid kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/5b7bbdde970f49d188200c437eecabe2/ssmfs-200838-stralsakerhetsmyndighetens-foreskrifter-om-arkivering-vid-karntekniska-anlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200838/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:44',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om rökdetektorer som innehåller radioaktivt ämne',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/9d5f01497e6843e7ae07bac00e3185cf/ssmfs-200844-stralsakerhetsmyndigheten-foreskrifter-om-rokdetektorer-som-innehaller-radioaktivt-amne-konsoliderad-version',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200844/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
    notes: 'Server URL lacks .pdf extension but serves valid PDF',
  },
  {
    documentNumber: 'SSMFS 2008:47',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om brandvarnare som innehåller strålkälla med radioaktivt ämne',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/1905e8c3500b43aebbc7a7abf2759d68/ssmfs-200847-stralsakerhetsmyndighetens-foreskrifter-om-brandvarnare-som-innehaller-stralkalla-med-radioaktivt-amne-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200847/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2008:48',
    title:
      'Strålsäkerhetsmyndighetens allmänna råd om hygieniska riktvärden för ultraviolett strålning',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/bea26857aac84ece89c5a421f4f0956a/ssmfs-200848-stralsakerhetsmyndighetens-allmanna-rad-om-hygieniska-riktvarden-for-ultraviolett-stralning.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2008/ssmfs-200848/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2009:1',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om kontroll av gränsöverskridande transporter av radioaktivt avfall samt använt kärnbränsle',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/26b6730bd7744fb7a4b3d7ed7298c186/ssmfs-20091-stralsakerhetsmyndighetens-foreskrifter-om-kontroll-av-gransoverskridande-transporter-av-radioaktivt-avfall-samt-anvant-karnbransle-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2009/ssmfs-20091/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2012:2',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om bäringskikare, pejlkompasser och riktmedel som innehåller tritium',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/f8e2309fabbd4b90af61bd9113a27c16/ssmfs-20122-stralsakerhetsmyndighetens-foreskrifter-om-baringskikare-pejlkompasser-och-riktmedel-som-innehaller-tritium-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2012/ssmfs-20122/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2012:3',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om hantering av kontaminerad aska',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/706f4513a77e4ef5b4b2695f74f2c856/ssmfs-20123-stralsakerhetsmyndighetens-foreskrifter-om-hantering-av-kontaminerad-aska-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2012/ssmfs-20123/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2014:2',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om beredskap vid kärntekniska anläggningar',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/3df0139a626e47ddb148a39ddd06db7e/ssmfs-20142-stralsakerhetsmyndighetens-foreskrifter-om-beredskap-vid-karntekniska-anlaggningar-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2014/ssmfs-20142/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2018:4',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om naturligt förekommande radioaktivt material och byggnadsmaterial',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/21d0d48c405a434eb027b8f42734ced7/ssmfs-20184-stralsakerhetsmyndighetens-foreskrifter-om-naturligt-forekommande-radioaktivt-material-och-byggnadsmaterial.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20184/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2018:7',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om tillståndspliktig veterinärverksamhet',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/0e92b1ded62a471385d9499b9c1502b2/ssmfs-20187-stralsakerhetsmyndighetens-foreskrifter-om-tillstandspliktig-veterinarverksamhet.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20187/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2018:8',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om röntgenutrustningar och slutna strålkällor som används vid skolor',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/33f23c43042046c6bf0b91173b68c856/ssmfs-20188-stralsakerhetsmyndighetens-foreskrifter-om-rontgenutrustningar-och-slutna-stralkallor-som-anvands-vid-skolor.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20188/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2018:9',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om godkända persondosimetritjänster',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/b3c5538e17264c7da2350d374f98836a/ssmfs-20189-stralsakerhetsmyndighetens-foreskrifter-om-godkanda-persondosimetritjanster-konsoliderad-version.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2018/ssmfs-20189/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: true,
  },
  {
    documentNumber: 'SSMFS 2021:1',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om avgifter vid riksmätplatsen för joniserande strålning och radonlaboratoriet',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/a038d9dbac2f40e68d4cfe504cfe8f66/ssmfs20211',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2021/ssmfs-20211/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
    notes: 'Server URL lacks .pdf extension but serves valid PDF',
  },
  {
    documentNumber: 'SSMFS 2021:4',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om konstruktion av kärnkraftsreaktorer',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/f8ad3093d56441e6a6b97300605fde84/ssmfs-20214-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-konstruktion-av-karnkraftsreaktorer.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2021/ssmfs-20214/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2021:5',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om värdering och redovisning av strålsäkerhet för kärnkraftsreaktorer',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/838113dadbbe49778664f5a4f2f305f2/ssmfs-20215-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-vardering-och-redovisning-av-stralsakerhet-for-karnkraftsreaktorer.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2021/ssmfs-20215/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2021:6',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om drift av kärnkraftsreaktorer',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/80946ac596624f45a977e0dc0efbb9be/ssmfs-20216-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-drift-av-karnkraftsreaktorer.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2021/ssmfs-20216/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2021:7',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om omhändertagande av kärntekniskt avfall',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/a238c112463c4c639c9be26303d54018/ssmfs-20217-stralsakerhetsmyndighetens-foreskrifter-om-omhandertagande-av-karntekniskt-avfall.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2021/ssmfs-20217/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2022:15',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter om undantag från lagen (2010:950) om ansvar och ersättning vid radiologiska olyckor',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/c7275edff96342859e1e4ff087633d8a/ssmfs-202215-stralsakerhetsmyndighetens-foreskrifter-om--undantag-fran-lagen-2010950-om-ansvar-och--ersattning-vid-radiologiska-olyckor.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2022/ssmfs-202215/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2023:1',
    title: 'Strålsäkerhetsmyndighetens föreskrifter om säkerhetsskydd',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/00eb9705e82f4744a532dfd72260b56f/ssmfs-20231.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2023/ssmfs-20231-stralsakerhetsmyndighetens-foreskrifter--om-sakerhetsskydd.pdf/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
  },
  {
    documentNumber: 'SSMFS 2025:7',
    title:
      'Strålsäkerhetsmyndighetens föreskrifter och allmänna råd om övervakning av stråldoser till arbetstagare i radiologiska nödsituationer',
    pdfUrl:
      'https://www.stralsakerhetsmyndigheten.se/contentassets/9d164cd17687431d818721d51cf24bf9/ssmfs-20257-stralsakerhetsmyndighetens-foreskrifter-och-allmanna-rad-om-overvakning-av-straldoser-till-arbetstagare-i-radiologiska-nodsituationer.pdf',
    sourceUrl:
      'https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-2025/ssmfs-20257-stralsakerhetsmyndighetens-foreskrifter-om-overvakning-av-straldoser-till-arbetstagare-i-radiologiska-nodsituationer/',
    authority: 'ssmfs',
    sourceDomain: 'stralsakerhetsmyndigheten.se',
    isConsolidated: false,
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
 * Compute SHA-256 hash of content for change detection.
 * Story 8.17: Used to detect when regulation content changes.
 */
export function computeContentHash(htmlContent: string): string {
  return createHash('sha256').update(htmlContent, 'utf-8').digest('hex')
}

/**
 * Build metadata for an agency PDF document.
 * When htmlContent is provided, computes contentHash for change detection (Story 8.17).
 */
export function buildAgencyMetadata(
  doc: AgencyPdfDocument,
  tokenUsage: { input: number; output: number },
  cost: number,
  htmlContent?: string
): AgencyPdfMetadata {
  const base: AgencyPdfMetadata = {
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

  if (htmlContent) {
    base.contentHash = computeContentHash(htmlContent)
    base.lastIngested = new Date().toISOString()
    base.sourceUrl = doc.sourceUrl
  }

  return base
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
  /** sha256(html_content) — for change detection (Story 8.17) */
  contentHash?: string
  /** ISO timestamp of last ingestion (Story 8.17) */
  lastIngested?: string
  /** Landing page URL — same as registry sourceUrl (Story 8.17) */
  sourceUrl?: string
}
