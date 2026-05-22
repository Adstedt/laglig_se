'use client'

/**
 * Story 14.24 (AC 11a): read-only preview of an agent-drafted styrdokument,
 * rendered in the chat detail panel ("Visa mer" on the draft card). The
 * canvas-ready seam — Story 14.33 upgrades this panel into the responsive canvas.
 *
 * Renders the draft's Tiptap JSON via `generateHTML` using the SAME extension
 * set the Epic 17 editor uses for its HTML derivation (document-editor.tsx
 * `prepareContent`), so headings + tables render identically. No editing here.
 */

import { useMemo } from 'react'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { Badge } from '@/components/ui/badge'
import { DOCUMENT_TYPE_LABELS } from '@/components/features/documents/document-type-labels'
import type { DocumentDraftDetailData } from '@/lib/ai/chat-detail-context'

// Mirrors document-editor.tsx `prepareContent` (minus the editor-only
// SlashCommand/Placeholder/CharacterCount) so the preview matches the editor.
const PREVIEW_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
    underline: false,
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  Image.configure({ inline: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Underline,
  Link.configure({ openOnClick: false }),
  Color,
  TextStyle,
  Highlight.configure({ multicolor: true }),
]

export function DocumentDraftDetail({
  data,
}: {
  data: DocumentDraftDetailData
}) {
  const html = useMemo(() => {
    try {
      return generateHTML(
        (data.contentJson ?? { type: 'doc', content: [] }) as Record<
          string,
          unknown
        >,
        PREVIEW_EXTENSIONS
      )
    } catch {
      return '<p>Förhandsvisningen kunde inte renderas.</p>'
    }
  }, [data.contentJson])

  return (
    <div className="space-y-3">
      <Badge tone="neutral" variant="outline" className="text-[10px]">
        {DOCUMENT_TYPE_LABELS[data.docType] ?? data.docType}
      </Badge>
      {/* Read-only preview generated from the draft's Tiptap JSON (no user HTML). */}
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
