import * as Sentry from '@sentry/nextjs'

export function setSentryUser(user: {
  id: string
  email?: string
  workspaceId?: string
}) {
  const sentryUser: { id: string; email?: string } = { id: user.id }
  if (user.email) {
    sentryUser.email = user.email
  }
  Sentry.setUser(sentryUser)

  if (user.workspaceId) {
    Sentry.setTag('workspace_id', user.workspaceId)
  }
}

export function clearSentryUser() {
  Sentry.setUser(null)
}
