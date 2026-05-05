/**
 * Story 5.5b — storage enforcement helpers.
 *
 * Storage usage is computed live from the WorkspaceFile aggregate (no
 * denormalised counter for v1 — uploads are low-frequency and the existing
 * @@index([workspace_id]) keeps the SUM fast at our scale).
 *
 * Schema notes (verified against prisma/schema.prisma:1228):
 *   - Model is WorkspaceFile (NOT File). Mapped to workspace_files table.
 *   - Size field is `file_size Int?` (nullable for folders).
 *   - is_folder Boolean discriminates files from folders. Folders have null
 *     file_size and don't count toward storage usage.
 *   - No deleted_at column — deletes are hard-deletes, so the aggregate is
 *     always live and accurate without a soft-delete filter.
 */

import { prisma } from '@/lib/prisma'
import { getEffectiveLimits, isUnlimited, type LimitsWorkspace } from './limits'

const BYTES_PER_GB = 1_073_741_824 // 1024^3

/** Soft-warn threshold — fraction of cap above which the upload still
 * succeeds but the response carries a warning payload for UI surface. */
const STORAGE_SOFT_WARN_THRESHOLD = 0.8

/** Thrown when an upload would push the workspace over its storage cap. */
export class StorageQuotaExceededError extends Error {
  constructor(
    public currentBytes: number,
    public incomingBytes: number,
    public limitBytes: number,
    public tier: string
  ) {
    super(
      `Storage quota exceeded: ${currentBytes + incomingBytes}/${limitBytes} bytes (tier: ${tier})`
    )
    this.name = 'StorageQuotaExceededError'
  }
}

export interface StorageWarning {
  percentUsed: number
  limitBytes: number
}

export interface StorageUsage {
  usedBytes: number
  limitBytes: number | null
  percentUsed: number
  tier: string
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

export function bytesToGB(bytes: number): number {
  return bytes / BYTES_PER_GB
}

export function gbToBytes(gb: number): number {
  return gb * BYTES_PER_GB
}

/**
 * Format bytes as a Swedish-locale string. Uses comma decimals (sv-SE).
 *   2 GB → "2 GB", 1.5 GB → "1,5 GB", 850 MB → "850 MB"
 */
export function formatBytesSwedish(bytes: number): string {
  if (bytes >= BYTES_PER_GB) {
    return (
      new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(
        bytes / BYTES_PER_GB
      ) + ' GB'
    )
  }
  const mb = bytes / (1024 * 1024)
  return (
    new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(mb) +
    ' MB'
  )
}

// ---------------------------------------------------------------------------
// Aggregate query
// ---------------------------------------------------------------------------

/**
 * Sum the bytes of all non-folder files in a workspace. Returns the live
 * value — recomputed on every call. WorkspaceFile is hard-deleted, so the
 * aggregate is always accurate without a soft-delete filter.
 */
async function getCurrentBytes(workspaceId: string): Promise<number> {
  const usage = await prisma.workspaceFile.aggregate({
    where: { workspace_id: workspaceId, is_folder: false },
    _sum: { file_size: true },
  })
  return Number(usage._sum.file_size ?? 0)
}

/**
 * Resolve a workspace's effective storage cap in bytes. Returns null if
 * the tier has no cap (no current tier does — Enterprise has 100 GB default).
 */
async function getLimitBytes(workspaceId: string): Promise<{
  workspace: LimitsWorkspace
  limitBytes: number | null
}> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { subscription_tier: true, trial_picked_tier: true },
  })
  const limits = getEffectiveLimits(workspace)
  return {
    workspace,
    limitBytes: isUnlimited(limits.storageGB)
      ? null
      : gbToBytes(limits.storageGB),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Throw if `incomingBytes` would push the workspace over its cap. Returns
 * an optional `warning` payload when projected usage crosses the 80% soft
 * threshold (non-blocking — caller surfaces to UI).
 */
export async function assertWithinStorageQuota(
  workspaceId: string,
  incomingBytes: number
): Promise<{ warning?: StorageWarning }> {
  const { workspace, limitBytes } = await getLimitBytes(workspaceId)

  // Enterprise default is 100 GB — still a numeric limit, not bypassed.
  // Future story will add Workspace.storage_gb_override for sales-led
  // unbounded customers; until then, enforce the 100 GB default uniformly.
  if (limitBytes === null) return {}

  const currentBytes = await getCurrentBytes(workspaceId)
  const projectedBytes = currentBytes + incomingBytes

  if (projectedBytes > limitBytes) {
    throw new StorageQuotaExceededError(
      currentBytes,
      incomingBytes,
      limitBytes,
      workspace.trial_picked_tier ?? workspace.subscription_tier
    )
  }

  const percentUsed = projectedBytes / limitBytes
  if (percentUsed >= STORAGE_SOFT_WARN_THRESHOLD) {
    return { warning: { percentUsed, limitBytes } }
  }

  return {}
}

/**
 * Read-only snapshot of a workspace's storage usage. Used by:
 *   - Epic 17 file-management surface (storage meter widget)
 *   - 5.5c billing-dashboard usage widget (combines storage + tokens + seats)
 */
export async function getStorageUsage(
  workspaceId: string
): Promise<StorageUsage> {
  const [{ workspace, limitBytes }, currentBytes] = await Promise.all([
    getLimitBytes(workspaceId),
    getCurrentBytes(workspaceId),
  ])

  return {
    usedBytes: currentBytes,
    limitBytes,
    percentUsed: limitBytes === null ? 0 : currentBytes / limitBytes,
    tier: workspace.trial_picked_tier ?? workspace.subscription_tier,
  }
}
