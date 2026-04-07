import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format } from 'date-fns'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { generateDocx } from '@/lib/documents/tiptap-to-docx'
import { generatePdf } from '@/lib/documents/tiptap-to-pdf'
import { sanitizeFilename } from '@/lib/utils/sanitize-filename'

export const maxDuration = 30

const exportParamsSchema = z.object({
  format: z.enum(['docx', 'pdf']),
  versionNumber: z.coerce.number().int().positive().optional(),
})

const CONTENT_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceContext()
    const { documentId } = await params

    // Validate query params
    const { searchParams } = request.nextUrl
    const parsed = exportParamsSchema.safeParse({
      format: searchParams.get('format'),
      versionNumber: searchParams.get('versionNumber') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ogiltiga parametrar. format krävs (docx eller pdf).' },
        { status: 400 }
      )
    }

    const { format: exportFormat, versionNumber } = parsed.data

    // Fetch document with workspace relation
    const document = await prisma.workspaceDocument.findFirst({
      where: { id: documentId, workspace_id: workspaceId },
      select: {
        id: true,
        title: true,
        document_number: true,
        status: true,
        current_version_number: true,
        current_version_id: true,
        approved_at: true,
        workspace: {
          select: { name: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Dokument hittades inte' },
        { status: 404 }
      )
    }

    // Fetch specific or current version
    const versionWhere: Record<string, unknown> = {
      document_id: documentId,
    }
    if (versionNumber) {
      versionWhere.version_number = versionNumber
    } else if (document.current_version_id) {
      versionWhere.id = document.current_version_id
    }

    const version = await prisma.workspaceDocumentVersion.findFirst({
      where: versionWhere,
      select: {
        version_number: true,
        content_json: true,
        content_html: true,
      },
    })

    if (!version) {
      return NextResponse.json(
        { error: 'Version hittades inte' },
        { status: 404 }
      )
    }

    const metadata = {
      title: document.title,
      documentNumber: document.document_number ?? undefined,
      version: version.version_number,
      status: document.status,
      approvedAt: document.approved_at,
      workspaceName: document.workspace.name,
    }

    // Generate export
    let buffer: Buffer
    if (exportFormat === 'docx') {
      buffer = await generateDocx(
        version.content_json as { type: 'doc'; content: [] },
        metadata
      )
    } else {
      buffer = await generatePdf(version.content_html, metadata)
    }

    // Build filename
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const filename = `${sanitizeFilename(document.title)}-v${version.version_number}-${dateStr}.${exportFormat}`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': CONTENT_TYPES[exportFormat],
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      const statusCode = error.code === 'UNAUTHORIZED' ? 401 : 403
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      )
    }

    console.error('Document export error:', error)
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    )
  }
}
