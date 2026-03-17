#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Backfill the 6 old "bih." SFS docs that have no HTML in the API.
 * Insert them as metadata-only entries with contentAvailability flag.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import {
  PrismaClient,
  ContentType,
  DocumentStatus,
  ChangeType,
} from '@prisma/client'
import { generateSlug } from '../lib/external/riksdagen'
import { classifyLawType, classificationToMetadata } from '../lib/sfs'

const prisma = new PrismaClient()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const BIH_DOCS = [
  'SFS 1878:bih. 56 s. 1',
  'SFS 1883:bih. 39 s. 1',
  'SFS 1895:bih. 10 s. 1',
  'SFS 1895:bih. 52 s. 1',
  'SFS 1899:bih. 40 s. 3',
  'SFS 1901:bih. 56 s. 1',
]

async function lookupDoc(sfsNumber: string) {
  const bet = sfsNumber.replace('SFS ', '')
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=5&sok=${encodeURIComponent(bet)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Laglig.se/1.0' },
  })
  if (!res.ok) return null
  const data = await res.json()
  const docs = data.dokumentlista?.dokument || []
  return docs.find((d: any) => d.beteckning === bet) || null
}

async function main() {
  const DRY_RUN = !process.argv.includes('--apply')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLYING'}`)

  for (const sfsNumber of BIH_DOCS) {
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: sfsNumber },
      select: { id: true },
    })
    if (existing) {
      console.log(`${sfsNumber} — already exists`)
      continue
    }

    await sleep(300)
    const info = await lookupDoc(sfsNumber)
    if (!info) {
      console.log(`${sfsNumber} — NOT FOUND in API`)
      continue
    }

    console.log(`${sfsNumber} — "${info.titel?.substring(0, 60)}"`)

    if (DRY_RUN) continue

    const classification = classifyLawType(info.titel || sfsNumber)
    const classificationMeta = classificationToMetadata(classification)
    const slug = generateSlug(info.titel || sfsNumber, sfsNumber)
    const bet = sfsNumber.replace('SFS ', '')

    await prisma.$transaction(async (tx) => {
      const newDoc = await tx.legalDocument.create({
        data: {
          document_number: sfsNumber,
          title: info.titel,
          slug,
          content_type: ContentType.SFS_LAW,
          full_text: null,
          html_content: null,
          publication_date: info.datum ? new Date(info.datum) : null,
          status: DocumentStatus.ACTIVE,
          source_url: `https://data.riksdagen.se/dokument/${info.dok_id}`,
          metadata: {
            dokId: info.dok_id,
            source: 'data.riksdagen.se',
            publicerad: info.publicerad || '',
            systemdatum: info.systemdatum || '',
            fetchedAt: new Date().toISOString(),
            method: 'backfill-metadata-only',
            contentAvailability: 'metadata_only',
            externalUrl: `http://rkrattsbaser.gov.se/sfst?bet=${encodeURIComponent(bet)}`,
            ...classificationMeta,
          },
        },
      })

      await tx.documentVersion.create({
        data: {
          document_id: newDoc.id,
          version_number: 1,
          full_text: '',
          html_content: null,
          source_systemdatum: new Date(),
        },
      })

      await tx.changeEvent.create({
        data: {
          document_id: newDoc.id,
          content_type: ContentType.SFS_LAW,
          change_type: ChangeType.NEW_LAW,
        },
      })
    })

    console.log(`  → INSERTED (metadata_only)`)
  }

  const count = await prisma.legalDocument.count({
    where: { content_type: ContentType.SFS_LAW },
  })
  console.log(`\nDB SFS_LAW count: ${count}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
