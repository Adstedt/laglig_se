/* eslint-disable no-console */
/**
 * Stages the VÅRD & OMSORG demo workspace for marketing screenshots
 * (Story 26.5). Fictitious company — allabolag-collision-checked 2026-06-11
 * ("Vitnäset" returned no matches; clean).
 *
 * NOTE: NO SOSFS/HSLF-FS rows — those series are not in the catalog
 * (prose-only on the marketing page per Alexander 2026-06-11; ingestion is a
 * registered backlog follow-up).
 *
 * Run: pnpm tsx scripts/seed-demo-workspace-vard.ts
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
  workspaceName: 'Vitnäset Vård & Omsorg AB',
  workspaceSlug: 'vitnaset-vard',
  personas: [
    {
      email: 'lars.ekholm@vitnaset.example',
      name: 'Lars Ekholm',
      role: WorkspaceRole.ADMIN, // verksamhetschef
      avatar: '/demo-team/johan.png',
    },
    {
      email: 'karin.aberg@vitnaset.example',
      name: 'Karin Åberg',
      role: WorkspaceRole.MEMBER, // kvalitetsansvarig
      avatar: '/demo-team/sofia.png',
    },
    {
      email: 'mikael.lund@vitnaset.example',
      name: 'Mikael Lund',
      role: WorkspaceRole.MEMBER, // enhetschef hemtjänst
      avatar: '/demo-team/erik.png',
    },
    {
      email: 'eva.strand@vitnaset.example',
      name: 'Eva Strand',
      role: WorkspaceRole.HR_MANAGER, // MAS/kvalitet
      avatar: '/demo-team/maria.png',
    },
  ],
  // Modal target: Patientsäkerhetslagen (SFS 2010:659) — IVO-tillsyn story
  expandGroup: 'Vård & patientsäkerhet',
  kravTexts: [
    'Patientsäkerhetsberättelse är upprättad senast den 1 mars.',
    'Rutin för avvikelsehantering och lex Maria-anmälan är dokumenterad och känd.',
    'Verksamheten är anmäld till IVO:s vårdgivarregister.',
    'Egenkontroll enligt ledningssystemet är genomförd för kvartalet.',
    'Delegeringar av hälso- och sjukvårdsuppgifter följs upp årligen.',
  ],
  groups: [
    {
      name: 'Vård & patientsäkerhet',
      items: [
        {
          documentNumber: 'SFS 2010:659',
          status: P,
          commentary:
            'Vårdgivaransvaret: patientsäkerhetsberättelse, avvikelsehantering och lex Maria för boendet och hemtjänsten.',
        },
        {
          documentNumber: 'SFS 2017:30',
          status: U,
          commentary:
            'Hälso- och sjukvårdsansvar upp till sjuksköterskenivå — verksamhetschef enligt HSL är utsedd.',
        },
        {
          documentNumber: 'SFS 2014:821',
          status: U,
          commentary:
            'Information, samtycke och delaktighet för de boende i vårdmomenten.',
        },
        {
          documentNumber: 'SFS 2004:168',
          status: U,
          commentary:
            'Smittskyddsrutiner vid utbrott — hygienrutinerna är första försvarslinjen.',
        },
      ],
    },
    {
      name: 'Dokumentation & dataskydd',
      items: [
        {
          documentNumber: 'SFS 2008:355',
          status: P,
          commentary:
            'Journalföring, behörighetsstyrning och loggkontroller i journalsystemet.',
        },
        {
          documentNumber: 'SFS 2022:913',
          status: N,
          commentary:
            'Sammanhållen vård- och omsorgsdokumentation — anslutning utreds.',
        },
        {
          documentNumber: 'SFS 2018:218',
          status: P,
          commentary:
            'GDPR-grunden för all personuppgiftsbehandling utöver journalerna.',
        },
      ],
    },
    {
      name: 'Arbetsmiljö',
      items: [
        {
          documentNumber: 'SFS 1977:1160',
          status: U,
          commentary:
            'Arbetsmiljöansvaret för vård- och omsorgspersonalen i boende och hemtjänst.',
        },
        {
          documentNumber: 'AFS 2023:1',
          status: P,
          commentary:
            'SAM med riskbedömningar för förflyttningar, ensamarbete och hot/våld.',
        },
        {
          documentNumber: 'AFS 2023:10',
          status: X,
          commentary:
            'Smittrisker och hot/våld i arbetsmiljön — åtgärdsplan efter senaste riskbedömningen pågår inte enligt plan.',
        },
      ],
    },
    {
      name: 'Socialtjänst & LSS',
      items: [
        {
          documentNumber: 'SFS 2025:400',
          status: P,
          commentary:
            'Nya socialtjänstlagen från 1 juli 2025 — rutiner och styrdokument uppdateras mot den nya lagen.',
        },
        {
          documentNumber: 'SFS 1993:387',
          status: U,
          commentary:
            'LSS-insatserna i daglig verksamhet — kvalitetskrav och dokumentation.',
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
