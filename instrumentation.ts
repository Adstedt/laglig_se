export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = async (
  error: Error,
  request: {
    path: string
    method: string
    headers: Record<string, string>
  },
  context: {
    routerKind: string
    routePath: string | undefined
    routeType: string
    revalidateReason: string | undefined
    renderSource: string | undefined
  }
) => {
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureException(error, {
    tags: {
      routerKind: context.routerKind,
      routeType: context.routeType,
    },
    extra: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
    },
  })
}
