import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Story 5.1: Workspace access middleware
 * - Checks authentication via NextAuth JWT token
 * - Validates workspace access for workspace-scoped routes
 * - Full workspace verification happens in Server Components/Actions via getWorkspaceContext()
 *
 * Note: Uses getToken() directly instead of withAuth wrapper for better Edge Runtime
 * compatibility. The secret is explicitly passed to ensure it's available in Vercel Edge.
 *
 * Note: Prisma is not available in Edge runtime, so full workspace membership
 * verification is deferred to Server Components using lib/auth/workspace-context.ts
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Verify JWT token - explicitly pass secret for Edge Runtime compatibility
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
  })

  // If no valid token, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Check if this is a workspace-scoped route
  const workspaceRouteMatch = pathname.match(/^\/w\/([^/]+)/)
  if (workspaceRouteMatch) {
    const requestedWorkspaceSlug = workspaceRouteMatch[1]
    const activeWorkspaceId = request.cookies.get('active_workspace_id')?.value

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
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/workspace/:path*',
    '/w/:path*', // Story 5.1: Workspace-scoped routes
    '/api/protected/:path*',
  ],
}
