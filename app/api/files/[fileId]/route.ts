/**
 * API Route: File Content Proxy
 * Proxies file content from Supabase storage to avoid CORS issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStorageClient } from '@/lib/supabase/storage'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'

const BUCKET_NAME = 'workspace-files'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Get workspace context (handles auth)
    const { workspaceId } = await getWorkspaceContext()
    const { fileId } = await params

    // Verify file belongs to user's workspace
    const file = await prisma.workspaceFile.findFirst({
      where: {
        id: fileId,
        workspace_id: workspaceId,
      },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (!file.storage_path) {
      return NextResponse.json(
        { error: 'File has no content' },
        { status: 400 }
      )
    }

    // Download file from Supabase
    const storageClient = getStorageClient()
    const { data, error } = await storageClient.storage
      .from(BUCKET_NAME)
      .download(file.storage_path)

    if (error || !data) {
      console.error('Storage download error:', error)
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      )
    }

    // Return file with appropriate headers
    const arrayBuffer = await data.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Length': String(arrayBuffer.byteLength),
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename)}"`,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'UNAUTHORIZED' ? 401 : 403 }
      )
    }
    console.error('File proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
