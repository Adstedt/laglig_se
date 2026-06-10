/* eslint-disable no-console */
/**
 * Stages the IT demo workspace for marketing screenshots (Story 26.4).
 * Fictitious company — allabolag-collision-checked 2026-06-10 ("Norrsken"
 * rejected: Norrsken AB + Norrsken Foundation exist; "Tärnudden" is clean.
 *
 * Run: pnpm tsx scripts/seed-demo-workspace-it.ts
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
  workspaceName: 'Tärnudden Software AB',
  workspaceSlug: 'tarnudden-software',
  personas: [
    {
      email: 'david.brink@tarnudden.example',
      name: 'David Brink',
      role: WorkspaceRole.ADMIN, // CTO
      avatar: '/demo-team/erik.png',
    },
    {
      email: 'sara.holmgren@tarnudden.example',
      name: 'Sara Holmgren',
      role: WorkspaceRole.MEMBER, // DPO / informationssäkerhet
      avatar: '/demo-team/maria.png',
    },
    {
      email: 'jonas.wik@tarnudden.example',
      name: 'Jonas Wik',
      role: WorkspaceRole.MEMBER, // engineering manager
      avatar: '/demo-team/johan.png',
    },
    {
      email: 'lina.berg@tarnudden.example',
      name: 'Lina Berg',
      role: WorkspaceRole.HR_MANAGER,
      avatar: '/demo-team/sofia.png',
    },
  ],
  expandGroup: 'Dataskydd & Informationssäkerhet',
  kravTexts: [
    'Register över behandlingar är upprättat och hålls aktuellt.',
    'Personuppgiftsbiträdesavtal finns med samtliga underleverantörer.',
    'Incidentrutin med rapportering inom föreskriven tid är dokumenterad och övad.',
    'Riskanalys för informationssäkerhet är genomförd och åtgärdsplan beslutad.',
    'Behörigheter ses över regelbundet enligt fastställd rutin.',
  ],
  groups: [
    {
      name: 'Dataskydd & Informationssäkerhet',
      items: [
        {
          documentNumber: 'SFS 2018:218',
          status: U,
          commentary:
            'Kompletterar GDPR i svensk rätt — grunden för hela vår personuppgiftshantering.',
        },
        {
          documentNumber: 'SFS 2016:561',
          status: U,
          commentary:
            'Svenska tillämpningsregler kring dataskyddsförordningen för vår SaaS-plattform.',
        },
        {
          documentNumber: 'SFS 2025:1506',
          status: X,
          commentary:
            'Nya cybersäkerhetslagen (NIS2) — vi behöver bedöma om vi omfattas som digital tjänsteleverantör.',
        },
        {
          documentNumber: 'SFS 2018:1174',
          status: P,
          commentary:
            'Informationssäkerhet för samhällsviktiga och digitala tjänster — ersätts successivt av cybersäkerhetslagen.',
        },
        {
          documentNumber: 'SFS 2022:482',
          status: P,
          commentary:
            'Reglerar elektronisk kommunikation — cookies och integritet i våra tjänster.',
        },
      ],
    },
    {
      name: 'Avtal & Marknad',
      items: [
        { documentNumber: 'SFS 2005:59', status: U },
        { documentNumber: 'SFS 2002:562', status: U },
        { documentNumber: 'SFS 2008:486', status: P },
      ],
    },
    {
      name: 'Immaterialrätt',
      items: [
        { documentNumber: 'SFS 1960:729', status: U },
        { documentNumber: 'SFS 2018:558', status: P },
      ],
    },
    {
      name: 'Arbetsrätt & Arbetsmiljö',
      items: [
        { documentNumber: 'SFS 1977:1160', status: U },
        { documentNumber: 'AFS 2023:1', status: P },
        { documentNumber: 'SFS 1982:80', status: U },
        { documentNumber: 'SFS 1982:673', status: U },
        { documentNumber: 'SFS 1977:480', status: U },
        { documentNumber: 'SFS 2008:567', status: N },
      ],
    },
    {
      name: 'Ekonomi',
      items: [
        { documentNumber: 'SFS 1999:1078', status: U },
        { documentNumber: 'SFS 2021:890', status: X },
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
