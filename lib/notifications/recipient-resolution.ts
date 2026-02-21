import { prisma } from '@/lib/prisma'

export interface AffectedRecipient {
  userId: string
  email: string
  name: string | null
  workspaceId: string
  workspaceName: string
}

/**
 * Resolves all users who should be notified about a change to a given document.
 *
 * Resolution chain:
 *   LegalDocument.id → LawListItem.document_id → LawList.workspace_id
 *     → WorkspaceMember → User
 *
 * Returns one entry per user per workspace (no cross-workspace deduplication).
 *
 * Note: WorkspaceMember has no `is_active` field today. If deactivation is added
 * later, add a filter here: `where: { is_active: true }`.
 */
export async function resolveAffectedRecipients(
  documentId: string
): Promise<AffectedRecipient[]> {
  const workspaces = await prisma.workspace.findMany({
    where: {
      law_lists: {
        some: {
          items: {
            some: { document_id: documentId },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
  })

  return workspaces.flatMap((ws) =>
    ws.members.map((member) => ({
      userId: member.user.id,
      email: member.user.email,
      name: member.user.name,
      workspaceId: ws.id,
      workspaceName: ws.name,
    }))
  )
}
