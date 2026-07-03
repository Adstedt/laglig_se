/**
 * Tests for workspace-file chunking (Story 17.9, Task 1)
 * Pure unit — paragraph-merge, token cap/target, content_role, metadata, and the
 * write-side isolation invariant (no null workspace_id).
 */

import { describe, it, expect } from 'vitest'
import {
  chunkUserFile,
  buildFileHeader,
  chunkWorkspaceDocument,
  buildDocumentHeader,
  type ChunkUserFileInput,
  type ChunkWorkspaceDocumentInput,
} from '@/lib/chunks/chunk-workspace-document'

function makeFile(
  overrides: Partial<ChunkUserFileInput> = {}
): ChunkUserFileInput {
  return {
    fileId: 'file-1',
    workspaceId: 'ws-1',
    filename: 'rutin.pdf',
    category: 'POLICY',
    markdown: 'Stycke ett med tillräckligt innehåll för en chunk.',
    contentHash: 'hash-abc',
    ...overrides,
  }
}

describe('chunkUserFile — source-type + isolation', () => {
  it('stamps USER_FILE, the file id, and a non-null workspace_id on every chunk', () => {
    const chunks = chunkUserFile(makeFile())
    expect(chunks.length).toBeGreaterThan(0)
    for (const c of chunks) {
      expect(c.source_type).toBe('USER_FILE')
      expect(c.source_id).toBe('file-1')
      expect(c.workspace_id).toBe('ws-1')
      expect(c.workspace_id).not.toBeNull()
    }
  })

  it('write-side invariant: throws rather than emit a chunk with a null/empty workspace_id', () => {
    expect(() => chunkUserFile(makeFile({ workspaceId: '' }))).toThrow(
      /workspace_id is required/
    )
  })

  it('sets contextual_header = filename + category and writes defensive metadata', () => {
    const chunks = chunkUserFile(makeFile())
    expect(chunks[0]!.contextual_header).toBe(
      buildFileHeader('rutin.pdf', 'POLICY')
    )
    expect(chunks[0]!.metadata).toMatchObject({
      filename: 'rutin.pdf',
      category: 'POLICY',
      content_hash: 'hash-abc',
    })
  })

  it('omits content_hash from metadata when not provided', () => {
    const chunks = chunkUserFile(makeFile({ contentHash: null }))
    expect(chunks[0]!.metadata).not.toHaveProperty('content_hash')
    expect(chunks[0]!.metadata).toMatchObject({ filename: 'rutin.pdf' })
  })
})

describe('chunkUserFile — paragraph-merge chunking', () => {
  it('merges small adjacent paragraphs into a single chunk (below the token target)', () => {
    const markdown =
      'Första korta stycket.\n\nAndra korta stycket.\n\nTredje stycket.'
    const chunks = chunkUserFile(makeFile({ markdown }))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.content).toContain('Första')
    expect(chunks[0]!.content).toContain('Tredje')
  })

  it('splits an oversized block and caps each chunk at ~1000 tokens', () => {
    // ~6000 chars of sentences => >1000 tokens => splitOversized into multiple chunks.
    const sentence = 'Detta är en mening om arbetsmiljö och rutiner. '
    const big = sentence.repeat(130) // ~6240 chars
    const chunks = chunkUserFile(makeFile({ markdown: big }))
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.token_count).toBeLessThanOrEqual(1000)
    }
  })

  it('drops blocks below the minimum chunk size', () => {
    const chunks = chunkUserFile(makeFile({ markdown: 'kort' }))
    expect(chunks).toHaveLength(0)
  })

  it('returns no chunks for empty markdown', () => {
    expect(chunkUserFile(makeFile({ markdown: '' }))).toHaveLength(0)
    expect(chunkUserFile(makeFile({ markdown: '   \n\n  ' }))).toHaveLength(0)
  })
})

