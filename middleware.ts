import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Story 5.1: Workspace access middleware
 * Story 6.0: Performance optimizations
 * - Checks authentication via NextAuth JWT token
 * - Skip middleware for static assets and API routes
 * - Cache JWT verification results in memory
 * - Full workspace verification happens in Server Components/Actions via getWorkspaceContext()
 *
 * Note: Uses getToken() directly instead of withAuth wrapper for better Edge Runtime
 * compatibility. The secret is explicitly passed to ensure it's available in Vercel Edge.
 *
 * Note: Prisma is not available in Edge runtime, so full workspace membership
 * verification is deferred to Server Components using lib/auth/workspace-context.ts
 */

// Simple in-memory cache for JWT verification (Edge Runtime compatible)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jwtCache = new Map<string, { token: any; expires: number }>()
const JWT_CACHE_TTL = 60 * 1000 // 60 seconds

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Story 6.0: Skip middleware for static assets and public API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Skip files with extensions (images, etc.)
  ) {
    return NextResponse.next()
  }

  // Story 6.0: Check JWT cache first
  const sessionCookie = request.cookies.get(
    request.url.startsWith('https://')
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'
  )

  let token = null
  const cacheKey = sessionCookie?.value || ''

  if (cacheKey) {
    const cached = jwtCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      token = cached.token
    }
  }

  // If not in cache, verify JWT token
  if (!token) {
    const isSecure = request.url.startsWith('https://')
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET!,
      cookieName: isSecure
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      secureCookie: isSecure,
    })

    // Cache the result
    if (token && cacheKey) {
      jwtCache.set(cacheKey, {
        token,
        expires: Date.now() + JWT_CACHE_TTL,
      })

      // Clean up old entries periodically
      if (jwtCache.size > 100) {
        const now = Date.now()
        for (const [key, value] of jwtCache.entries()) {
          if (value.expires < now) {
            jwtCache.delete(key)
          }
        }
      }
    }
  }

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
    // Protected workspace routes
    '/dashboard/:path*',
    '/settings/:path*',
    '/laglistor/:path*',
    '/tasks/:path*',
    '/hr/:path*',

    // Workspace-scoped routes
    '/workspace/:path*',
    '/w/:path*', // Story 5.1: Workspace-scoped routes

    // Protected API routes
    '/api/protected/:path*',
    '/api/workspace/:path*',

    // Story 6.0: Exclude static assets and public routes
    '/((?!_next|api/public|static|.*\\.).*)',
  ],
}
