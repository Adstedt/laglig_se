/**
 * Story 24.2: Generate the user-facing import template (mall) at
 * `public/templates/laglista-import-mall.xlsx`. Linked from the upload
 * UI's "Ladda ner mall (.xlsx)" link. Run via:
 *   pnpm tsx scripts/generate-import-mall.ts
 *
 * Story 24.6 follow-up: expanded to 20 representative documents covering
 * SFS laws, AFS föreskrifter, and EU regulations/directives so users see
 * the matcher's open-set range when they download the mall.
 */

import * as XLSX from 'xlsx'
import { writeFile } from 'fs/promises'
import { join } from 'path'

type Row = [string, string, string, string, string]

const HEADER: Row = [
  'Titel',
  'SFS-nummer',
  'Område',
  'Lagansvarig',
  'Kommentar',
]

// 20 representative documents across the catalog's three big content-types.
// Doc numbers verified against the local catalog (2026-05-07) so the demo
// upload lands rows in HIGH/MEDIUM tiers — not UNMATCHED — for everything
// except a single bogus row included on purpose to demo "Begär att lägga
// till i katalogen".
//
// SFS rows include the `SFS ` prefix to hit Branch A (exact canonical) and
// land HIGH; AFS/EU keep their natural prefix forms.
const DATA: Row[] = [
  // -- SFS laws (10) -----------------------------------------------------
  [
    'Arbetsmiljölag',
    'SFS 1977:1160',
    'Arbetsmiljö',
    'Anna Andersson',
    'Översyn årligen',
  ],
  [
    'Lag om anställningsskydd (LAS)',
    'SFS 1982:80',
    'Arbetsrätt',
    'Anna Andersson',
    '',
  ],
  [
    'Diskrimineringslag',
    'SFS 2008:567',
    'Arbetsrätt',
    'Anna Andersson',
    'DO är tillsynsmyndighet',
  ],
  ['Föräldraledighetslag', 'SFS 1995:584', 'Arbetsrätt', 'Anna Andersson', ''],
  ['Semesterlag', 'SFS 1977:480', 'Arbetsrätt', 'Anna Andersson', ''],
  [
    'Lag om medbestämmande i arbetslivet (MBL)',
    'SFS 1976:580',
    'Arbetsrätt',
    'Anna Andersson',
    '',
  ],
  ['Bokföringslag', 'SFS 1999:1078', 'Ekonomi', 'Sofia Bergström', ''],
  ['Årsredovisningslag', 'SFS 1995:1554', 'Ekonomi', 'Sofia Bergström', ''],
  ['Aktiebolagslag', 'SFS 2005:551', 'Bolagsrätt', 'Sofia Bergström', ''],
  [
    'Miljöbalk',
    'SFS 1998:808',
    'Miljö',
    'Karin Lindqvist',
    'Stora delar relevanta',
  ],
  // -- AFS föreskrifter (5) — current versions per catalog ---------------
  // Note: AFS 2020:5 (Arbetsanpassning) was subsumed by AFS 2023:2; AFS
  // 2019:3 (Medicinska kontroller) was replaced by AFS 2023:15. Template
  // uses the catalog-current ids so the demo lands clean matches.
  [
    'Systematiskt arbetsmiljöarbete',
    'AFS 2001:1',
    'Arbetsmiljö',
    'Anna Andersson',
    'Grundläggande SAM-föreskrift',
  ],
  [
    'Organisatorisk och social arbetsmiljö',
    'AFS 2015:4',
    'Arbetsmiljö',
    'Anna Andersson',
    'OSA-föreskriften',
  ],
  [
    'Medicinska kontroller i arbetslivet',
    'AFS 2023:15',
    'Arbetsmiljö',
    'Anna Andersson',
    '',
  ],
  [
    'Planering och organisering',
    'AFS 2023:2',
    'Arbetsmiljö',
    'Anna Andersson',
    'Innehåller arbetsanpassning',
  ],
  [
    'Arbetsutrustning och personlig skyddsutrustning',
    'AFS 2023:11',
    'Arbetsmiljö',
    'Anna Andersson',
    '',
  ],
  // -- EU regulations + directives (5) -----------------------------------
  [
    'Dataskyddsförordningen (GDPR)',
    '(EU) 2016/679',
    'Dataskydd',
    'Erik Johansson',
    'Personuppgiftsbehandling',
  ],
  ['AI-förordningen', '(EU) 2024/1689', 'Teknik & AI', 'Erik Johansson', ''],
  [
    'REACH — kemikalieförordningen',
    '(EG) 1907/2006',
    'Miljö',
    'Karin Lindqvist',
    '',
  ],
  [
    'CLP-förordningen',
    '(EG) 1272/2008',
    'Miljö',
    'Karin Lindqvist',
    'Klassificering & märkning',
  ],
  // One deliberately stale row to demo the "Saknas i katalogen" path:
  [
    'CSRD — hållbarhetsrapportering',
    '2022/2464/EU',
    'Hållbarhet',
    'Sofia Bergström',
    'Direktiv — eventuellt ej i katalogen',
  ],
]

async function main() {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...DATA])
  // Column widths tuned to fit the longest title + EU-style document numbers
  // without squeezing the area / responsible / commentary columns.
  ws['!cols'] = [
    { wch: 48 }, // Titel
    { wch: 18 }, // SFS-nummer
    { wch: 18 }, // Område
    { wch: 22 }, // Lagansvarig
    { wch: 40 }, // Kommentar
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Mall')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const path = join(
    process.cwd(),
    'public',
    'templates',
    'laglista-import-mall.xlsx'
  )
  await writeFile(path, Buffer.from(buffer))
  console.log('✓', path, `(${DATA.length} docs)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
