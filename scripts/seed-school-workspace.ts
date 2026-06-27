/* eslint-disable no-console */
/**
 * Seed a FAKE school workspace to test whether the compliance agent adapts its
 * scope to the workspace's business context (vs. the Ekens Golv flooring demo,
 * where it refuses SKOLFS questions as out-of-scope). [Story 9.7 — test aid]
 *
 * Idempotent: re-running updates the same workspace (keyed on slug).
 * Deletable: `pnpm tsx scripts/seed-school-workspace.ts --delete`
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { prisma } from '../lib/prisma'
/* eslint-enable import/first */

const SLUG = 'nordvik-utbildning-skoltest'
const OWNER_EMAIL = 'alexander.adstedt'

// 500+ word, detailed business context — the field the agent reads via
// get_company_context to scope itself as this huvudman's compliance partner.
const BUSINESS_DESCRIPTION = `Nordvik Utbildning AB är en fristående skolhuvudman (friskola) som bedriver godkänd skolverksamhet enligt skollagen (2010:800) med tillstånd från Skolinspektionen. Bolaget driver en sammanhållen skolenhet, Nordviks skola, i Sundbybergs kommun och omfattar förskoleklass, grundskola årskurs 1–9 samt ett fritidshem. Verksamheten har cirka 540 elever och 78 anställda, varav 52 är legitimerade lärare, 9 är fritidspedagoger/barnskötare, 6 utgör elevhälsoteamet (skolsköterska, kurator, skolpsykolog, specialpedagoger och studie- och yrkesvägledare) och resterande är skolledning, administration, vaktmästeri och måltidspersonal. Skolan är huvudman i skollagens mening och ansvarar därmed fullt ut för att utbildningen genomförs i enlighet med nationella styrdokument.

Undervisningen följer läroplanen för grundskolan, förskoleklassen och fritidshemmet (den nu gällande läroplanen, konsoliderad genom SKOLFS 2010:37 med efterföljande ändringar inklusive 2022 års reform), tillhörande kursplaner, kunskapskrav/betygskriterier samt timplaner. Skolan tillämpar Skolverkets föreskrifter om bedömning och betygssättning, genomför nationella prov i enlighet med gällande föreskrifter, och arbetar systematiskt med betygssättningens likvärdighet. Rektor ansvarar för det pedagogiska ledarskapet, för att lärarna får förutsättningar att fullgöra sitt uppdrag och för skolans resultat i förhållande till de nationella målen.

Ett centralt regelområde för verksamheten är det systematiska kvalitetsarbetet enligt 4 kap. skollagen: skolan kartlägger, analyserar och dokumenterar måluppfyllelse på huvudmanna- och enhetsnivå, sätter mål och vidtar åtgärder. Skolan bedriver ett aktivt arbete mot diskriminering och kränkande behandling enligt 6 kap. skollagen och diskrimineringslagen, med en årlig plan mot kränkande behandling och rutiner för anmälan, utredning och åtgärder. Elevhälsans arbete är förebyggande och hälsofrämjande och omfattar medicinska, psykologiska, psykosociala och specialpedagogiska insatser. Skolan utreder och beslutar om extra anpassningar och särskilt stöd (åtgärdsprogram) samt mottagande och urval.

Skolan hanterar omfattande personuppgifter om barn enligt dataskyddsförordningen (GDPR) och skollagens sekretess- och dokumentationsregler — elevregister, betygsdokumentation, åtgärdsprogram, elevhälsojournaler och vårdnadshavaruppgifter — och har personuppgiftsbiträdesavtal med sina digitala läromedels- och lärplattformsleverantörer. Som arbetsgivare omfattas bolaget av arbetsmiljölagen och Arbetsmiljöverkets föreskrifter (bland annat systematiskt arbetsmiljöarbete och organisatorisk och social arbetsmiljö), och tillämpar kollektivavtal genom Friskoleavtalet (Almega Tjänsteföretagen). Skolan registerkontrollerar all personal enligt lagen om registerkontroll av personer som ska arbeta med barn. Måltidsverksamheten lyder under livsmedelslagstiftningen och kommunens livsmedelstillsyn, och lokalerna omfattas av regler om brandskydd, tillgänglighet och elevernas fysiska arbetsmiljö.

Mottagande och antagning sker enligt skollagens regler om öppenhet och urval: skolan tillämpar kötid och syskonförtur, för väntelista och fattar mottagandebeslut utan otillåten åtskillnad. Skolan har en dokumenterad rutin för klagomålshantering mot utbildningen enligt 4 kap. 8 § skollagen och tar emot, utreder och återkopplar klagomål från elever och vårdnadshavare. Bolaget styrs av en styrelse och en verkställande direktör; det pedagogiska och arbetsmiljörättsliga ansvaret är delegerat till rektor genom en skriftlig delegationsordning, och huvudmannen följer löpande upp att delegerat ansvar fullgörs.

Fritidshemmet och förskoleklassen bedriver undervisning enligt läroplanens del om respektive skolform och kompletterar elevernas utveckling och lärande utanför den lärarledda undervisningstiden. Skolan arbetar aktivt med digitalisering och elevernas digitala kompetens i enlighet med läroplanens skrivningar, tillhandahåller en till en-datorer i de högre årskurserna och har styrande rutiner för informationssäkerhet och ansvarsfull användning av digitala verktyg. Timplanen följs per ämne och stadium, och skolan säkerställer garanterad undervisningstid samt erbjuder modersmålsundervisning och studiehandledning på modersmål till de elever som har rätt till det.

Verksamheten finansieras genom kommunal skolpeng (bidrag på lika villkor) och omfattas av Skolverkets och Skolinspektionens tillsyn samt av reglerna om statsbidrag. Bolagets compliance-fokus rör därför skolförfattningar (skollag, skolförordning, läroplaner, kurs- och ämnesplaner, betygsföreskrifter, nationella prov), elevrätt och likabehandling, dataskydd för barn, arbetsmiljö och arbetsrätt, livsmedels- och lokalsäkerhet samt statsbidrags- och tillsynsregler. Skolan ser sin efterlevnad av Skolverkets föreskrifter och läroplaner som helt verksamhetskritisk.`

