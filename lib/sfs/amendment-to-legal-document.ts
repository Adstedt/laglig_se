/**
 * Amendment to LegalDocument Conversion
 *
 * Story 2.29: Creates LegalDocument entries from AmendmentDocument records
 * so amendments can have their own browsable, searchable pages.
 */

import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import { generateAmendmentSlug, generateAmendmentTitle } from './amendment-slug'

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface AmendmentData {
  id: string
  sfs_number: string
  title: string | null
  base_law_sfs: string
  base_law_name: string | null
  effective_date: Date | null
  publication_date: Date | null
  original_url: string | null
  storage_path: string
  full_text: string | null
  html_content?: string | null
  markdown_content: string | null
  json_content?: unknown | null
  confidence: number | null
}

/**
 * Create or update a LegalDocument entry from an AmendmentDocument
 *
 * This allows amendments to be browsable and searchable alongside base laws.
 */
export async function createLegalDocumentFromAmendment(
  tx: PrismaTransaction,
  amendment: AmendmentData
): Promise<{ id: string; slug: string; isNew: boolean }> {
  // Normalize sfs_number — strip any existing "SFS " prefix to avoid "SFS SFS ..."
  const sfsNum = amendment.sfs_number.replace(/^SFS\s*/i, '')
  const documentNumber = `SFS ${sfsNum}`

  // Check if LegalDocument already exists
  const existing = await tx.legalDocument.findUnique({
    where: { document_number: documentNumber },
    select: { id: true, slug: true },
  })

  // Generate title if not present
  const title =
    amendment.title ??
    generateAmendmentTitle(
      amendment.sfs_number,
      amendment.base_law_sfs,
      amendment.base_law_name
    )

  // Generate slug
  const slug = generateAmendmentSlug(
    amendment.sfs_number,
    title,
    amendment.base_law_name
  )

  // Find base law for linking
  const baseLawDocNumber = `SFS ${amendment.base_law_sfs}`
  const baseLaw = await tx.legalDocument.findUnique({
    where: { document_number: baseLawDocNumber },
    select: { id: true, slug: true },
  })

  // Build metadata
  const metadata = {
    amendment_document_id: amendment.id,
    base_law_sfs: amendment.base_law_sfs,
    base_law_slug: baseLaw?.slug ?? null,
    base_law_name: amendment.base_law_name,
    storage_path: amendment.storage_path,
    has_markdown: Boolean(amendment.markdown_content),
    confidence: amendment.confidence,
  }

  // Build source URL
  const sourceUrl =
    amendment.original_url ??
    `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_sfs-${amendment.sfs_number.replace(':', '-')}/`

  const data = {
    content_type: ContentType.SFS_AMENDMENT,
    document_number: documentNumber,
    title,
    slug,
    full_text: amendment.full_text ?? amendment.markdown_content ?? null,
    html_content: amendment.html_content ?? null,
    markdown_content: amendment.markdown_content ?? null,
    json_content: (amendment.json_content as object) ?? undefined,
    effective_date: amendment.effective_date,
    publication_date: amendment.publication_date,
    status: DocumentStatus.ACTIVE,
    source_url: sourceUrl,
    metadata,
  }

  if (existing) {
    // Update existing LegalDocument
    await tx.legalDocument.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        slug: data.slug,
        full_text: data.full_text,
        html_content: data.html_content,
        markdown_content: data.markdown_content,
        json_content: data.json_content,
        effective_date: data.effective_date,
        publication_date: data.publication_date,
        source_url: data.source_url,
        metadata: data.metadata,
      },
    })
    return { id: existing.id, slug: data.slug, isNew: false }
  } else {
    // Check for slug collision before creating (can't catch unique constraint inside tx)
    const slugExists = await tx.legalDocument.findFirst({
      where: { slug: data.slug },
      select: { id: true },
    })

    if (slugExists) {
      // Append normalized SFS number for uniqueness
      const normalizedSfs = amendment.sfs_number
        .replace(/^SFS\s*/i, '')
        .replace(':', '-')
      data.slug = `${data.slug}-${normalizedSfs}`
    }

    const created = await tx.legalDocument.create({
      data,
      select: { id: true, slug: true },
    })
    return { id: created.id, slug: created.slug, isNew: true }
  }
}
