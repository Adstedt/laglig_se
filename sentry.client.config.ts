import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (!dsn) {
  console.warn('Sentry DSN not configured, error tracking disabled')
} else {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Filter out network errors and non-critical issues
    beforeSend(event, hint) {
      const error = hint.originalException as Error | undefined
      if (error?.name === 'NetworkError') {
        return null
      }
      return event
    },
  })
}
