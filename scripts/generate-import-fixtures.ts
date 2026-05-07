/**
 * Story 24.2: Generate sample fixtures for the import-pipeline parser tests.
 *
 * Run via: `pnpm tsx scripts/generate-import-fixtures.ts`
 *
 * Authors 5 hand-curated fixtures into `tests/fixtures/import/`. Source data
 * is a mix of real Swedish law titles (high-confidence matchable) and
 * deliberately misleading rows (paraphrased titles, missing SFS numbers,
 * extra whitespace) to exercise `detectColumns` heuristic edge cases.
 *
 * Re-run any time the fixtures need regenerating; the resulting binary
 * .xlsx files are committed under tests/fixtures/import/.
 */

import * as XLSX from 'xlsx'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const OUTPUT_DIR = join(process.cwd(), 'tests', 'fixtures', 'import')

// ============================================================================
// Notisum-export style — full column set, typical Swedish-law-list export
// ============================================================================

const NOTISUM_ROWS: Array<[string, string, string, string, string]> = [
  ['SFS-nr', 'Lagens namn', 'Rättsområde', 'Egen status', 'Kommentar'],
  [
    '1977:1160',
    'Arbetsmiljölag',
    'Arbetsmiljö',
    'Aktuell',
    'Grundläggande arbetsmiljölagstiftning',
  ],
  ['1962:381', 'Lag om allmän försäkring', 'Socialförsäkring', 'Gäller', ''],
  [
    '1998:808',
    'Miljöbalk',
    'Miljö',
    'Aktuell',
    'Stor lag — flera kapitel relevanta',
  ],
  [
    '2018:218',
    'Lag med kompletterande bestämmelser till EU:s dataskyddsförordning',
    'Dataskydd',
    'Aktuell',
    'Tillsammans med GDPR',
  ],
  [
    '2009:400',
    'Offentlighets- och sekretesslag',
    'Offentlig förvaltning',
    'Gäller',
    '',
  ],
  [
    '1976:580',
    'Lag om medbestämmande i arbetslivet',
    'Arbetsrätt',
    'Aktuell',
    'MBL',
  ],
  ['1982:80', 'Lag om anställningsskydd', 'Arbetsrätt', 'Aktuell', 'LAS'],
  ['2000:592', 'Skattebetalningslag', 'Skatt', 'Inaktuell', 'Ersatt'],
  [
    '1990:1342',
    'Lag om straff för marknadsmissbruk på finansmarknaden',
    'Finans',
    'Gäller',
    '',
  ],
  [
    '1995:1554',
    'Årsredovisningslag',
    'Redovisning',
    'Aktuell',
    'Tillsammans med BFL',
  ],
  ['1999:1078', 'Bokföringslag', 'Redovisning', 'Aktuell', ''],
  [
    '2003:389',
    'Lag om elektronisk kommunikation',
    'Kommunikation',
    'Gäller',
    '',
  ],
  [
    '',
    'Föreskrifter om arbetsplatsers utformning',
    'Arbetsmiljö',
    'Aktuell',
    'AFS-paraply',
  ],
  ['1974:152', 'Regeringsformen', 'Konstitutionell rätt', 'Gäller', ''],
  ['1949:381', 'Föräldrabalk', 'Familjerätt', 'Gäller', ''],
  ['2018:222', 'Lag om bostadsanpassningsbidrag', 'Bostad', 'Aktuell', ''],
  [
    '2008:962',
    'Lag om valfrihetssystem',
    'Offentlig upphandling',
    'Aktuell',
    'LOV',
  ],
  [
    '2016:1145',
    'Lag om offentlig upphandling',
    'Offentlig upphandling',
    'Aktuell',
    'LOU',
  ],
  ['2017:725', 'Kommunallag', 'Offentlig förvaltning', 'Aktuell', ''],
  ['2010:900', 'Plan- och bygglag', 'Bygg', 'Aktuell', 'PBL'],
  ['1990:1144', 'Begravningslag', 'Civil', 'Gäller', ''],
  [
    '2003:1210',
    'Lag om finansiell rådgivning till konsumenter',
    'Finans',
    'Aktuell',
    '',
  ],
  ['2010:751', 'Betaltjänstlag', 'Finans', 'Aktuell', ''],
  [
    '1991:980',
    'Lag om handel med finansiella instrument',
    'Finans',
    'Aktuell',
    '',
  ],
  // Deliberately misleading: paraphrased title, no SFS — heuristic edge case
  [
    '',
    'Personuppgiftsregler för anställda',
    'Personal',
    'Egen',
    'Egen sammanställning',
  ],
  // Extra whitespace + lowercase — edge case
  ['  1980:578 ', 'ordningslag', 'allmän ordning', 'gäller', '  '],
  [
    '2018:1197',
    'Lag om gymnasieingenjörsutbildning',
    'Utbildning',
    'Aktuell',
    '',
  ],
  [
    '2017:151',
    'Lag om meddelarskydd i vissa enskilda verksamheter',
    'Arbetsrätt',
    'Gäller',
    '',
  ],
  ['2002:599', 'Lag om grupprättegång', 'Process', 'Aktuell', ''],
  [
    '2018:1179',
    'Lag om tillgänglighet till digital offentlig service',
    'Tillgänglighet',
    'Aktuell',
    'WCAG',
  ],
]

