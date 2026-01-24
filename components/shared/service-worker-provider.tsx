'use client'

/**
 * Story P.4: Service Worker Provider
 *
 * Handles service worker registration and update notifications.
 * Shows a toast when new content is available.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  registerServiceWorker,
  skipWaiting,
  isServiceWorkerSupported,
} from '@/lib/service-worker/register'

interface ServiceWorkerProviderProps {
  children: React.ReactNode
}

export function ServiceWorkerProvider({
  children,
}: ServiceWorkerProviderProps) {
  const [_updateAvailable, setUpdateAvailable] = useState(false)
  const [_registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    // Only run on client and in production
    if (typeof window === 'undefined') return
    if (!isServiceWorkerSupported()) return

    const register = async () => {
      const reg = await registerServiceWorker({
        onUpdate: (reg) => {
          setRegistration(reg)
          setUpdateAvailable(true)
          // Show update toast
          toast.info('En uppdatering är tillgänglig', {
            description: 'Klicka för att ladda om sidan',
            duration: Infinity,
            action: {
              label: 'Uppdatera',
              onClick: () => {
                skipWaiting()
                window.location.reload()
              },
            },
          })
        },
        onSuccess: (reg) => {
          setRegistration(reg)
          console.log('[SW] Ready for offline use')
        },
        onError: (error) => {
          console.error('[SW] Registration error:', error)
        },
      })

      if (reg) {
        setRegistration(reg)
      }
    }

    // Delay registration to not block initial render
    const timeout = setTimeout(register, 1000)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  // Listen for controlling service worker changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isServiceWorkerSupported()) return

    const handleControllerChange = () => {
      // New service worker is controlling the page
      console.log('[SW] Controller changed')
    }

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    )

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      )
    }
  }, [])

  return <>{children}</>
}

/**
 * Hook to access service worker state
 */
export function useServiceWorker() {
  const [isOnline, setIsOnline] = useState(true)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Set initial online state
    setIsOnline(navigator.onLine)

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check if service worker is ready
    if (isServiceWorkerSupported()) {
      navigator.serviceWorker.ready.then(() => {
        setIsReady(true)
      })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
    isReady,
    isSupported: isServiceWorkerSupported(),
  }
}
