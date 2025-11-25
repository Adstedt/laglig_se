import * as Sentry from '@sentry/nextjs'

export async function GET() {
  // Capture a test error
  const testError = new Error('Sentry Test Error - Laglig.se')
  Sentry.captureException(testError)

  return Response.json({
    message: 'Test error sent to Sentry',
    timestamp: new Date().toISOString(),
  })
}

export async function POST() {
  // Throw an unhandled error to test automatic capture
  throw new Error('Unhandled Sentry Test Error - Laglig.se')
}