// ============================================================================
// Lex.nu-export style — simpler columns, no comment field
// ============================================================================

const LEX_ROWS: Array<[string, string, string, string]> = [
  ['Titel', 'SFS', 'Område', 'Datum'],
  ['Arbetsmiljölag', '1977:1160', 'Arbetsmiljö', '1977-12-19'],
  ['Lag om anställningsskydd', '1982:80', 'Arbetsrätt', '1982-02-24'],
  [
    'Lag om medbestämmande i arbetslivet',
    '1976:580',
    'Arbetsrätt',
    '1976-06-10',
  ],
  ['Diskrimineringslag', '2008:567', 'Arbetsrätt', '2008-06-11'],
  ['Föräldraledighetslag', '1995:584', 'Arbetsrätt', '1995-06-01'],
  [
    'Lag om handel med finansiella instrument',
    '1991:980',
    'Finans',
    '1991-06-13',
  ],
  ['Patientdatalag', '2008:355', 'Vård', '2008-06-04'],
  ['Hälso- och sjukvårdslag', '2017:30', 'Vård', '2017-02-08'],
  ['Bokföringslag', '1999:1078', 'Redovisning', '1999-12-09'],
  ['Aktiebolagslag', '2005:551', 'Bolag', '2005-06-02'],
  ['Lag om ekonomisk förening', '2018:672', 'Bolag', '2018-06-13'],
  ['Lag om handelsbolag och enkla bolag', '1980:1102', 'Bolag', '1980-12-16'],
  ['Brottsbalk', '1962:700', 'Straffrätt', '1962-12-21'],
  ['Rättegångsbalk', '1942:740', 'Process', '1942-07-18'],
  [
    'Lag om upphovsrätt till litterära och konstnärliga verk',
    '1960:729',
    'IP',
    '1960-12-30',
  ],
  ['Patentlag', '1967:837', 'IP', '1967-12-01'],
  ['Varumärkeslag', '2010:1877', 'IP', '2010-12-22'],
  ['Konsumentköplag', '1990:932', 'Konsument', '1990-09-13'],
  [
    'Lag om distansavtal och avtal utanför affärslokaler',
    '2005:59',
    'Konsument',
    '2005-02-10',
  ],
  ['Konsumenttjänstlag', '1985:716', 'Konsument', '1985-08-15'],
  ['Marknadsföringslag', '2008:486', 'Marknadsföring', '2008-06-05'],
  ['Köplag', '1990:931', 'Civilrätt', '1990-09-13'],
  ['Skadeståndslag', '1972:207', 'Civilrätt', '1972-06-02'],
  ['Försäkringsavtalslag', '2005:104', 'Försäkring', '2005-03-08'],
  ['Lag om straff för terroristbrott', '2003:148', 'Straffrätt', '2003-04-23'],
]

// ============================================================================
// Consultant Excel — title-only matching, no SFS column at all
// ============================================================================