describe('chunkUserFile — content_role detection', () => {
  it('classifies a standalone heading as HEADING', () => {
    const markdown = '# Rubrik ett\n\n## Rubrik två med lite mer text här'
    const chunks = chunkUserFile(makeFile({ markdown }))
    // Each heading becomes its own block (merge never spans headings).
    expect(chunks.every((c) => c.content_role === 'HEADING')).toBe(true)
  })

  it('classifies a markdown table block as TABLE', () => {
    const markdown =
      '| Kolumn A | Kolumn B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |'
    const chunks = chunkUserFile(makeFile({ markdown }))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.content_role).toBe('TABLE')
  })

  it('classifies prose as MARKDOWN_CHUNK', () => {
    const markdown =
      'Detta är ett vanligt stycke text som beskriver en rutin i verksamheten.'
    const chunks = chunkUserFile(makeFile({ markdown }))
    expect(chunks[0]!.content_role).toBe('MARKDOWN_CHUNK')
  })
})

function makeDoc(
  overrides: Partial<ChunkWorkspaceDocumentInput> = {}
): ChunkWorkspaceDocumentInput {
  return {
    documentId: 'doc-1',
    workspaceId: 'ws-1',
    title: 'Dataskyddspolicy',
    documentType: 'POLICY',
    status: 'APPROVED',
    markdown: 'Vår dataskyddspolicy kräver kryptering av personuppgifter.',
    contentHash: 'doc-hash-1',
    ...overrides,
  }
}

