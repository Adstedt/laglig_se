'use client'

/** Story 14.23, Task 3.2: LINK_DOCUMENT_TO_TASK renderer (dokument → uppgift framing). */

import type { AgentActionRendererProps } from './task-approval-renderer'
import { LinkRenderer } from './link-renderer'

export function LinkDocumentToTaskRenderer(props: AgentActionRendererProps) {
  return <LinkRenderer {...props} direction="document-to-task" />
}
