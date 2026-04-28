/**
 * Story 21.12 — Revisionsrapport PDF download route handler.
 *
 * GET /laglistor/kontroller/[cycleId]/rapport/pdf?kind=sealed|complete
 *
 * Behaviour:
 *   - Lazy-generates the PDF on cache miss (first download of an AVSLUTAD
 *     cycle after content edits, or first-ever SEALED download if the seal
 *     transaction's eager `after()` continuation failed).
 *   - Streams the stored PDF bytes with `Content-Disposition: attachment`.
 *   - AUDITOR role CAN download (read-mostly access) via the activity:view
 *     permission branch — matches the report-read pattern in
 *     `getRevisionsrapportInput`.
 *
 * `maxDuration: 300` — architecture §7.2 specifies 30s for pure stream-
 * through but this handler also performs lazy Puppeteer generation on cache
 * miss; 300s is the Vercel Pro ceiling and leaves comfortable headroom.
 */

import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { getStorageClient } from '@/lib/supabase/storage'
import { sanitizeFilename } from '@/lib/utils/sanitize-filename'
import {
  generateCycleReport,
  shouldRegenerateReport,
} from '@/app/actions/compliance-audit-report'
import { ComplianceCycleStatus } from '@prisma/client'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const REPORT_STORAGE_BUCKET = 'workspace-files'
const KindQuerySchema = z.enum(['complete', 'sealed']).optional()

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    // 1. Auth — getWorkspaceContext throws WorkspaceAccessError if no session
    //    or if the workspace cookie is invalid.
    const ctx = await getWorkspaceContext()
    if (
      !(ctx.hasPermission('activity:view') || ctx.hasPermission('tasks:edit'))
    ) {
      return NextResponse.json({ error: 'Behörighet saknas' }, { status: 403 })
    }

    const { cycleId } = await params

    // 2. Parse + validate kind query param.
    const url = new URL(request.url)
    const kindRaw = url.searchParams.get('kind') ?? undefined
    const parsed = KindQuerySchema.safeParse(kindRaw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ogiltig kind-parameter' },
        { status: 400 }
      )
    }

    // 3. Fetch cycle (workspace-scoped).
    const cycle = await prisma.complianceAuditCycle.findFirst({
      where: { id: cycleId, workspace_id: ctx.workspaceId },
      select: { id: true, status: true, name: true },
    })

    if (!cycle) {
      return NextResponse.json(
        { error: 'Kontrollen hittades inte' },
        { status: 404 }
      )
    }

    // 4. Status gate — report not available pre-complete.
    if (
      cycle.status === ComplianceCycleStatus.PLANERAD ||
      cycle.status === ComplianceCycleStatus.PAGAENDE
    ) {
      return NextResponse.json(
        { error: 'Rapport kan inte genereras innan kontrollen är slutförd' },
        { status: 409 }
      )
    }

    // 5. Story 21.26 — only one report kind exists post-SEAL-collapse.
    //    The legacy 'sealed' query param value is silently coerced to
    //    'complete' so deep-link URLs from before the collapse keep working.
    const kindUpper = 'COMPLETE' as const

    // 6. Staleness check + lazy generation if needed.
    const needsRegen = await shouldRegenerateReport(
      cycleId,
      ctx.workspaceId,
      kindUpper
    )
    if (needsRegen) {
      const genResult = await generateCycleReport({
        cycleId,
        kind: kindUpper,
      })
      if (!genResult.success) {
        return NextResponse.json(
          {
            error: genResult.error ?? 'Kunde inte generera revisionsrapport',
          },
          { status: 500 }
        )
      }
    }

    // 7. Load the (now-fresh) report row for the storage path.
    const report = await prisma.complianceAuditReport.findUnique({
      where: {
        cycle_id_report_kind: { cycle_id: cycleId, report_kind: kindUpper },
      },
      select: { pdf_storage_path: true },
    })

    if (!report?.pdf_storage_path) {
      return NextResponse.json(
        { error: 'Rapporten kunde inte hittas i lagringen' },
        { status: 500 }
      )
    }

    // 8. Download PDF bytes from Supabase Storage.
    const storageClient = getStorageClient()
    const { data: blob, error: downloadError } = await storageClient.storage
      .from(REPORT_STORAGE_BUCKET)
      .download(report.pdf_storage_path)

    if (downloadError || !blob) {
      console.error('PDF storage download error:', downloadError)
      return NextResponse.json(
        { error: 'Rapporten kunde inte laddas från lagringen' },
        { status: 502 }
      )
    }

    const pdfBuffer = Buffer.from(await blob.arrayBuffer())

    // 9. Build download filename. sanitizeFilename preserves Swedish chars,
    //    strips special chars, lowercases. Date stamp is CET-display (user-
    //    facing, not archival).
    const sanitizedName = sanitizeFilename(cycle.name || 'kontrollrapport')
    const dateStamp = format(new Date(), 'yyyy-MM-dd')
    const filename = `kontrollrapport-${sanitizedName}-${dateStamp}.pdf`

    // QA gate FILENAME-001: emit BOTH `filename="..."` (ASCII fallback for
    // legacy clients) and `filename*=UTF-8''...` (RFC 6266 / RFC 5987 form
    // for modern browsers) so Swedish characters render correctly across
    // Chrome, Firefox, Safari, and curl. The ASCII fallback transliterates
    // åäö → aao to keep the legacy header valid 7-bit ASCII.
    const asciiFilename = filename
      .replace(/å/g, 'a')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
    const utf8Filename = encodeURIComponent(filename)

    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: 'Behörighet saknas' }, { status: 403 })
    }
    console.error('[rapport/pdf] unexpected error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
      },
      { status: 500 }
    )
  }
}
