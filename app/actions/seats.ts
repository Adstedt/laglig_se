'use server'

/**
 * Story 5.5a — workspace seat usage server action.
 *
 * Used by the Team settings tab and the invite modal to render
 * "X / N platser används" subtitles. Reads via getWorkspaceContext() so the
 * caller doesn't have to pass the workspaceId explicitly and we get the
 * permission boundary baked into the auth layer.
 */

import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { computeSeatUsage, type SeatUsage } from '@/lib/usage/seats'

export async function getSeatUsage(): Promise<SeatUsage> {
  const context = await getWorkspaceContext()
  return computeSeatUsage(context.workspaceId)
}
