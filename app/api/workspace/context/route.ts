/**
 * Story 5.2: Workspace Context API Endpoint
 * Returns the current user's workspace context for client-side use.
 *
 * Story 5.13: uses the bypass-gates version of workspace context. The
 * client-side `useWorkspace` hook calls this on every mount to populate
 * role + workspaceId for permission checks (e.g. "should the Fakturering
 * tab render?"). When the workspace is gated by TRIAL_EXPIRED or
 * PAYMENT_PAST_DUE, the gated version would call redirect() → browser
 * fetch follows the 307 → HTML response → JSON parse fails → role defaults
 * to MEMBER → user can't reach the conversion surface even though they ARE
 * the owner. Bypassing the gate here lets the client see the real role and
 * render the billing tab so the user can convert.
 */

import { NextResponse } from 'next/server'
import {
  getWorkspaceContextBypassBillingGates,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'

export async function GET() {
  try {
    const context = await getWorkspaceContextBypassBillingGates()

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
