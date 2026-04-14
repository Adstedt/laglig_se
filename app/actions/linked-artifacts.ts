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
  if (!z.string().uuid().safeParse(listItemId).success) {
    return { success: false, error: 'Ogiltigt ID' }
  }

  try {
    return await withWorkspace(async (ctx) => {
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

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
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
        if (task.workspace_id !== ctx.workspaceId) continue
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
    }, 'read')
  } catch (error) {
    console.error('getLinkedArtifactsForListItem error:', error)
    return { success: false, error: 'Kunde inte hämta länkade artefakter' }
  }
}
