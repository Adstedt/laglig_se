'use server'

/**
 * Story 17.18: Linked Artifacts — consolidated surface for a LawListItem.
 *
 * Unions five link-pathways into a single deduplicated list:
 *   - FileListItemLink            → direct file → list item
 *   - WorkspaceDocumentListItemLink → direct styrdokument → list item
 *   - RequirementEvidenceLink     → bevis for a kravpunkt (file or document)
 *   - FileTaskLink (via task)     → file on a task linked to this list item
 *   - WorkspaceDocumentTaskLink (via task) → document on a task linked to this list item
 *
 * Each artifact appears exactly once; back-references record every pathway.
 */

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface LinkedArtifactRequirementRef {
  id: string
  text: string
}

export interface LinkedArtifactTaskRef {
  id: string
  title: string
}

export interface LinkedArtifact {
  kind: 'file' | 'document'
  id: string

  // File fields (when kind === 'file')
  filename?: string
  mimeType?: string | null
  fileSize?: number | null

  // Document fields (when kind === 'document')
  title?: string
  documentType?: string
  status?: string
  versionNumber?: number

  // Back-references (at least one is always non-empty)
  directLink: boolean
  requirements: LinkedArtifactRequirementRef[]
  tasks: LinkedArtifactTaskRef[]
}

export interface LinkedArtifactsResult {
  artifacts: LinkedArtifact[]
  /** Tasks linked to this list item that have zero attached files OR documents. */
  tasksWithoutAttachmentCount: number
}

// ============================================================================
// Server action
// ============================================================================

export async function getLinkedArtifactsForListItem(
  listItemId: string
): Promise<ActionResult<LinkedArtifactsResult>> {
  return withWorkspace(
    (ctx) => loadLinkedArtifacts(listItemId, ctx.workspaceId),
    'read'
  )
}

/**
 * Story 19.4 (SF-A): workspaceId-parameterized core of the linked-artifacts
 * query. Both the session-derived `getLinkedArtifactsForListItem` (above) and
 * the agent `list_linked_artifacts` tool (closure workspaceId — no `cookies()`
 * dependency inside the streaming tool loop) delegate here.
 */