const CONSULTANT_ROWS: Array<[string, string, string, string]> = [
  ['Lagstiftning', 'Kategori', 'Lagansvarig', 'Anteckning'],
  ['Arbetsmiljölag', 'Arbetsmiljö', 'Anna Andersson', 'Översyn årligen'],
  ['Brandskyddsföreskrifter', 'Brand', 'Erik Eriksson', 'Räddningstjänsten'],
  ['Diskrimineringslag', 'Personal', 'Anna Andersson', ''],
  ['Bokföringslag', 'Ekonomi', 'Sofia Bergström', 'Tillsammans med ÅRL'],
  ['Årsredovisningslag', 'Ekonomi', 'Sofia Bergström', ''],
  [
    'Lag med kompletterande bestämmelser till EU:s dataskyddsförordning',
    'Dataskydd',
    'Karin Lindqvist',
    'GDPR-kompletteringar',
  ],
  ['Aktiebolagslag', 'Bolag', 'Sofia Bergström', ''],
  [
    'Förordning om allmänna handlingars elektroniska form',
    'Offentlig förvaltning',
    'Per Hansson',
    '',
  ],
  ['Lag om offentlig upphandling', 'Upphandling', 'Per Hansson', 'LOU'],
  ['Lag om valfrihetssystem', 'Upphandling', 'Per Hansson', 'LOV'],
  ['Plan- och bygglag', 'Bygg', 'Mats Lindberg', ''],
  [
    'Boverkets byggregler',
    'Bygg',
    'Mats Lindberg',
    'BBR — myndighetsföreskrift',
  ],
  [
    'Miljöbalk',
    'Miljö',
    'Karin Lindqvist',
    'Stor lag — kapitel 2, 6, 9, 10 mest relevanta',
  ],
  ['Avfallsförordning', 'Miljö', 'Karin Lindqvist', ''],
  ['Lag om kemiska produkter', 'Kemikalier', 'Karin Lindqvist', ''],
  // Misleading: not a real law name — heuristic test
  [
    'Vår interna brandsäkerhetspolicy',
    'Brand',
    'Erik Eriksson',
    'Egen — inte lagstiftning',
  ],
  ['Lag om elektronisk kommunikation', 'IT/telekom', 'Per Hansson', ''],
  [
    'Personalledighetslag',
    'Personal',
    'Anna Andersson',
    'Olika ledigheter — sjuk, semester, föräldra',
  ],
  [
    'Patientdatalag',
    'Vård',
    'Karin Lindqvist',
    'Endast om vi har vårdkontakter',
  ],
  ['Lag om medicintekniska produkter', 'Vård', 'Karin Lindqvist', ''],
  ['Hälso- och sjukvårdslag', 'Vård', 'Karin Lindqvist', ''],
  ['Lag om läkemedel', 'Vård', 'Karin Lindqvist', ''],
  ['Mervärdesskattelag', 'Skatt', 'Sofia Bergström', 'Moms'],
  ['Inkomstskattelag', 'Skatt', 'Sofia Bergström', ''],
  ['Skatteförfarandelag', 'Skatt', 'Sofia Bergström', ''],
  ['Tullag', 'Tull', 'Sofia Bergström', 'Vid import'],
  ['Konsumentkreditlag', 'Konsument', 'Anna Andersson', ''],
  ['Lag om elcertifikat', 'Energi', 'Mats Lindberg', ''],
  ['Lag om byggande av järnväg', 'Infrastruktur', 'Mats Lindberg', ''],
  ['Lag om statlig fastighetsskatt', 'Skatt', 'Sofia Bergström', ''],
  ['Försäkringsrörelselag', 'Försäkring', 'Sofia Bergström', ''],
  ['Lag om värdepappersmarknaden', 'Finans', 'Sofia Bergström', ''],
  ['Lag om bank- och finansieringsrörelse', 'Finans', 'Sofia Bergström', ''],
  [
    'Lag om åtgärder mot penningtvätt och finansiering av terrorism',
    'AML',
    'Sofia Bergström',
    '',
  ],
  ['Lag om värdepappersfonder', 'Finans', 'Sofia Bergström', ''],
  // Edge: title with leading/trailing whitespace
  [
    '  Lag om straff för marknadsmissbruk på finansmarknaden  ',
    'Finans',
    'Sofia Bergström',
    '',
  ],
  ['Yrkestrafiklag', 'Transport', 'Mats Lindberg', ''],
  ['Trafikförordning', 'Transport', 'Mats Lindberg', ''],
  ['Körkortslag', 'Transport', 'Mats Lindberg', 'Personalbilar'],
  ['Sjölag', 'Transport', 'Mats Lindberg', ''],
  ['Lag om lufttransporter', 'Transport', 'Mats Lindberg', ''],
  ['Skyddslag', 'Säkerhet', 'Erik Eriksson', ''],
  ['Lag om explosiva varor', 'Säkerhet', 'Erik Eriksson', ''],
  ['Lag om brandfarliga och explosiva varor', 'Säkerhet', 'Erik Eriksson', ''],
  ['Lag om civilt försvar', 'Beredskap', 'Erik Eriksson', ''],
  ['Räddningstjänstlag', 'Beredskap', 'Erik Eriksson', ''],
  // Misleading: very short title, no clear pattern
  [
    'LAS',
    'Personal',
    'Anna Andersson',
    'Förkortning för Lag om anställningsskydd',
  ],
  [
    'MBL',
    'Personal',
    'Anna Andersson',
    'Förkortning för Lag om medbestämmande',
  ],
  [
    'Diskrimineringsombudsmannens föreskrifter',
    'Personal',
    'Anna Andersson',
    '',
  ],
  ['Förordning om statliga myndigheters arkiv', 'Arkiv', 'Per Hansson', ''],
]

