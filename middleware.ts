import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Story 5.1: Workspace access middleware
 * Story 6.0: Performance optimizations
 * Story P.2: Enhanced with rate limiting and geo-routing (AC: 24-28)
 * - Checks authentication via NextAuth JWT token
 * - Skip middleware for static assets and API routes
 * - Cache JWT verification results in memory
 * - Rate limiting with sliding window
 * - Geo-based routing for EU compliance
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

// Story P.2: Initialize rate limiter (AC: 25)
// Development: 100 req/min, Production: 30 req/min for better UX
const isDevelopment = process.env.NODE_ENV === 'development'
const ratelimit = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(
        isDevelopment ? 100 : 30, // More lenient in dev
        '60 s'
      ),
      analytics: true,
      prefix: '@upstash/ratelimit',
    })
  : null

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const startTime = Date.now()

  // Story 6.0: Skip middleware for static assets and public API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Skip files with extensions (images, etc.)
  ) {
    return NextResponse.next()
  }

  // Story P.2: Geo-routing for EU users (AC: 26)
  const geo = (request as any).geo
  const country = geo?.country || 'SE'
  const isEU = isEUCountry(country)
  
  // Skip rate limiting for admin routes in development
  const skipRateLimit = isDevelopment && pathname.startsWith('/admin')
  
  // Story P.2: Rate limiting at edge (AC: 25)
  if (ratelimit && !skipRateLimit) {
    const ip = (request as any).ip ?? '127.0.0.1'
    const identifier = request.headers.get('authorization') || ip
    
    try {
      const { success, limit, reset, remaining } = await ratelimit.limit(identifier)
      
      if (!success) {
        // Return 429 Too Many Requests
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': Math.floor((reset - Date.now()) / 1000).toString(),
          },
        })
      }
      
      // Add rate limit headers to successful responses
      const response = await handleAuthAndRouting(request, isEU)
      response.headers.set('X-RateLimit-Limit', limit.toString())
      response.headers.set('X-RateLimit-Remaining', remaining.toString())
      response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString())
      
      // Story P.2: Track edge function performance (AC: 27)
      const duration = Date.now() - startTime
      response.headers.set('X-Edge-Duration', duration.toString())
      
      // Log slow edge functions
      if (duration > 50) {
        console.warn(`[EDGE] Slow middleware execution: ${duration}ms for ${pathname}`)
      }
      
      return response
    } catch (error) {
      // If rate limiting fails, continue without it
      console.error('[EDGE] Rate limit error:', error)
    }
  }

  return handleAuthAndRouting(request, isEU)
}

async function handleAuthAndRouting(request: NextRequest, isEU: boolean): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  
  // Story P.2: Add geo headers for downstream use (AC: 26)
  const response = NextResponse.next()
  const geo = (request as any).geo
  response.headers.set('X-User-Country', geo?.country || 'SE')
  response.headers.set('X-User-Region', isEU ? 'EU' : 'NON-EU')
  
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

  // Protected routes require authentication
  const isProtectedRoute = 
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/laglistor') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/hr') ||
    pathname.startsWith('/workspace') ||
    pathname.startsWith('/w/') ||
    pathname.startsWith('/api/protected') ||
    pathname.startsWith('/api/workspace')

  // If protected route and no valid token, redirect to login
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Check if this is a workspace-scoped route
  const workspaceRouteMatch = pathname.match(/^\/w\/([^/]+)/)
  if (workspaceRouteMatch) {
    const requestedWorkspaceSlug = workspaceRouteMatch[1]
    const activeWorkspaceId = request.cookies.get('active_workspace_id')?.value

    // Add workspace slug to headers for downstream use
    if (requestedWorkspaceSlug) {
      response.headers.set('x-workspace-slug', requestedWorkspaceSlug)
    }
    if (activeWorkspaceId) {
      response.headers.set('x-workspace-id', activeWorkspaceId)
    }
  }

  return response
}

/**
 * Check if country code is in the EU
 * Story P.2: For GDPR compliance and geo-routing
 */
function isEUCountry(country: string): boolean {
  const euCountries = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // Sweden is EU
    // EEA countries
    'IS', 'LI', 'NO',
  ]
  return euCountries.includes(country.toUpperCase())
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
    
    // Story P.2: Public routes for rate limiting
    '/api/auth/:path*',
    '/api/public/:path*',
    '/login',
    '/signup',
    
    // Story P.2: All routes except static assets (for geo-routing)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}