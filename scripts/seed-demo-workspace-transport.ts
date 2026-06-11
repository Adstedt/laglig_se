/* eslint-disable no-console */
/**
 * Stages the TRANSPORT demo workspace for marketing screenshots (Story 26.5).
 * Fictitious company — allabolag-collision-checked 2026-06-11 ("Vindåsen"
 * returned no matches; clean).
 *
 * Run: pnpm tsx scripts/seed-demo-workspace-transport.ts
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
  workspaceName: 'Vindåsen Åkeri & Logistik AB',
  workspaceSlug: 'vindasen-akeri',
  personas: [
    {
      email: 'lars.ekholm@vindasen.example',
      name: 'Lars Ekholm',
      role: WorkspaceRole.ADMIN, // VD
      avatar: '/demo-team/johan.png',
    },
    {
      email: 'karin.aberg@vindasen.example',
      name: 'Karin Åberg',
      role: WorkspaceRole.MEMBER, // KMA/kvalitet
      avatar: '/demo-team/sofia.png',
    },
    {
      email: 'mikael.lund@vindasen.example',
      name: 'Mikael Lund',
      role: WorkspaceRole.MEMBER, // trafikansvarig
      avatar: '/demo-team/erik.png',
    },
    {
      email: 'eva.strand@vindasen.example',
      name: 'Eva Strand',
      role: WorkspaceRole.HR_MANAGER,
      avatar: '/demo-team/maria.png',
    },
  ],
  // Modal target: kör- och vilotider (SFS 2004:865) — THE transport anxiety
  expandGroup: 'Yrkestrafik & förare',
  kravTexts: [
    'Förarkortsdata kopieras minst var 28:e dag.',
    'Fordonsenhetens färdskrivardata kopieras minst var 90:e dag.',
    'Kör- och vilotidsdata arkiveras i minst 12 månader.',
    'Rutin för avvikelsehantering inför Transportstyrelsens företagskontroll finns och följs.',
    'Förarna utbildas i rast- och dygnsviloregler vid introduktion och årligen.',
  ],
  groups: [
    {
      name: 'Yrkestrafik & förare',
      items: [
        {
          documentNumber: 'SFS 2012:210',
          status: U,
          commentary:
            'Trafiktillståndet och kravet på gott anseende — trafikansvarig är utsedd och registrerad.',
        },
        {
          documentNumber: 'SFS 2004:865',
          status: P,
          commentary:
            'Fjärr- och distributionstrafik med 14 fordon över 3,5 ton — kör- och vilotider och smart färdskrivare gäller samtliga.',
        },
        {
          documentNumber: 'SFS 2007:1157',
          status: U,
          commentary:
            'YKB-fortbildning 35 timmar per femårsperiod — förfallodatum bevakas per förare.',
        },
        {
          documentNumber: 'SFS 2002:574',
          status: U,
          commentary:
            'Fordonens beskaffenhet och kontrollbesiktningar för hela vagnparken.',
        },
      ],
    },
    {
      name: 'Farligt gods',
      items: [
        {
          documentNumber: 'SFS 2006:263',
          status: P,
          commentary:
            'ADR-transporter av styckegods — säkerhetsrådgivare anlitad, skyddsplan under uppdatering.',
        },
        {
          documentNumber: 'SFS 2006:311',
          status: U,
          commentary:
            'Förordningens krav på utbildning och dokumentation vid farligt gods-uppdrag.',
        },
        {
          documentNumber: 'MSBFS 2024:10',
          status: N,
          commentary:
            'Nya ADR-S — genomgång av ändringarna mot vår godsmix är inte påbörjad.',
        },
      ],
    },
    {
      name: 'Arbetsmiljö & arbetstid',
      items: [
        {
          documentNumber: 'SFS 1977:1160',
          status: U,
          commentary:
            'Arbetsmiljöansvaret för förare, terminal- och verkstadspersonal.',
        },
        {
          documentNumber: 'AFS 2023:1',
          status: P,
          commentary:
            'SAM med riskbedömningar för lastning, backning på terminal och ensamarbete.',
        },
        {
          documentNumber: 'AFS 2023:11',
          status: X,
          commentary:
            'Besiktningsintervall för bakgavellyftar är inte dokumenterade — åtgärd pågår.',
        },
        {
          documentNumber: 'SFS 2005:395',
          status: U,
          commentary:
            'Vägarbetstidslagen för mobila arbetstagare — max 48 h/vecka i snitt, aldrig över 60 h.',
        },
      ],
    },
    {
      name: 'Miljö & trafik',
      items: [
        {
          documentNumber: 'SFS 1998:808',
          status: P,
          commentary:
            'Drivmedelshantering, tvätthall och kemikalier på terminalen — egenkontroll.',
        },
        { documentNumber: 'SFS 1998:1276', status: U },
        { documentNumber: 'SFS 1974:610', status: U },
        { documentNumber: 'SFS 1982:673', status: U },
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
