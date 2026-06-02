/**
 * One-off identity fix for the Nordviken test workspace.
 *
 * Background: Nordviken's workspace row was renamed (workspace.name) but the
 * underlying CompanyProfile and identity fields were never updated — they
 * still held real Almåsa Havshotell AB data (BolagsAPI enrichment from
 * 2026-04-13). The chat agent reads CompanyProfile.company_name via
 * formatCompanyContext() (lib/agent/system-prompt.ts:95), so every draft was
 * being signed "Almåsa Havshotell AB". This script syncs the identity-bearing
 * fields with the workspace.name.
 *
 * Cleared: identity fields that were Almåsa-specific (address, website, parent
 * company, business_description, org_number, founded_year, etc.). Kept:
 * generic-hotel attributes that still apply (legal_form=AB, sni_code 55102,
 * activity_flags for food/personalData/minorEmployees, collective agreement).
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/fix-nordviken-identity.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORKSPACE_ID = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1'
const NEW_NAME = 'Nordviken Hotell & Konferens AB'
const NEW_SLUG = 'nordviken-hotell-konferens-ab'
const GENERIC_BUSINESS_DESCRIPTION =
  'Hotell- och konferensanläggning med restaurang, boende och event för företag och privatpersoner.'

async function main() {
  console.log('=== fix-nordviken-identity ===')

  const before = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: {
      name: true,
      slug: true,
      org_number: true,
      company_legal_name: true,
      company_profile: {
        select: {
          company_name: true,
          org_number: true,
          address: true,
          municipality: true,
          business_description: true,
          website_url: true,
          parent_company_name: true,
          parent_company_orgnr: true,
          founded_year: true,
          data_source: true,
          last_enriched_at: true,
        },
      },
    },
  })

  if (!before) throw new Error(`Workspace ${WORKSPACE_ID} not found`)

  console.log('\nBEFORE:')
  console.log(JSON.stringify(before, null, 2))

  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: WORKSPACE_ID },
      data: {
        slug: NEW_SLUG,
        company_legal_name: NEW_NAME,
        org_number: null,
      },
    }),
    prisma.companyProfile.update({
      where: { workspace_id: WORKSPACE_ID },
      data: {
        company_name: NEW_NAME,
        org_number: null,
        address: null,
        municipality: null,
        business_description: GENERIC_BUSINESS_DESCRIPTION,
        website_url: null,
        parent_company_name: null,
        parent_company_orgnr: null,
        founded_year: null,
        registered_date: null,
        data_source: null,
        last_enriched_at: null,
      },
    }),
  ])

  const after = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: {
      name: true,
      slug: true,
      org_number: true,
      company_legal_name: true,
      company_profile: {
        select: {
          company_name: true,
          org_number: true,
          address: true,
          municipality: true,
          business_description: true,
          website_url: true,
          parent_company_name: true,
          parent_company_orgnr: true,
          founded_year: true,
          data_source: true,
          last_enriched_at: true,
          legal_form: true,
          sni_code: true,
          industry_label: true,
          employee_count: true,
          employee_count_range: true,
          activity_flags: true,
          has_collective_agreement: true,
        },
      },
    },
  })

  console.log('\nAFTER:')
  console.log(JSON.stringify(after, null, 2))

  // Sanity check
  if (after?.name !== after?.company_profile?.company_name) {
    throw new Error(
      `Sync failed: workspace.name="${after?.name}" ≠ profile.company_name="${after?.company_profile?.company_name}"`
    )
  }
  console.log(
    '\n✓ workspace.name and CompanyProfile.company_name are now in sync.'
  )
}

main()
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
