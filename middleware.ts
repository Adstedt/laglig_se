import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequestWithAuth } from 'next-auth/middleware'

/**
 * Story 5.1: Workspace access middleware
 * - Checks authentication via NextAuth
 * - Validates workspace access for workspace-scoped routes
 * - Full workspace verification happens in Server Components/Actions via getWorkspaceContext()
 *
 * Note: Prisma is not available in Edge runtime, so full workspace membership
 * verification is deferred to Server Components using lib/auth/workspace-context.ts
 */
export default withAuth(
  function middleware(request: NextRequestWithAuth) {
    const { pathname } = request.nextUrl

    // Check if this is a workspace-scoped route
    const workspaceRouteMatch = pathname.match(/^\/w\/([^/]+)/)
    if (workspaceRouteMatch) {
      const requestedWorkspaceSlug = workspaceRouteMatch[1]
      const activeWorkspaceId = request.cookies.get(
        'active_workspace_id'
      )?.value

      // If no active workspace cookie set, let the route handler set it
      // If there's a mismatch, the route handler will handle verification
      // This is a lightweight check; full verification happens in Server Components

      // Add workspace slug to headers for downstream use
      const response = NextResponse.next()
      if (requestedWorkspaceSlug) {
        response.headers.set('x-workspace-slug', requestedWorkspaceSlug)
      }
      if (activeWorkspaceId) {
        response.headers.set('x-workspace-id', activeWorkspaceId)
      }
      return response
    }

    // For non-workspace routes, proceed normally
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/workspace/:path*',
    '/w/:path*', // Story 5.1: Workspace-scoped routes
    '/api/protected/:path*',
  ],
}