// ============================================================================
// Internal spreadsheet — Swedish Excel default semicolon-delimited CSV
// ============================================================================

const INTERNAL_CSV_HEADER = 'Lag;Nummer;Område;Ansvarig'
const INTERNAL_CSV_ROWS = [
  'Arbetsmiljölag;1977:1160;Arbetsmiljö;Anna A.',
  'Lag om anställningsskydd;1982:80;Personal;Anna A.',
  'Diskrimineringslag;2008:567;Personal;Anna A.',
  'Bokföringslag;1999:1078;Ekonomi;Sofia B.',
  'Årsredovisningslag;1995:1554;Ekonomi;Sofia B.',
  'Aktiebolagslag;2005:551;Bolag;Sofia B.',
  'Plan- och bygglag;2010:900;Bygg;Mats L.',
  'Miljöbalk;1998:808;Miljö;Karin L.',
  'Avfallsförordning;2011:927;Miljö;Karin L.',
  'Lag med kompletterande bestämmelser till EU:s dataskyddsförordning;2018:218;Dataskydd;Karin L.',
  'Lag om offentlig upphandling;2016:1145;Upphandling;Per H.',
  'Patientdatalag;2008:355;Vård;Karin L.',
  // Edge: empty SFS number for one row
  'Vår interna IT-säkerhetspolicy;;Säkerhet;Erik E.',
  'Lag om elektronisk kommunikation;2003:389;Telekom;Per H.',
  'Mervärdesskattelag;1994:200;Skatt;Sofia B.',
]

// ============================================================================
// Single-column paste — title-only fallback
// ============================================================================

const PASTE_LINES = [
  'Arbetsmiljölag',
  'Lag om anställningsskydd',
  'Diskrimineringslag',
  'Bokföringslag',
  'Aktiebolagslag',
  'Plan- och bygglag',
  'Miljöbalk',
  'Lag med kompletterande bestämmelser till EU:s dataskyddsförordning',
  'Lag om offentlig upphandling',
  'Patientdatalag',
]

// ============================================================================
// Generators
// ============================================================================

function aoaToWorkbook(aoa: unknown[][], sheetName: string): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}

async function writeXlsx(
  filename: string,
  aoa: unknown[][],
  sheetName = 'Lagar'
) {
  const wb = aoaToWorkbook(aoa, sheetName)
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  await writeFile(join(OUTPUT_DIR, filename), Buffer.from(buffer))
  console.log(`✓ ${filename}`)
}

async function writeText(filename: string, content: string) {
  await writeFile(join(OUTPUT_DIR, filename), content, 'utf8')
  console.log(`✓ ${filename}`)
}

async function main() {
  await writeXlsx('notisum-export-sample.xlsx', NOTISUM_ROWS)
  await writeXlsx('lex-nu-export-sample.xlsx', LEX_ROWS)
  await writeXlsx('consultant-excel-sample.xlsx', CONSULTANT_ROWS, 'Lagar')

  // Internal spreadsheet — UTF-8 with BOM (mirrors Swedish Excel CSV export).
  const csvContent =
    '﻿' + INTERNAL_CSV_HEADER + '\n' + INTERNAL_CSV_ROWS.join('\n') + '\n'
  await writeText('internal-spreadsheet-sample.csv', csvContent)

  await writeText('paste-input-sample.txt', PASTE_LINES.join('\n') + '\n')

  console.log('\nFixtures written to', OUTPUT_DIR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
