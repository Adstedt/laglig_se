/* eslint-disable no-console */
/**
 * Stages the FASTIGHET demo workspace for marketing screenshots (Story 26.5).
 * Fictitious company — allabolag-collision-checked 2026-06-11 ("Stillviken"
 * returned no matches; clean).
 *
 * Run: pnpm tsx scripts/seed-demo-workspace-fastighet.ts
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
  workspaceName: 'Stillviken Fastighetsförvaltning AB',
  workspaceSlug: 'stillviken-fastighet',
  personas: [
    {
      email: 'lars.ekholm@stillviken.example',
      name: 'Lars Ekholm',
      role: WorkspaceRole.ADMIN, // förvaltningschef
      avatar: '/demo-team/johan.png',
    },
    {
      email: 'karin.aberg@stillviken.example',
      name: 'Karin Åberg',
      role: WorkspaceRole.MEMBER, // hållbarhets-/KMA-ansvarig
      avatar: '/demo-team/sofia.png',
    },
    {
      email: 'mikael.lund@stillviken.example',
      name: 'Mikael Lund',
      role: WorkspaceRole.MEMBER, // fastighetstekniker, brandskydd
      avatar: '/demo-team/erik.png',
    },
    {
      email: 'eva.strand@stillviken.example',
      name: 'Eva Strand',
      role: WorkspaceRole.HR_MANAGER,
      avatar: '/demo-team/maria.png',
    },
  ],
  // Modal target: LSO (SFS 2003:778) — "från paragraf till rondprotokoll"
  expandGroup: 'Säkerhet & arbetsmiljö',
  kravTexts: [
    'SBA-dokumentation är upprättad och aktuell för samtliga fastigheter.',
    'Brandskyddsrond i trapphus och allmänna utrymmen genomförs varje kvartal.',
    'Utrymningsvägar hålls fria — förvaring i trapphus kontrolleras vid rond.',
    'Rökluckor och branddörrar är funktionskontrollerade enligt schema.',
    'Gränsdragningen mot hyresgästernas brandskyddsansvar är dokumenterad.',
  ],
  groups: [
    {
      name: 'Fastighet & byggnad',
      items: [
        {
          documentNumber: 'SFS 1970:994',
          status: U,
          commentary:
            'Hyresförhållandena i 12 kap. — underhållsansvar, inomhusmiljö och hyresgästernas rättigheter i hela beståndet.',
        },
        {
          documentNumber: 'SFS 2010:900',
          status: U,
          commentary:
            'Bygglov, underhållskrav och OVK-grunderna för våra 16 byggnader.',
        },
        {
          documentNumber: 'SFS 2011:338',
          status: P,
          commentary:
            'OVK-intervall och hisskontroller per byggnad — varje besiktning är en återkommande kravpunkt.',
        },
        {
          documentNumber: 'SFS 2006:985',
          status: P,
          commentary:
            'Giltig energideklaration krävs för byggnader som upplåts — två förnyas under hösten.',
        },
        {
          documentNumber: 'SFS 2022:333',
          status: P,
          commentary:
            'Individuell mätning och debitering av värme och varmvatten där det krävs.',
        },
      ],
    },
    {
      name: 'Miljö & hälsoskydd',
      items: [
        {
          documentNumber: 'SFS 1998:808',
          status: P,
          commentary:
            'Egenkontroll enligt 26 kap. 19 § — rutiner mot olägenhet för människors hälsa i bostäderna.',
        },
        {
          documentNumber: 'SFS 1998:899',
          status: U,
          commentary:
            'Preciserar egenkontrollen för fastighetsdrift — underlag vid miljöförvaltningens tillsyn.',
        },
        {
          documentNumber: 'SFS 2018:396',
          status: P,
          commentary:
            'Radonmätning i beståndet pågår — mätvärden över referensnivån ska åtgärdas.',
        },
        {
          documentNumber: 'SFS 2007:19',
          status: X,
          commentary:
            'PCB-inventering saknas för fastigheten byggd 1968 — åtgärd krävs.',
        },
        {
          documentNumber: 'SFS 2022:1274',
          status: N,
          commentary:
            'Fastighetsnära insamling av förpackningar — krav från 1 jan 2027, planering ej påbörjad.',
        },
      ],
    },
    {
      name: 'Säkerhet & arbetsmiljö',
      items: [
        {
          documentNumber: 'SFS 2003:778',
          status: U,
          commentary:
            'Ägarens ansvar för byggnadens brandskydd enligt 2 kap. 2 § — dokumenterat SBA för hela beståndet.',
        },
        {
          documentNumber: 'SFS 2016:732',
          status: U,
          commentary:
            'Innehavarens fortlöpande kontroll av elanläggningarna — kan inte avtalas bort.',
        },
        {
          documentNumber: 'SFS 1977:1160',
          status: U,
          commentary:
            'Arbetsmiljöansvaret för våra tekniker och fastighetsskötare.',
        },
        {
          documentNumber: 'AFS 2023:1',
          status: P,
          commentary:
            'SAM för drift- och underhållsarbetet — riskbedömningar vid ensamarbete och takarbete.',
        },
        {
          documentNumber: 'AFS 2023:3',
          status: P,
          commentary:
            'Byggherreansvaret när vi beställer entreprenader i beståndet — BAS-P/BAS-U utses per projekt.',
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
