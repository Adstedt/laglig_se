'use client'

/** Story 14.23, Task 3.1: LINK_TASK_TO_DOCUMENT renderer (task → dokument framing). */

import type { AgentActionRendererProps } from './task-approval-renderer'
import { LinkRenderer } from './link-renderer'

export function LinkTaskToDocumentRenderer(props: AgentActionRendererProps) {
  return <LinkRenderer {...props} direction="task-to-document" />
}