describe('chunkWorkspaceDocument — styrdokument (Story 17.9b)', () => {
  it('stamps WORKSPACE_DOCUMENT, the document id, and a non-null workspace_id', () => {
    const chunks = chunkWorkspaceDocument(makeDoc())
    expect(chunks.length).toBeGreaterThan(0)
    for (const c of chunks) {
      expect(c.source_type).toBe('WORKSPACE_DOCUMENT')
      expect(c.source_id).toBe('doc-1')
      expect(c.workspace_id).toBe('ws-1')
    }
  })

  it('write-side invariant: throws rather than emit a chunk with a null/empty workspace_id', () => {
    expect(() => chunkWorkspaceDocument(makeDoc({ workspaceId: '' }))).toThrow(
      /workspace_id is required/
    )
  })

  it('sets contextual_header = title + type and metadata {title, document_type, status, content_hash}', () => {
    const chunks = chunkWorkspaceDocument(makeDoc())
    expect(chunks[0]!.contextual_header).toBe(
      buildDocumentHeader('Dataskyddspolicy', 'POLICY')
    )
    expect(chunks[0]!.metadata).toMatchObject({
      title: 'Dataskyddspolicy',
      document_type: 'POLICY',
      status: 'APPROVED',
      content_hash: 'doc-hash-1',
    })
  })

  it('omits content_hash from metadata when not provided', () => {
    const chunks = chunkWorkspaceDocument(makeDoc({ contentHash: null }))
    expect(chunks[0]!.metadata).not.toHaveProperty('content_hash')
    expect(chunks[0]!.metadata).toMatchObject({ title: 'Dataskyddspolicy' })
  })

  it('reuses the heading-aware paragraph-merge (headings get their own chunk)', () => {
    const markdown = '# Rubrik\n\n## Underrubrik med lite mer text här'
    const chunks = chunkWorkspaceDocument(makeDoc({ markdown }))
    expect(chunks.every((c) => c.content_role === 'HEADING')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Story 7.5: chunkCollectiveAgreement — section-aware agreement chunks
// ---------------------------------------------------------------------------

import {
  chunkCollectiveAgreement,
  buildAgreementHeader,
  type ChunkCollectiveAgreementInput,
} from '@/lib/chunks/chunk-workspace-document'

function makeAgreement(
  overrides: Partial<ChunkCollectiveAgreementInput> = {}
): ChunkCollectiveAgreementInput {
  return {
    agreementId: 'agr-1',
    workspaceId: 'ws-1',
    agreementName: 'Byggavtalet 2024',
    filename: 'byggavtalet.pdf',
    personelType: 'ARB',
    workspaceFileId: 'file-9',
    markdown:
      'Inledande bestämmelser om avtalets omfattning och parternas åtaganden.',
    contentHash: 'ca-hash-1',
    ...overrides,
  }
}

describe('chunkCollectiveAgreement — source-type + isolation (Story 7.5)', () => {
  it('stamps COLLECTIVE_AGREEMENT, the AGREEMENT id (not the file id), and a non-null workspace_id', () => {
    const chunks = chunkCollectiveAgreement(makeAgreement())
    expect(chunks.length).toBeGreaterThan(0)
    for (const c of chunks) {
      expect(c.source_type).toBe('COLLECTIVE_AGREEMENT')
      expect(c.source_id).toBe('agr-1') // NOT 'file-9'
      expect(c.workspace_id).toBe('ws-1')
      expect(c.workspace_id).not.toBeNull()
    }
  })

  it('write-side invariant: throws rather than emit a chunk with a null/empty workspace_id', () => {
    expect(() =>
      chunkCollectiveAgreement(makeAgreement({ workspaceId: '' }))
    ).toThrow(/workspace_id is required/)
  })

  it('writes metadata {agreement_name, filename, personel_type, workspace_file_id, content_hash}', () => {
    const chunks = chunkCollectiveAgreement(makeAgreement())
    expect(chunks[0]!.metadata).toMatchObject({
      agreement_name: 'Byggavtalet 2024',
      filename: 'byggavtalet.pdf',
      personel_type: 'ARB',
      workspace_file_id: 'file-9',
      content_hash: 'ca-hash-1',
    })
  })

  it('omits personel_type / workspace_file_id / content_hash from metadata when absent', () => {
    const chunks = chunkCollectiveAgreement(
      makeAgreement({
        personelType: null,
        workspaceFileId: null,
        contentHash: null,
      })
    )
    expect(chunks[0]!.metadata).not.toHaveProperty('personel_type')
    expect(chunks[0]!.metadata).not.toHaveProperty('workspace_file_id')
    expect(chunks[0]!.metadata).not.toHaveProperty('content_hash')
    expect(chunks[0]!.metadata).toMatchObject({
      agreement_name: 'Byggavtalet 2024',
    })
  })
})

describe('chunkCollectiveAgreement — section-aware contextual_header (AC 5)', () => {
  const markdown = [
    'Inledande bestämmelser om avtalets omfattning som ligger före första rubriken i dokumentet.',
    '## Arbetstid',
    'Ordinarie arbetstid utgör fyrtio timmar per helgfri vecka i genomsnitt per kalenderår.',
    '## Semester',
    'Semester utgår enligt semesterlagen med de tillägg som anges i detta avtal om semesterlön.',
  ].join('\n\n')

  it('chunks before the first heading carry agreement name only; later chunks carry the nearest section', () => {
    const chunks = chunkCollectiveAgreement(makeAgreement({ markdown }))

    const intro = chunks.find((c) =>
      c.content.startsWith('Inledande bestämmelser')
    )
    expect(intro).toBeDefined()
    expect(intro!.contextual_header).toBe('Byggavtalet 2024 (Kollektivavtal)')

    const arbetstid = chunks.find((c) =>
      c.content.includes('Ordinarie arbetstid')
    )
    expect(arbetstid).toBeDefined()
    expect(arbetstid!.contextual_header).toBe(
      'Byggavtalet 2024 (Kollektivavtal) > Arbetstid'
    )

    const semester = chunks.find((c) =>
      c.content.includes('Semester utgår enligt semesterlagen')
    )
    expect(semester).toBeDefined()
    expect(semester!.contextual_header).toBe(
      'Byggavtalet 2024 (Kollektivavtal) > Semester'
    )
  })

  it('the header identifies agreement + section, never just the filename', () => {
    const chunks = chunkCollectiveAgreement(makeAgreement({ markdown }))
    for (const c of chunks) {
      expect(c.contextual_header).toContain('Byggavtalet 2024')
      expect(c.contextual_header).toContain('(Kollektivavtal)')
      expect(c.contextual_header).not.toContain('byggavtalet.pdf')
    }
  })

  it('buildAgreementHeader renders with and without a section', () => {
    expect(buildAgreementHeader('Byggavtalet 2024', null)).toBe(
      'Byggavtalet 2024 (Kollektivavtal)'
    )
    expect(buildAgreementHeader('Byggavtalet 2024', 'Arbetstid')).toBe(
      'Byggavtalet 2024 (Kollektivavtal) > Arbetstid'
    )
  })

  it('USER_FILE chunking is untouched by the section-aware path (fixed header)', () => {
    const chunks = chunkUserFile(
      makeFile({
        markdown,
        filename: 'byggavtalet.pdf',
        category: 'AVTAL',
      })
    )
    for (const c of chunks) {
      expect(c.contextual_header).toBe('byggavtalet.pdf (AVTAL)')
    }
  })
})
