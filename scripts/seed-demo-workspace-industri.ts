/* eslint-disable no-console */
/**
 * Stages the INDUSTRI demo workspace for marketing screenshots (Story 26.5).
 * Fictitious company — allabolag-collision-checked 2026-06-11 ("Bruksviken"
 * returned no matches; nearest hit "BRUKS AB" is a different name; clean).
 *
 * NOTE: REACH/CLP are stored under CELEX document numbers in the catalog —
 * 32006R1907 / 32008R1272, never "EG 1907/2006" (brief, catalog check).
 *
 * Run: pnpm tsx scripts/seed-demo-workspace-industri.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { PrismaClient, WorkspaceRole } from '@prisma/client'
// eslint-disable-next-line import/first
import { seedIndustryWorkspace, STATUS } from './lib/seed-industry-workspace'

const { U, P, X, N } = STATUS
const prisma = new PrismaClient()

seedIndustryWorkspace(prisma, {
  ownerEmail: 'alexander.adstedt+111@kontorab.se',
  workspaceName: 'Bruksviken Mekaniska AB',
  workspaceSlug: 'bruksviken-mekaniska',
  personas: [
    {
      email: 'lars.ekholm@bruksviken.example',
      name: 'Lars Ekholm',
      role: WorkspaceRole.ADMIN, // produktionschef
      avatar: '/demo-team/johan.png',
    },
    {
      email: 'karin.aberg@bruksviken.example',
      name: 'Karin Åberg',
      role: WorkspaceRole.MEMBER, // KMA-ansvarig
      avatar: '/demo-team/sofia.png',
    },
    {
      email: 'mikael.lund@bruksviken.example',
      name: 'Mikael Lund',
      role: WorkspaceRole.MEMBER, // underhållsansvarig
      avatar: '/demo-team/erik.png',
    },
    {
      email: 'eva.strand@bruksviken.example',
      name: 'Eva Strand',
      role: WorkspaceRole.HR_MANAGER, // miljöansvarig
      avatar: '/demo-team/maria.png',
    },
  ],
  // Modal target: AFS 2023:4 Produkter – maskiner ("från paragraf till checklista")
  expandGroup: 'Arbetsmiljö & maskinsäkerhet',
  kravTexts: [
    'Riskbedömning genomförs innan en ny eller ombyggd maskin tas i drift.',
    'Skyddsanordningar kontrolleras enligt underhållsschemat.',
    'Bruksanvisning på svenska finns tillgänglig vid varje maskin.',
    'Rutin för säker avställning vid service (LOTO) följs och dokumenteras.',
    'Maskinoperatörer har dokumenterad utbildning för sin utrustning.',
  ],
  groups: [
    {
      name: 'Arbetsmiljö & maskinsäkerhet',
      items: [
        {
          documentNumber: 'SFS 1977:1160',
          status: U,
          commentary:
            'Grundansvaret för arbetsmiljön i verkstaden — styr SAM och skyddsorganisationen.',
        },
        {
          documentNumber: 'AFS 2023:1',
          status: U,
          commentary:
            'Systematiskt arbetsmiljöarbete: riskbedömningar, handlingsplan och årlig uppföljning.',
        },
        {
          documentNumber: 'AFS 2023:4',
          status: P,
          commentary:
            '14 CE-märkta bearbetningsmaskiner i drift — två ombyggda svarvar kräver ny riskbedömning.',
        },
        {
          documentNumber: 'AFS 2023:11',
          status: P,
          commentary:
            'Besiktning av lyftutrustning och truckar samt krav på personlig skyddsutrustning.',
        },
        {
          documentNumber: 'AFS 2023:12',
          status: U,
          commentary:
            'Utformning av produktionslokalerna — belysning, ventilation och gångvägar.',
        },
      ],
    },
    {
      name: 'Kemikalier & exponering',
      items: [
        {
          documentNumber: '32006R1907',
          status: P,
          commentary:
            'REACH: säkerhetsdatablad för samtliga kemiska produkter och kontroll av tillståndsämnen.',
        },
        {
          documentNumber: '32008R1272',
          status: U,
          commentary:
            'CLP: klassificering och märkning av kemikalier i produktionen.',
        },
        {
          documentNumber: 'AFS 2023:10',
          status: X,
          commentary:
            'Kemikalieförteckningen är inte uppdaterad efter bytet av skärvätska — riskbedömning saknas.',
        },
        {
          documentNumber: 'AFS 2023:14',
          status: P,
          commentary:
            'Gränsvärden för luftvägsexponering — 2026 års sänkningar för diisocyanater och krom (VI) påverkar oss.',
        },
      ],
    },
    {
      name: 'Miljö & egenkontroll',
      items: [
        {
          documentNumber: 'SFS 1998:808',
          status: P,
          commentary:
            'Hänsynsreglerna och egenkontrollen för C-anläggningen — anmäld till kommunen.',
        },
        {
          documentNumber: 'SFS 2013:251',
          status: U,
          commentary:
            'Verksamheten klassad som C enligt verksamhetskod — ändrad produktion kan ändra klassningen.',
        },
        {
          documentNumber: 'SFS 1998:901',
          status: P,
          commentary:
            'Dokumenterad egenkontroll med ansvarsfördelning, riskbedömning och kemikalieförteckning.',
        },
        {
          documentNumber: 'SFS 2020:614',
          status: P,
          commentary:
            'Sortering och spårbarhet för farligt avfall — skärvätskor, spån och emballage.',
        },
      ],
    },
    {
      name: 'Brand & säkerhet',
      items: [
        {
          documentNumber: 'SFS 2010:1011',
          status: U,
          commentary:
            'Tillstånd för brandfarlig vara (gasol och lösningsmedel) — föreståndare utsedd.',
        },
        { documentNumber: 'SFS 2003:778', status: U },
      ],
    },
    {
      name: 'Energi & lokaler',
      items: [
        {
          documentNumber: 'SFS 2014:266',
          status: N,
          commentary:
            'Energikartläggning — bedömning av om vi når gränsvärdena för stora företag pågår.',
        },
      ],
    },
  ],
})
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