export async function loadLinkedArtifacts(
  listItemId: string,
  workspaceId: string
): Promise<ActionResult<LinkedArtifactsResult>> {
  if (!z.string().uuid().safeParse(listItemId).success) {
    return { success: false, error: 'Ogiltigt ID' }
  }

  try {
    const item = await prisma.lawListItem.findFirst({
      where: { id: listItemId },
      include: {
        law_list: { select: { workspace_id: true } },
        file_links: {
          include: {
            file: {
              select: {
                id: true,
                filename: true,
                mime_type: true,
                file_size: true,
              },
            },
          },
        },
        workspace_document_links: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                document_type: true,
                status: true,
                current_version_number: true,
              },
            },
          },
        },
        requirements: {
          select: {
            id: true,
            text: true,
            evidence_links: {
              include: {
                file: {
                  select: {
                    id: true,
                    filename: true,
                    mime_type: true,
                    file_size: true,
                  },
                },
                workspace_document: {
                  select: {
                    id: true,
                    title: true,
                    document_type: true,
                    status: true,
                    current_version_number: true,
                  },
                },
              },
            },
          },
        },
        task_links: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                workspace_id: true,
                file_links: {
                  include: {
                    file: {
                      select: {
                        id: true,
                        filename: true,
                        mime_type: true,
                        file_size: true,
                      },
                    },
                  },
                },
                workspace_document_links: {
                  include: {
                    document: {
                      select: {
                        id: true,
                        title: true,
                        document_type: true,
                        status: true,
                        current_version_number: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!item || item.law_list.workspace_id !== workspaceId) {
      return { success: false, error: 'Laglistpost hittades inte' }
    }

    const byKey = new Map<string, LinkedArtifact>()

    const ensureFile = (file: {
      id: string
      filename: string
      mime_type: string | null
      file_size: number | null
    }) => {
      const key = `file:${file.id}`
      let entry = byKey.get(key)
      if (!entry) {
        entry = {
          kind: 'file',
          id: file.id,
          filename: file.filename,
          mimeType: file.mime_type,
          fileSize: file.file_size,
          directLink: false,
          requirements: [],
          tasks: [],
        }
        byKey.set(key, entry)
      }
      return entry
    }

    const ensureDocument = (doc: {
      id: string
      title: string
      document_type: string
      status: string
      current_version_number: number
    }) => {
      const key = `document:${doc.id}`
      let entry = byKey.get(key)
      if (!entry) {
        entry = {
          kind: 'document',
          id: doc.id,
          title: doc.title,
          documentType: doc.document_type,
          status: doc.status,
          versionNumber: doc.current_version_number,
          directLink: false,
          requirements: [],
          tasks: [],
        }
        byKey.set(key, entry)
      }
      return entry
    }

    // Pathway 1: direct file links
    for (const link of item.file_links) {
      const entry = ensureFile(link.file)
      entry.directLink = true
    }

    // Pathway 2: direct document links
    for (const link of item.workspace_document_links) {
      const entry = ensureDocument(link.document)
      entry.directLink = true
    }

    // Pathway 3: kravpunkt evidence (file or document)
    for (const req of item.requirements) {
      const ref: LinkedArtifactRequirementRef = { id: req.id, text: req.text }
      for (const link of req.evidence_links) {
        if (link.file) {
          const entry = ensureFile(link.file)
          if (!entry.requirements.some((r) => r.id === ref.id)) {
            entry.requirements.push(ref)
          }
        } else if (link.workspace_document) {
          const entry = ensureDocument(link.workspace_document)
          if (!entry.requirements.some((r) => r.id === ref.id)) {
            entry.requirements.push(ref)
          }
        }
      }
    }

    // Pathway 4 + 5: task-side files and documents.
    // Also tally tasks-without-attachment for the compliance-health widget.
    let tasksWithoutAttachmentCount = 0
    for (const taskLink of item.task_links) {
      const task = taskLink.task
      if (task.workspace_id !== workspaceId) continue
      const hasAnyAttachment =
        task.file_links.length > 0 || task.workspace_document_links.length > 0
      if (!hasAnyAttachment) tasksWithoutAttachmentCount++
      const ref: LinkedArtifactTaskRef = { id: task.id, title: task.title }
      for (const fileLink of task.file_links) {
        const entry = ensureFile(fileLink.file)
        if (!entry.tasks.some((t) => t.id === ref.id)) {
          entry.tasks.push(ref)
        }
      }
      for (const docLink of task.workspace_document_links) {
        const entry = ensureDocument(docLink.document)
        if (!entry.tasks.some((t) => t.id === ref.id)) {
          entry.tasks.push(ref)
        }
      }
    }

    return {
      success: true,
      data: {
        artifacts: Array.from(byKey.values()),
        tasksWithoutAttachmentCount,
      },
    }
  } catch (error) {
    console.error('loadLinkedArtifacts error:', error)
    return { success: false, error: 'Kunde inte hämta länkade artefakter' }
  }
}

/**
 * Story 6.7d (Option A): task-side variant of the linked-artifacts query.
 *
 * Same `LinkedArtifactsResult` shape as `getLinkedArtifactsForListItem` so the
 * shared `LinkedArtifactsPanel` component can render either entity. Simpler
 * internals (only 2 pathways): a task accumulates direct file attachments and
 * direct workspace document links; there is no transitive concept (the entity
 * IS the task).
 *
 * `directLink` is always true; `requirements` and `tasks` back-references are
 * always empty — those are list-item-only concepts.
 */
export async function getLinkedArtifactsForTask(
  taskId: string
): Promise<ActionResult<LinkedArtifactsResult>> {
  if (!z.string().uuid().safeParse(taskId).success) {
    return { success: false, error: 'Ogiltigt ID' }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: ctx.workspaceId },
        include: {
          file_links: {
            include: {
              file: {
                select: {
                  id: true,
                  filename: true,
                  mime_type: true,
                  file_size: true,
                },
              },
            },
          },
          workspace_document_links: {
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  document_type: true,
                  status: true,
                  current_version_number: true,
                },
              },
            },
          },
        },
      })

      if (!task) {
        return { success: false, error: 'Uppgift hittades inte' }
      }

      const byKey = new Map<string, LinkedArtifact>()

      // Pathway A: direct file links on this task
      for (const link of task.file_links) {
        byKey.set(`file:${link.file.id}`, {
          kind: 'file',
          id: link.file.id,
          filename: link.file.filename,
          mimeType: link.file.mime_type,
          fileSize: link.file.file_size,
          directLink: true,
          requirements: [],
          tasks: [],
        })
      }

      // Pathway B: direct workspace-document links on this task
      for (const link of task.workspace_document_links) {
        byKey.set(`document:${link.document.id}`, {
          kind: 'document',
          id: link.document.id,
          title: link.document.title,
          documentType: link.document.document_type,
          status: link.document.status,
          versionNumber: link.document.current_version_number,
          directLink: true,
          requirements: [],
          tasks: [],
        })
      }

      return {
        success: true,
        data: {
          artifacts: Array.from(byKey.values()),
          tasksWithoutAttachmentCount: 0, // not applicable on a task
        },
      }
    }, 'read')
  } catch (error) {
    console.error('getLinkedArtifactsForTask error:', error)
    return { success: false, error: 'Kunde inte hämta länkade artefakter' }
  }
}
