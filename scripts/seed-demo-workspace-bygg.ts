/* eslint-disable no-console */
/**
 * Stages the BYGG demo workspace for marketing screenshots (Story 26.4).
 * Fictitious company — allabolag-collision-checked 2026-06-10 ("Stenbacka"
 * rejected: real Stenbacka Bygg & Konsult AB exists; "Gråviken" is clean.
 *
 * Run: pnpm tsx scripts/seed-demo-workspace-bygg.ts
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
  workspaceName: 'Gråviken Bygg & Anläggning AB',
  workspaceSlug: 'gravviken-bygg',
  personas: [
    {
      email: 'lars.ekholm@gravviken.example',
      name: 'Lars Ekholm',
      role: WorkspaceRole.ADMIN, // platschef
      avatar: '/demo-team/johan.png',
    },
    {
      email: 'karin.aberg@gravviken.example',
      name: 'Karin Åberg',
      role: WorkspaceRole.MEMBER, // KMA-ansvarig
      avatar: '/demo-team/sofia.png',
    },
    {
      email: 'mikael.lund@gravviken.example',
      name: 'Mikael Lund',
      role: WorkspaceRole.MEMBER, // arbetsledare
      avatar: '/demo-team/erik.png',
    },
    {
      email: 'eva.strand@gravviken.example',
      name: 'Eva Strand',
      role: WorkspaceRole.HR_MANAGER,
      avatar: '/demo-team/maria.png',
    },
  ],
  expandGroup: 'Arbetsmiljö',
  kravTexts: [
    'BAS-P är utsedd skriftligt innan projekteringen påbörjas.',
    'Arbetsmiljöplan är upprättad och tillgänglig på arbetsplatsen innan etablering.',
    'BAS-U följer upp att skyddsanordningar underhålls under hela utförandet.',
    'Riskbedömning är dokumenterad och gås igenom vid varje nytt arbetsmoment.',
    'Personlig skyddsutrustning kontrolleras och brister åtgärdas enligt rutin.',
  ],
  groups: [
    {
      name: 'Arbetsmiljö',
      items: [
        {
          documentNumber: 'SFS 1977:1160',
          status: U,
          commentary:
            'Grundlagen för allt arbetsmiljöarbete — styr vårt SAM och skyddsorganisationen på varje etablering.',
        },
        {
          documentNumber: 'AFS 2023:1',
          status: U,
          commentary:
            'Kräver systematiskt arbetsmiljöarbete: undersöka, riskbedöma, åtgärda och följa upp — dokumenterat.',
        },
        {
          documentNumber: 'AFS 2023:3',
          status: P,
          commentary:
            'Byggherrens och BAS-P/BAS-U:s ansvar i våra entreprenader — arbetsmiljöplan krävs i de flesta projekt.',
        },
        {
          documentNumber: 'AFS 2023:10',
          status: U,
          commentary:
            'Riskerna i vår produktion: fallhöjder, kvartsdamm, vibrationer — styr våra skyddsåtgärder.',
        },
        {
          documentNumber: 'AFS 2023:11',
          status: P,
          commentary:
            'Krav på besiktning av lyftar och ställningar samt rätt personlig skyddsutrustning.',
        },
        {
          documentNumber: 'AFS 2023:12',
          status: X,
          commentary:
            'Utformning av fasta och tillfälliga arbetsplatser — bodar, belysning, personalutrymmen.',
        },
        {
          documentNumber: 'SFS 1982:673',
          status: U,
          commentary:
            'Arbetstid, övertid och raster för yrkesarbetarna — påverkar skiftplanering i produktionen.',
        },
      ],
    },
    {
      name: 'Bygg & Fastighet',
      items: [
        { documentNumber: 'SFS 2010:900', status: U },
        { documentNumber: 'SFS 2021:787', status: P },
        { documentNumber: 'SFS 2006:985', status: U },
        { documentNumber: 'SFS 2016:732', status: U },
        { documentNumber: 'SFS 2011:1244', status: P },
      ],
    },
    {
      name: 'Miljö',
      items: [
        { documentNumber: 'SFS 1998:808', status: P },
        { documentNumber: 'SFS 2020:614', status: X },
        { documentNumber: 'SFS 2014:425', status: N },
      ],
    },
    {
      name: 'Arbetsrätt',
      items: [
        { documentNumber: 'SFS 1982:80', status: U },
        { documentNumber: 'SFS 1977:480', status: U },
        { documentNumber: 'SFS 1976:580', status: U },
        { documentNumber: 'SFS 2008:567', status: P },
      ],
    },
    {
      name: 'Ekonomi & Dataskydd',
      items: [
        { documentNumber: 'SFS 1999:1078', status: U },
        { documentNumber: 'SFS 2018:218', status: P },
        { documentNumber: 'SFS 2021:890', status: N },
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
