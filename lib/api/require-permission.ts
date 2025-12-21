/**
 * Story 5.2: API Permission Middleware
 * Provides middleware for checking user permissions in API routes.
 *
 * Permission Requirements by Route Pattern:
 * =========================================
 *
 * Public routes (no auth required):
 * - GET /api/browse/* - Public law catalogue
 * - GET /api/laws/* - Public law data
 * - GET /api/health/* - Health checks
 *
 * Auth routes (handled by NextAuth/Supabase):
 * - /api/auth/* - Authentication flow
 *
 * Internal ops routes (bearer token auth):
 * - /api/admin/* - ADMIN_SECRET required
 * - /api/cron/* - CRON_SECRET required
 *
 * Workspace routes (role-based permissions):
 * - GET /api/workspace/context - 'read' (any authenticated user)
 * - POST /api/workspace/members/invite - 'members:invite'
 * - DELETE /api/workspace/members/[id] - 'members:remove'
 * - PUT /api/workspace/members/[id]/role - 'members:change_role'
 * - POST /api/workspace/lists - 'lists:create'
 * - DELETE /api/workspace/lists/[id] - 'lists:delete'
 * - POST /api/workspace/lists/[id]/documents - 'documents:add'
 * - DELETE /api/workspace/lists/[id]/documents/[docId] - 'documents:remove'
 * - PUT /api/workspace/tasks/[id] - 'tasks:edit'
 * - POST /api/workspace/changes/[id]/acknowledge - 'changes:acknowledge'
 * - GET /api/workspace/employees - 'employees:view'
 * - POST /api/workspace/employees - 'employees:manage'
 * - GET /api/workspace/activity - 'activity:view'
 * - POST /api/ai/chat - 'ai:chat'
 *
 * Note: Most workspace routes will be implemented in Stories 5.3+
 */

import { NextResponse } from 'next/server'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
  type WorkspaceContext,
} from '@/lib/auth/workspace-context'
import { hasPermission, type Permission } from '@/lib/auth/permissions'

/**
 * Result of permission check - either null (granted) or a 403 response
 */
export type PermissionCheckResult = NextResponse | null

/**
 * Extended result that includes the workspace context when granted
 */
export type PermissionCheckResultWithContext =
  | { granted: true; context: WorkspaceContext }
  | { granted: false; response: NextResponse }

/**
 * Middleware to check user has ALL required permissions.
 * Returns null if all permissions granted, or NextResponse with 403 if denied.
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   const denied = await requirePermission('documents:add')
 *   if (denied) return denied
 *   // Permission granted, proceed...
 * }
 * ```
 */
export async function requirePermission(
  ...permissions: Permission[]
): Promise<PermissionCheckResult> {
  try {
    const context = await getWorkspaceContext()

    for (const permission of permissions) {
      if (!hasPermission(context.role, permission)) {
        return NextResponse.json(
          {
            error: 'Åtkomst nekad',
            message: 'Du har inte behörighet att utföra denna åtgärd',
            required: permission,
            userRole: context.role,
          },
          { status: 403 }
        )
      }
    }

    return null // All permissions granted
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      const statusCode = error.code === 'UNAUTHORIZED' ? 401 : 403
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          message:
            error.code === 'UNAUTHORIZED'
              ? 'Autentisering krävs'
              : 'Åtkomst nekad',
        },
        { status: statusCode }
      )
    }
    throw error
  }
}

/**
 * Check if user has ANY of the specified permissions (OR logic).
 * Returns null if at least one permission is granted, or 403 if none.
 *
 * @example
 * ```ts
 * export async function DELETE(request: Request) {
 *   const denied = await requireAnyPermission('lists:delete', 'workspace:delete')
 *   if (denied) return denied
 *   // At least one permission granted, proceed...
 * }
 * ```
 */
export async function requireAnyPermission(
  ...permissions: Permission[]
): Promise<PermissionCheckResult> {
  try {
    const context = await getWorkspaceContext()

    const hasAny = permissions.some((p) => hasPermission(context.role, p))

    if (!hasAny) {
      return NextResponse.json(
        {
          error: 'Åtkomst nekad',
          message: 'Du har inte behörighet att utföra denna åtgärd',
          requiredAny: permissions,
          userRole: context.role,
        },
        { status: 403 }
      )
    }

    return null // At least one permission granted
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      const statusCode = error.code === 'UNAUTHORIZED' ? 401 : 403
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          message:
            error.code === 'UNAUTHORIZED'
              ? 'Autentisering krävs'
              : 'Åtkomst nekad',
        },
        { status: statusCode }
      )
    }
    throw error
  }
}

/**
 * Check permission and return workspace context if granted.
 * Useful when you need the context data after permission check.
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   const result = await requirePermissionWithContext('read')
 *   if (!result.granted) return result.response
 *   const { context } = result
 *   // Use context.workspaceId, context.role, etc.
 * }
 * ```
 */
export async function requirePermissionWithContext(
  ...permissions: Permission[]
): Promise<PermissionCheckResultWithContext> {
  try {
    const context = await getWorkspaceContext()

    for (const permission of permissions) {
      if (!hasPermission(context.role, permission)) {
        return {
          granted: false,
          response: NextResponse.json(
            {
              error: 'Åtkomst nekad',
              message: 'Du har inte behörighet att utföra denna åtgärd',
              required: permission,
              userRole: context.role,
            },
            { status: 403 }
          ),
        }
      }
    }

    return { granted: true, context }
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      const statusCode = error.code === 'UNAUTHORIZED' ? 401 : 403
      return {
        granted: false,
        response: NextResponse.json(
          {
            error: error.message,
            code: error.code,
            message:
              error.code === 'UNAUTHORIZED'
                ? 'Autentisering krävs'
                : 'Åtkomst nekad',
          },
          { status: statusCode }
        ),
      }
    }
    throw error
  }
}