async function main() {
  const del = process.argv.includes('--delete')
  const owner = await prisma.user.findFirst({
    where: { email: { contains: OWNER_EMAIL } },
    select: { id: true, email: true },
  })
  if (!owner) throw new Error(`owner user (${OWNER_EMAIL}) not found`)

  const existing = await prisma.workspace.findUnique({ where: { slug: SLUG } })

  if (del) {
    if (existing) {
      await prisma.workspace.delete({ where: { id: existing.id } }) // cascades profile + members
      console.log(`Deleted workspace ${SLUG}`)
    } else console.log('Nothing to delete')
    return
  }

  // Workspace (idempotent on slug)
  const ws = existing
    ? await prisma.workspace.update({
        where: { id: existing.id },
        data: {
          name: 'Nordvik Utbildning AB',
          sni_code: '85.20',
          status: 'ACTIVE',
        },
      })
    : await prisma.workspace.create({
        data: {
          name: 'Nordvik Utbildning AB',
          slug: SLUG,
          owner_id: owner.id,
          org_number: '559900-0042',
          company_legal_name: 'Nordvik Utbildning AB',
          sni_code: '85.20',
          subscription_tier: 'TEAM',
          status: 'ACTIVE',
          trial_ends_at: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      })

  // Owner membership
  await prisma.workspaceMember.upsert({
    where: { user_id_workspace_id: { user_id: owner.id, workspace_id: ws.id } },
    update: { role: 'OWNER' },
    create: { user_id: owner.id, workspace_id: ws.id, role: 'OWNER' },
  })

  // Company profile — the business context the agent scopes itself to
  await prisma.companyProfile.upsert({
    where: { workspace_id: ws.id },
    update: {
      company_name: 'Nordvik Utbildning AB',
      business_description: BUSINESS_DESCRIPTION,
      industry_label: 'Grundskoleutbildning (friskola)',
      sni_code: '85.20',
      legal_form: 'AB',
      employee_count: 78,
      municipality: 'Sundbyberg',
      website_url: 'https://nordviksskola.example.se',
      founded_year: 2009,
      has_collective_agreement: true,
      collective_agreement_name: 'Friskoleavtalet (Almega Tjänsteföretagen)',
      activity_flags: {
        personalData: true,
        minorEmployees: true,
        food: true,
        publicSector: false,
        construction: false,
        chemicals: false,
        heavyMachinery: false,
        internationalOperations: false,
      },
      profile_completeness: 100,
      data_source: 'manual',
      org_number: '559900-0042',
    },
    create: {
      workspace_id: ws.id,
      company_name: 'Nordvik Utbildning AB',
      business_description: BUSINESS_DESCRIPTION,
      industry_label: 'Grundskoleutbildning (friskola)',
      sni_code: '85.20',
      legal_form: 'AB',
      employee_count: 78,
      municipality: 'Sundbyberg',
      website_url: 'https://nordviksskola.example.se',
      founded_year: 2009,
      has_collective_agreement: true,
      collective_agreement_name: 'Friskoleavtalet (Almega Tjänsteföretagen)',
      activity_flags: {
        personalData: true,
        minorEmployees: true,
        food: true,
        publicSector: false,
        construction: false,
        chemicals: false,
        heavyMachinery: false,
        internationalOperations: false,
      },
      profile_completeness: 100,
      data_source: 'manual',
      org_number: '559900-0042',
    },
  })

  const words = BUSINESS_DESCRIPTION.split(/\s+/).length
  console.log(`✓ Seeded workspace "${ws.name}" (slug: ${ws.slug})`)
  console.log(`  owner/member: ${owner.email}`)
  console.log(`  business_description: ${words} words`)
  console.log(
    `  → switch to it in the workspace picker and ask the agent a SKOLFS question`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
