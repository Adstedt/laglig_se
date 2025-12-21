/**
 * Story 5.2: Workspace Context API Endpoint
 * Returns the current user's workspace context for client-side use.
 */

import { NextResponse } from 'next/server'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'

export async function GET() {
  try {
    const context = await getWorkspaceContext()

    return NextResponse.json({
      workspaceId: context.workspaceId,
      workspaceName: context.workspaceName,
      workspaceSlug: context.workspaceSlug,
      workspaceStatus: context.workspaceStatus,
      role: context.role,
    })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      const statusCode =
        error.code === 'UNAUTHORIZED'
          ? 401
          : error.code === 'NO_WORKSPACE'
            ? 403
            : 403

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          message:
            error.code === 'NO_WORKSPACE'
              ? 'Du har ingen aktiv workspace'
              : error.code === 'WORKSPACE_DELETED'
                ? 'Denna workspace har tagits bort'
                : 'Åtkomst nekad',
        },
        { status: statusCode }
      )
    }

    // Unexpected error - log and return 500
    console.error('Workspace context error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Ett oväntat fel uppstod' },
      { status: 500 }
    )
  }
}
