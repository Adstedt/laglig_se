/**
 * Story P.4: Service Worker Registration
 *
 * Handles service worker registration and updates.
 * Only registers in production to avoid caching issues during development.
 */

interface ServiceWorkerConfig {
  /** Callback when update is available */
  onUpdate?: (_registration: ServiceWorkerRegistration) => void
  /** Callback when service worker is ready */
  onSuccess?: (_registration: ServiceWorkerRegistration) => void
  /** Callback on registration error */
  onError?: (_error: Error) => void
}

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator
}

/**
 * Register the service worker
 *
 * @param config - Configuration options
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | undefined> {
  // Only register in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SW] Skipping service worker registration in development')
    return undefined
  }

  if (!isServiceWorkerSupported()) {
    console.log('[SW] Service workers are not supported')
    return undefined
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing

      if (!installingWorker) return

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content is available
            console.log('[SW] New content is available; please refresh.')
            config.onUpdate?.(registration)
          } else {
            // Content is cached for offline use
            console.log('[SW] Content is cached for offline use.')
            config.onSuccess?.(registration)
          }
        }
      })
    })

    // Initial registration success
    console.log('[SW] Service worker registered successfully')

    // Check if there's an active service worker
    if (registration.active) {
      config.onSuccess?.(registration)
    }

    return registration
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[SW] Service worker registration failed:', err)
    config.onError?.(err)
    return undefined
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()

    await Promise.all(
      registrations.map((registration) => registration.unregister())
    )

    console.log('[SW] All service workers unregistered')
    return true
  } catch (error) {
    console.error('[SW] Failed to unregister service workers:', error)
    return false
  }
}

/**
 * Skip waiting and activate new service worker immediately
 */
export function skipWaiting(): void {
  if (!isServiceWorkerSupported() || !navigator.serviceWorker.controller) {
    return
  }

  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
  } catch (error) {
    console.error('[SW] Failed to check for updates:', error)
  }
}
