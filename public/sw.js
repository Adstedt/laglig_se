/**
 * Story P.4: Service Worker Implementation
 *
 * Provides offline support with intelligent caching strategies:
 * - CacheFirst for static assets (js, css, images, fonts)
 * - NetworkFirst for API calls with fallback to cache
 * - StaleWhileRevalidate for dynamic pages
 *
 * @see docs/stories/P.4.client-optimization.story.md
 */

// Import Workbox modules
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js'
)

const { cleanupOutdatedCaches } = workbox.precaching
const { registerRoute, NavigationRoute } = workbox.routing
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies
const { CacheableResponsePlugin } = workbox.cacheableResponse
const { ExpirationPlugin } = workbox.expiration

// ============================================================================
// Cache Names
// ============================================================================

const CACHE_PREFIX = 'laglig-se'
const CACHE_VERSION = 'v1'

const CACHE_NAMES = {
  static: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  pages: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`,
  api: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  images: `${CACHE_PREFIX}-images-${CACHE_VERSION}`,
}

// ============================================================================
// Skip waiting and claim clients immediately
// ============================================================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ============================================================================
// Clean up outdated caches
// ============================================================================

cleanupOutdatedCaches()

// ============================================================================
// Static Assets: Cache First
// JavaScript, CSS, fonts - immutable once built
// ============================================================================

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font'),
  new CacheFirst({
    cacheName: CACHE_NAMES.static,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// ============================================================================
// Images: Cache First with longer expiration
// ============================================================================

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
      }),
    ],
  })
)

// ============================================================================
// API Calls: Network First with cache fallback
// For /api/browse, /api/search endpoints
// ============================================================================

registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/api/browse') ||
      url.pathname.startsWith('/api/search') ||
      url.pathname.startsWith('/api/laws')),
  new NetworkFirst({
    cacheName: CACHE_NAMES.api,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
)

// ============================================================================
// Document Pages: Stale While Revalidate
// Law pages, court cases, etc.
// ============================================================================

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.mode === 'navigate' &&
    (url.pathname.startsWith('/lagar/') ||
      url.pathname.startsWith('/rattsfall/') ||
      url.pathname.startsWith('/eu/') ||
      url.pathname.startsWith('/browse/')),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.pages,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60, // 1 hour
      }),
    ],
  })
)

// ============================================================================
// Navigation: Network First with offline fallback
// ============================================================================

const navigationHandler = new NetworkFirst({
  cacheName: CACHE_NAMES.pages,
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
  ],
})

const navigationRoute = new NavigationRoute(navigationHandler, {
  // Exclude API routes and auth routes
  denylist: [/^\/api\//, /^\/auth\//, /^\/admin\//],
})

registerRoute(navigationRoute)

// ============================================================================
// Offline fallback
// ============================================================================

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const preloadResponse = await event.preloadResponse
          if (preloadResponse) {
            return preloadResponse
          }

          const networkResponse = await fetch(event.request)
          return networkResponse
        } catch (_error) {
          // Network failed, try cache
          const cache = await caches.open(CACHE_NAMES.pages)
          const cachedResponse = await cache.match(event.request)

          if (cachedResponse) {
            return cachedResponse
          }

          // Return offline page if available
          const offlineResponse = await cache.match('/offline')
          if (offlineResponse) {
            return offlineResponse
          }

          // Return a basic offline response
          return new Response(
            `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline - Laglig.se</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>Du är offline</h1>
  <p>Kontrollera din internetanslutning och försök igen.</p>
  <p>Tidigare besökta sidor kan fortfarande vara tillgängliga.</p>
</body>
</html>`,
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          )
        }
      })()
    )
  }
})

// ============================================================================
// Log service worker activation
// ============================================================================

self.addEventListener('activate', (_event) => {
  // Service worker activated
})

self.addEventListener('install', (_event) => {
  // Service worker installed
})
