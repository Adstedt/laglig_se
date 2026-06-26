import { describe, it, expect } from 'vitest'
import {
  hasCitationMarkers,
  extractSourcesFromToolResult,
  resolveSource,
  sourcesToMap,
  anchorIdFromPath,
  chunkCitationKey,
  parseCitationLabel,
  getDocBrowsePath,
  type SourceInfo,
} from '@/lib/ai/citations'

describe('hasCitationMarkers', () => {
  it('returns false for plain text', () => {
    expect(hasCitationMarkers('This is plain text')).toBe(false)
  })

  it('returns true when [Källa: ...] present', () => {
    expect(hasCitationMarkers('Se [Källa: SFS 1977:1160]')).toBe(true)
  })

  it('returns true for partial marker', () => {
    expect(hasCitationMarkers('text [Källa: partial')).toBe(true)
  })

  // Story 17.10b: [Utkast:] is the draft-tier citation form (DEC-3).
  it('returns true when [Utkast: ...] present (17.10b draft tier)', () => {
    expect(
      hasCitationMarkers('enligt utkast till [Utkast: Semesterpolicy]')
    ).toBe(true)
  })
})

describe('anchorIdFromPath', () => {
  it('returns K{chapter}P{section} for chaptered paths', () => {
    expect(anchorIdFromPath('kap3.§2a')).toBe('K3P2a')
    expect(anchorIdFromPath('kap1.§1')).toBe('K1P1')
  })

  it('returns P{section} for flat docs', () => {
    expect(anchorIdFromPath('kap0.§5')).toBe('P5')
  })

  it('returns null for non-paragraf paths', () => {
    expect(anchorIdFromPath('overgangsbest')).toBeNull()
  })
})

describe('chunkCitationKey', () => {
  it('builds key with chapter', () => {
    expect(chunkCitationKey('SFS 1977:1160', 'kap3.§2a')).toBe(
      'SFS 1977:1160, Kap 3, 2a §'
    )
  })

  it('builds key without chapter for flat docs', () => {
    expect(chunkCitationKey('SFS 1982:80', 'kap0.§7')).toBe('SFS 1982:80, 7 §')
  })
})

describe('parseCitationLabel', () => {
  it('parses "Kap N, M §" format', () => {
    expect(parseCitationLabel('SFS 1977:1160, Kap 3, 2a §')).toEqual({
      docNum: 'SFS 1977:1160',
      path: 'kap3.§2a',
    })
  })

  it('parses "M §" flat format', () => {
    expect(parseCitationLabel('SFS 1982:80, 7 §')).toEqual({
      docNum: 'SFS 1982:80',
      path: 'kap0.§7',
    })
  })

  it('parses "N kap. M §" format', () => {
    expect(parseCitationLabel('SFS 1977:1160, 3 kap. 2a §')).toEqual({
      docNum: 'SFS 1977:1160',
      path: 'kap3.§2a',
    })
  })

  it('parses "N kap M §" format (no period)', () => {
    expect(parseCitationLabel('SFS 1977:1160, 3 kap 2a §')).toEqual({
      docNum: 'SFS 1977:1160',
      path: 'kap3.§2a',
    })
  })

  it('returns null for ranges', () => {
    expect(parseCitationLabel('SFS 1977:1160, Kap 1, 2-3 §')).toBeNull()
  })

  it('returns null for bare document number', () => {
    expect(parseCitationLabel('SFS 1977:1160')).toBeNull()
  })
})

describe('extractSourcesFromToolResult', () => {
  it('extracts chunk-level and doc-level entries from search_laws', () => {
    const result = {
      data: [
        {
          documentNumber: 'SFS 1977:1160',
          contextualHeader: 'Arbetsmiljölagen (SFS 1977:1160) > Kap 3 > 2a §',
          snippet: 'Arbetsgivaren ska planera...',
          slug: 'sfs-1977-1160',
          path: 'kap3.§2a',
        },
      ],
      _meta: { tool: 'search_laws', executionTimeMs: 100, resultCount: 1 },
    }

    const sources = extractSourcesFromToolResult('search_laws', result)

    // Chunk-level entry
    const chunk = sources['SFS 1977:1160::kap3.§2a']
    expect(chunk).toBeDefined()
    expect(chunk!.anchorId).toBe('K3P2a')
    expect(chunk!.path).toBe('kap3.§2a')
    expect(chunk!.snippet).toBe('Arbetsgivaren ska planera...')

    // Document-level fallback
    const doc = sources['SFS 1977:1160']
    expect(doc).toBeDefined()
    expect(doc!.anchorId).toBeNull()
  })

  it('extracts filename-keyed entries from search_workspace_files (Story 17.9c)', () => {
    const result = {
      data: [
        {
          fileId: 'file-42',
          filename: 'dataskyddspolicy.pdf',
          category: 'POLICY',
          snippet: 'Kryptering av personuppgifter krävs.',
          relevanceScore: 0.88,
          citationKey: 'dataskyddspolicy.pdf',
        },
      ],
      _meta: {
        tool: 'search_workspace_files',
        executionTimeMs: 50,
        resultCount: 1,
      },
    }

    const sources = extractSourcesFromToolResult(
      'search_workspace_files',
      result
    )

    // Keyed by the filename (= citationKey) so [Källa: dataskyddspolicy.pdf] resolves.
    const src = sources['dataskyddspolicy.pdf']
    expect(src).toBeDefined()
    // Filename carried in documentNumber (keeps the field non-optional — AC 7).
    expect(src!.documentNumber).toBe('dataskyddspolicy.pdf')
    expect(src!.title).toBe('dataskyddspolicy.pdf')
    expect(src!.snippet).toBe('Kryptering av personuppgifter krävs.')
    expect(src!.path).toBeNull()

    // A bare filename label resolves via resolveSource's fallback (no doc-number parse).
    const resolved = resolveSource(
      'dataskyddspolicy.pdf',
      sourcesToMap(sources)
    )
    expect(resolved?.documentNumber).toBe('dataskyddspolicy.pdf')
  })

  // Story 17.9d (AC 1/AC 7a): carry the WorkspaceFile id through so the pill
  // can preview + open the file. Presence of fileId is the file discriminator.
  it('sets fileId on search_workspace_files entries (Story 17.9d)', () => {
    const result = {
      data: [
        {
          fileId: 'file-42',
          filename: 'anställningsavtal.pdf',
          snippet: 'Uppsägningstiden är tre månader.',
          citationKey: 'anställningsavtal.pdf',
        },
      ],
      _meta: { tool: 'search_workspace_files', resultCount: 1 },
    }

    const sources = extractSourcesFromToolResult(
      'search_workspace_files',
      result
    )
    const src = sources['anställningsavtal.pdf']
    expect(src).toBeDefined()
    expect(src!.fileId).toBe('file-42')
    // Snippet still carried (the pill surfaces it as the passage preview).
    expect(src!.snippet).toBe('Uppsägningstiden är tre månader.')
    // No path → not a legal chunk; the pill's file discriminator (fileId) is
    // what unlocks the snippet preview, not isChunkLevel.
    expect(src!.path).toBeNull()
  })

  // Story 17.9d (AC 6/AC 7a guard): legal (search_laws) mappings must NOT gain
  // a fileId — the file discriminator stays exclusive to uploaded files so the
  // pill never misroutes a legal source to the file branch.
  it('leaves legal (search_laws) entries without a fileId (Story 17.9d guard)', () => {
    const result = {
      data: [
        {
          documentNumber: 'SFS 1977:1160',
          snippet: 'Arbetsgivaren ska planera...',
          slug: 'sfs-1977-1160',
          path: 'kap3.§2a',
        },
      ],
      _meta: { tool: 'search_laws', resultCount: 1 },
    }

    const sources = extractSourcesFromToolResult('search_laws', result)
    for (const src of Object.values(sources)) {
      expect(src.fileId ?? null).toBeNull()
    }
  })

  // Story 17.10 (AC 20 + 21): search_workspace_documents — title-keyed citations
  // with collision disambiguation.
  it('extracts title-keyed entries from search_workspace_documents (Story 17.10, AC 20)', () => {
    const result = {
      data: [
        {
          documentId: 'wd-1',
          title: 'Dataskyddspolicy',
          documentType: 'POLICY',
          status: 'APPROVED',
          snippet: 'Kryptering av personuppgifter.',
          relevanceScore: 0.88,
          citationKey: 'Dataskyddspolicy',
        },
        {
          documentId: 'wd-2',
          title: 'Brandskyddsrutin',
          documentType: 'ROUTINE',
          status: 'APPROVED',
          snippet: 'Brandskyddsansvarig utses årligen.',
          relevanceScore: 0.76,
          citationKey: 'Brandskyddsrutin',
        },
      ],
      _meta: { tool: 'search_workspace_documents' },
    }

    const sources = extractSourcesFromToolResult(
      'search_workspace_documents',
      result
    )

    // DEC-2: citationKey = title (clean — no collision in this set).
    const polis = sources['Dataskyddspolicy']
    expect(polis).toBeDefined()
    expect(polis!.documentNumber).toBe('Dataskyddspolicy')
    expect(polis!.title).toBe('Dataskyddspolicy')
    expect(polis!.snippet).toContain('Kryptering')

    const rutin = sources['Brandskyddsrutin']
    expect(rutin).toBeDefined()
    expect(rutin!.documentNumber).toBe('Brandskyddsrutin')

    // [Källa: Dataskyddspolicy] resolves via resolveSource's bare-label fallback.
    const resolved = resolveSource('Dataskyddspolicy', sourcesToMap(sources))
    expect(resolved?.title).toBe('Dataskyddspolicy')

    // CTA enablement: workspaceDocumentId plumbed through so the pill can
    // render an "Öppna styrdokument" navigation link in its hover card.
    expect(polis!.workspaceDocumentId).toBe('wd-1')
    expect(rutin!.workspaceDocumentId).toBe('wd-2')
    expect(resolved?.workspaceDocumentId).toBe('wd-1')
  })

  it('appends a short id suffix on title collisions for disambiguation (Story 17.10, AC 21)', () => {
    const result = {
      data: [
        // Two styrdokument that happen to share the same title — e.g. an old
        // and a re-issued version both surfaced by the search.
        {
          documentId: '0a0a0a0a-1111-2222-3333-444444444444',
          title: 'Dataskyddspolicy',
          snippet: 'Version 1 — pre-2024.',
          relevanceScore: 0.9,
          citationKey: 'Dataskyddspolicy',
        },
        {
          documentId: 'bbbbcccc-1111-2222-3333-444444444444',
          title: 'Dataskyddspolicy',
          snippet: 'Version 2 — uppdaterad efter GDPR-revision.',
          relevanceScore: 0.85,
          citationKey: 'Dataskyddspolicy',
        },
        // A non-colliding doc — must still stay clean (no suffix).
        {
          documentId: '99999999-1111-2222-3333-444444444444',
          title: 'Brandskyddsrutin',
          snippet: 'Branrutiner.',
          relevanceScore: 0.7,
          citationKey: 'Brandskyddsrutin',
        },
      ],
      _meta: { tool: 'search_workspace_documents' },
    }

    const sources = extractSourcesFromToolResult(
      'search_workspace_documents',
      result
    )

    // Colliding entries get a short id-suffix appended; bare title becomes
    // ambiguous and is NOT a source key.
    expect(sources['Dataskyddspolicy']).toBeUndefined()
    expect(sources['Dataskyddspolicy (0a0a0a0a)']).toBeDefined()
    expect(sources['Dataskyddspolicy (bbbbcccc)']).toBeDefined()

    // Non-colliding entry stays clean.
    expect(sources['Brandskyddsrutin']).toBeDefined()
    expect(sources['Brandskyddsrutin (99999999)']).toBeUndefined()

    // documentNumber carries the full disambiguated citationKey.
    expect(sources['Dataskyddspolicy (0a0a0a0a)']!.documentNumber).toBe(
      'Dataskyddspolicy (0a0a0a0a)'
    )
    // Display title stays the human-readable original (no suffix), so the
    // citation pill renders cleanly even when the key is disambiguated.
    expect(sources['Dataskyddspolicy (0a0a0a0a)']!.title).toBe(
      'Dataskyddspolicy'
    )
  })

  it('extracts from get_document_details', () => {
    const result = {
      data: {
        documentNumber: 'SFS 1977:1160',
        title: 'Arbetsmiljölag',
        slug: 'sfs-1977-1160',
        summary: 'Lag om arbetsmiljö',
      },
    }

    const sources = extractSourcesFromToolResult('get_document_details', result)
    expect(sources['SFS 1977:1160']?.title).toBe('Arbetsmiljölag')
  })

  it('extracts section-level entries from get_document_details markdownContent', () => {
    const result = {
      data: {
        documentNumber: 'SFS 1977:1160',
        title: 'Arbetsmiljölag',
        slug: 'sfs-1977-1160',
        summary: 'Lag om arbetsmiljö',
        markdownContent: [
          '## 2 kap. Arbetsmiljöns beskaffenhet',
          '',
          '### 1 §',
          'Arbetet ska planläggas och anordnas så att det kan utföras i en hälsosam miljö.',
          '',
          '### 2 §',
          'Arbetsgivaren ska vidta åtgärder för att förebygga ohälsa.',
          '',
          '## 3 kap. Allmänna skyldigheter',
          '',
          '### 2a §',
          'Arbetsgivaren ska systematiskt planera, leda och kontrollera verksamheten.',
          'Detta inkluderar att utreda arbetsskador.',
        ].join('\n'),
      },
    }

    const sources = extractSourcesFromToolResult('get_document_details', result)

    // Document-level
    expect(sources['SFS 1977:1160']?.title).toBe('Arbetsmiljölag')

    // Section-level from markdown
    const sec1 = sources['SFS 1977:1160::kap2.§1']
    expect(sec1).toBeDefined()
    expect(sec1!.anchorId).toBe('K2P1')
    expect(sec1!.snippet).toContain('planläggas')

    const sec2a = sources['SFS 1977:1160::kap3.§2a']
    expect(sec2a).toBeDefined()
    expect(sec2a!.anchorId).toBe('K3P2a')
    expect(sec2a!.snippet).toContain('systematiskt planera')
    expect(sec2a!.path).toBe('kap3.§2a')
  })

  it('extracts from get_workspace_document with workspaceDocumentId + draft citationKey (smoke fix)', () => {
    const result = {
      data: {
        documentId: 'wd-42',
        title: 'Semesterpolicy',
        content: 'Denna policy reglerar semesterns intjänande och uttag.',
        draft: { versionNumber: 5 },
      },
    }
    const sources = extractSourcesFromToolResult(
      'get_workspace_document',
      result
    )
    // Bare title — drives [Källa: Semesterpolicy].
    expect(sources['Semesterpolicy']).toBeDefined()
    expect(sources['Semesterpolicy']!.workspaceDocumentId).toBe('wd-42')
    expect(sources['Semesterpolicy']!.snippet).toContain('semester')
    // Draft citationKey — drives [Utkast: Semesterpolicy (utkast v5)].
    expect(sources['Semesterpolicy (utkast v5)']).toBeDefined()
    expect(sources['Semesterpolicy (utkast v5)']!.workspaceDocumentId).toBe(
      'wd-42'
    )
  })

  it('extracts from list_workspace_documents with workspaceDocumentId per row (smoke fix)', () => {
    const result = {
      data: [
        {
          documentId: 'wd-1',
          title: 'Brandskyddsrutin',
          currentDraftVersionNumber: null,
        },
        {
          documentId: 'wd-2',
          title: 'Dataskyddspolicy',
          currentDraftVersionNumber: 3,
        },
      ],
    }
    const sources = extractSourcesFromToolResult(
      'list_workspace_documents',
      result
    )
    expect(sources['Brandskyddsrutin']!.workspaceDocumentId).toBe('wd-1')
    expect(sources['Dataskyddspolicy']!.workspaceDocumentId).toBe('wd-2')
    // Draft citationKey only emitted when currentDraftVersionNumber is set.
    expect(sources['Dataskyddspolicy (utkast v3)']!.workspaceDocumentId).toBe(
      'wd-2'
    )
    expect(sources['Brandskyddsrutin (utkast v1)']).toBeUndefined()
  })

  it('extracts from get_change_details', () => {
    const result = {
      data: {
        baseLaw: {
          documentNumber: 'SFS 1977:1160',
          title: 'Arbetsmiljölag',
          slug: 'sfs-1977-1160',
        },
      },
    }

    const sources = extractSourcesFromToolResult('get_change_details', result)
    expect(sources['SFS 1977:1160']?.title).toBe('Arbetsmiljölag')
  })

  it('handles multiple chunks from same document', () => {
    const result = {
      data: [
        {
          documentNumber: 'SFS 1977:1160',
          contextualHeader: 'AML > Kap 3 > 2a §',
          snippet: 'Chunk A',
          slug: 'sfs-1977-1160',
          path: 'kap3.§2a',
        },
        {
          documentNumber: 'SFS 1977:1160',
          contextualHeader: 'AML > Kap 3 > 3 §',
          snippet: 'Chunk B',
          slug: 'sfs-1977-1160',
          path: 'kap3.§3',
        },
      ],
    }

    const sources = extractSourcesFromToolResult('search_laws', result)
    expect(sources['SFS 1977:1160::kap3.§2a']?.snippet).toBe('Chunk A')
    expect(sources['SFS 1977:1160::kap3.§3']?.snippet).toBe('Chunk B')
    expect(sources['SFS 1977:1160']).toBeDefined()
  })

  it('registers entries by citationKey from search_laws results', () => {
    const result = {
      data: [
        {
          documentNumber: 'SFS 1977:1160',
          contextualHeader: 'AML > Kap 3 > 2a §',
          snippet: 'Arbetsgivaren ska planera...',
          slug: 'sfs-1977-1160',
          path: 'kap3.§2a',
          citationKey: 'SFS 1977:1160, Kap 3, 2a §',
        },
        {
          documentNumber: 'SFS 1982:80',
          contextualHeader: 'LAS > 7 §',
          snippet: 'Uppsägning...',
          slug: 'sfs-1982-80',
          path: 'kap0.§7',
          citationKey: 'SFS 1982:80, 7 §',
        },
      ],
      _meta: { tool: 'search_laws', executionTimeMs: 100, resultCount: 2 },
    }

    const sources = extractSourcesFromToolResult('search_laws', result)

    // citationKey-based entries
    const byKey1 = sources['SFS 1977:1160, Kap 3, 2a §']
    expect(byKey1).toBeDefined()
    expect(byKey1!.snippet).toBe('Arbetsgivaren ska planera...')
    expect(byKey1!.anchorId).toBe('K3P2a')

    const byKey2 = sources['SFS 1982:80, 7 §']
    expect(byKey2).toBeDefined()
    expect(byKey2!.snippet).toBe('Uppsägning...')

    // Path-based and doc-level entries still exist
    expect(sources['SFS 1977:1160::kap3.§2a']).toBeDefined()
    expect(sources['SFS 1977:1160']).toBeDefined()
  })

  it('registers citationKey entries from get_document_details citationKeys array', () => {
    const result = {
      data: {
        documentNumber: 'SFS 1977:1160',
        title: 'Arbetsmiljölag',
        slug: 'sfs-1977-1160',
        summary: 'Lag om arbetsmiljö',
        markdownContent: [
          '## 3 kap. Allmänna skyldigheter',
          '',
          '### 2a §',
          'Arbetsgivaren ska systematiskt planera.',
        ].join('\n'),
        citationKeys: [
          'SFS 1977:1160, Kap 3, 2a §',
          'SFS 1977:1160, Kap 3, 3 §',
        ],
      },
    }

    const sources = extractSourcesFromToolResult('get_document_details', result)

    // citationKey entry that matches a markdown-extracted section gets its snippet
    const key2a = sources['SFS 1977:1160, Kap 3, 2a §']
    expect(key2a).toBeDefined()
    expect(key2a!.snippet).toContain('systematiskt planera')
    expect(key2a!.anchorId).toBe('K3P2a')

    // citationKey entry without a markdown-extracted section still gets registered
    const key3 = sources['SFS 1977:1160, Kap 3, 3 §']
    expect(key3).toBeDefined()
    expect(key3!.path).toBe('kap3.§3')
    expect(key3!.anchorId).toBe('K3P3')
  })

  it('handles search_laws results without citationKey gracefully', () => {
    const result = {
      data: [
        {
          documentNumber: 'SFS 1977:1160',
          contextualHeader: 'AML > Övergångsbestämmelser',
          snippet: 'Text...',
          slug: 'sfs-1977-1160',
          path: 'overgangsbest',
          // No citationKey
        },
      ],
    }

    const sources = extractSourcesFromToolResult('search_laws', result)
    // Should still have doc-level fallback
    expect(sources['SFS 1977:1160']).toBeDefined()
    // No citationKey entry
    expect(Object.keys(sources)).not.toContain('SFS 1977:1160, Kap')
  })

  it('returns empty for unknown tool', () => {
    const sources = extractSourcesFromToolResult('unknown', { data: {} })
    expect(Object.keys(sources)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Story 17.10b AC 9 / AC 10 / AC 11: status-aware citation labels.
// The citationKey itself stays the bare title (display title stays clean per
// AC 10); the agent picks the bracket form ([Källa:] vs [Utkast:]) based on
// the `status` field returned by the tool. These tests verify the sourceMap
// shape isn't affected by the status split (no status-specific keys).
// ---------------------------------------------------------------------------

describe('extractSourcesFromToolResult — search_workspace_documents status awareness (17.10b)', () => {
  it('AC 10: citationKey stays the bare title regardless of status (Källa)', () => {
    const sources = extractSourcesFromToolResult('search_workspace_documents', {
      data: [
        {
          documentId: 'doc-1',
          title: 'Diskrimineringspolicy',
          status: 'APPROVED',
          snippet: 'snippet',
          citationKey: 'Diskrimineringspolicy',
        },
      ],
    })

    expect(sources['Diskrimineringspolicy']).toBeDefined()
    expect(sources['Diskrimineringspolicy']!.documentNumber).toBe(
      'Diskrimineringspolicy'
    )
    // Crucially: no bracketed/prefixed key. The display title is clean.
    expect(sources['[Källa: Diskrimineringspolicy]']).toBeUndefined()
  })

  it('AC 10: citationKey stays the bare title for DRAFT/IN_REVIEW too (Utkast)', () => {
    const sources = extractSourcesFromToolResult('search_workspace_documents', {
      data: [
        {
          documentId: 'doc-1',
          title: 'Semesterpolicy',
          status: 'DRAFT',
          snippet: 'snippet',
          citationKey: 'Semesterpolicy',
        },
      ],
    })

    expect(sources['Semesterpolicy']).toBeDefined()
    expect(sources['[Utkast: Semesterpolicy]']).toBeUndefined()
    expect(sources['Utkast: Semesterpolicy']).toBeUndefined()
  })

  it('AC 9 + CITE-002: collision suffix still applies across mixed APPROVED + DRAFT pair', () => {
    const sources = extractSourcesFromToolResult('search_workspace_documents', {
      data: [
        {
          documentId: 'abcd1234-aaaa-bbbb-cccc-000000000001',
          title: 'Diskrimineringspolicy',
          status: 'APPROVED',
          snippet: 'hr variant',
          citationKey: 'Diskrimineringspolicy',
        },
        {
          documentId: 'efgh5678-aaaa-bbbb-cccc-000000000002',
          title: 'Diskrimineringspolicy',
          status: 'DRAFT',
          snippet: 'guest variant draft',
          citationKey: 'Diskrimineringspolicy',
        },
      ],
    })

    // Both keys get an id-suffix because the bare title collides — regardless
    // of status tier. Status is not part of the collision key.
    expect(sources['Diskrimineringspolicy (abcd1234)']).toBeDefined()
    expect(sources['Diskrimineringspolicy (efgh5678)']).toBeDefined()
    expect(sources['Diskrimineringspolicy']).toBeUndefined()
  })

  it('AC 11: handles missing status on legacy chunks gracefully (no crash, no extra key)', () => {
    // The tool layer (search-workspace-documents.ts) defaults missing status
    // to 'APPROVED' before reaching this extractor — but the extractor itself
    // doesn't read status. This test pins that contract: the source map shape
    // is unaffected by whether status is APPROVED, DRAFT, or absent.
    const sources = extractSourcesFromToolResult('search_workspace_documents', {
      data: [
        {
          documentId: 'doc-legacy',
          title: 'Legacy Policy',
          // status DELIBERATELY OMITTED — legacy 17.9b chunk path
          snippet: 'snippet',
          citationKey: 'Legacy Policy',
        },
      ],
    })
    expect(sources['Legacy Policy']).toBeDefined()
  })
})

describe('resolveSource — Utkast: prefix stripping (17.10b AC 9/10)', () => {
  it('strips the "Utkast: " prefix before sourceMap lookup', () => {
    const map = new Map<string, SourceInfo>([
      [
        'Diskrimineringspolicy',
        {
          documentNumber: 'Diskrimineringspolicy',
          title: 'Diskrimineringspolicy',
          snippet: 'draft policy',
          slug: null,
          path: null,
          anchorId: null,
        },
      ],
    ])

    // The chip carries "Utkast: Diskrimineringspolicy" as its visible text
    // (DEC-3) — the resolver must strip the prefix to hit the title-keyed map.
    const resolved = resolveSource('Utkast: Diskrimineringspolicy', map)
    expect(resolved?.documentNumber).toBe('Diskrimineringspolicy')
  })

  it('does NOT strip "Källa: " (canonical pills never carry the prefix in chip text)', () => {
    const map = new Map<string, SourceInfo>([
      [
        'Diskrimineringspolicy',
        {
          documentNumber: 'Diskrimineringspolicy',
          title: 'Diskrimineringspolicy',
          snippet: 'approved policy',
          slug: null,
          path: null,
          anchorId: null,
        },
      ],
    ])

    // A literal "Källa: X" label would fail lookup if it ever appeared (it
    // doesn't — Källa pills render bare-label). This pins the asymmetry.
    expect(resolveSource('Källa: Diskrimineringspolicy', map)).toBeNull()
    // The bare title still resolves.
    expect(resolveSource('Diskrimineringspolicy', map)?.documentNumber).toBe(
      'Diskrimineringspolicy'
    )
  })
})

describe('resolveSource', () => {
  function buildMap(): Map<string, SourceInfo> {
    return new Map([
      [
        'SFS 1977:1160::kap3.§2a',
        {
          documentNumber: 'SFS 1977:1160',
          title: 'Arbetsmiljölagen',
          snippet: 'Chunk text about 2a §',
          slug: 'sfs-1977-1160',
          path: 'kap3.§2a',
          anchorId: 'K3P2a',
        },
      ],
      [
        'SFS 1977:1160',
        {
          documentNumber: 'SFS 1977:1160',
          title: 'Arbetsmiljölag',
          snippet: 'Document summary',
          slug: 'sfs-1977-1160',
          path: null,
          anchorId: null,
        },
      ],
    ])
  }

  it('resolves chunk by "Kap N, M §" format', () => {
    const source = resolveSource('SFS 1977:1160, Kap 3, 2a §', buildMap())
    expect(source?.snippet).toBe('Chunk text about 2a §')
    expect(source?.anchorId).toBe('K3P2a')
  })

  it('resolves chunk by "N kap M §" format', () => {
    const source = resolveSource('SFS 1977:1160, 3 kap 2a §', buildMap())
    expect(source?.snippet).toBe('Chunk text about 2a §')
  })

  it('falls back to document-level for unmatched section with computed anchor', () => {
    const source = resolveSource('SFS 1977:1160, Kap 5, 1 §', buildMap())
    expect(source?.snippet).toBe('Document summary')
    expect(source?.anchorId).toBe('K5P1')
  })

  it('falls back for ranges', () => {
    const source = resolveSource('SFS 1977:1160, Kap 1, 2-3 §', buildMap())
    expect(source?.snippet).toBe('Document summary')
  })

  it('resolves bare document number', () => {
    const source = resolveSource('SFS 1977:1160', buildMap())
    expect(source?.snippet).toBe('Document summary')
  })

  it('resolves via citationKey entry in source map', () => {
    const map = new Map<string, SourceInfo>([
      ...buildMap(),
      [
        'SFS 1977:1160, Kap 3, 2a §',
        {
          documentNumber: 'SFS 1977:1160',
          title: 'Arbetsmiljölagen',
          snippet: 'Chunk text about 2a §',
          slug: 'sfs-1977-1160',
          path: 'kap3.§2a',
          anchorId: 'K3P2a',
        },
      ],
    ])

    // resolveSource parses the label to a path, finds the path-based entry,
    // but the citationKey entry should also be available for direct lookup
    const source = resolveSource('SFS 1977:1160, Kap 3, 2a §', map)
    expect(source).toBeDefined()
    expect(source?.snippet).toBe('Chunk text about 2a §')
    expect(source?.anchorId).toBe('K3P2a')
  })

  it('returns null for unknown document', () => {
    expect(resolveSource('SFS 9999:999', buildMap())).toBeNull()
  })

  // Story 14.21: Web source resolution tests
  describe('web sources', () => {
    function buildMapWithWebSource(): Map<string, SourceInfo> {
      return new Map([
        ...buildMap(),
        [
          'web:https://arbetsdomstolen.se/sv/prejudikat/ad-2024-nr-12/',
          {
            documentNumber: 'arbetsdomstolen.se',
            title: 'AD 2024 nr 12',
            snippet: null,
            slug: null,
            path: null,
            anchorId: null,
            url: 'https://arbetsdomstolen.se/sv/prejudikat/ad-2024-nr-12/',
          },
        ],
      ])
    }

    it('matches web source by title prefix', () => {
      const source = resolveSource(
        'AD 2024 nr 12 - Arbetsdomstolen',
        buildMapWithWebSource()
      )
      expect(source).not.toBeNull()
      expect(source?.url).toBe(
        'https://arbetsdomstolen.se/sv/prejudikat/ad-2024-nr-12/'
      )
      expect(source?.documentNumber).toBe('arbetsdomstolen.se')
    })

    it('matches web source by direct web: key lookup', () => {
      const source = resolveSource(
        'https://arbetsdomstolen.se/sv/prejudikat/ad-2024-nr-12/',
        buildMapWithWebSource()
      )
      expect(source).not.toBeNull()
      expect(source?.url).toBe(
        'https://arbetsdomstolen.se/sv/prejudikat/ad-2024-nr-12/'
      )
    })

    it('returns null when label does not match any web source', () => {
      const source = resolveSource(
        'Completely unrelated text',
        buildMapWithWebSource()
      )
      expect(source).toBeNull()
    })

    it('still resolves DB sources when web sources are in the map', () => {
      const source = resolveSource(
        'SFS 1977:1160, Kap 3, 2a §',
        buildMapWithWebSource()
      )
      expect(source?.snippet).toBe('Chunk text about 2a §')
      expect(source?.url).toBeUndefined()
    })
  })
})

describe('sourcesToMap', () => {
  it('converts record to Map', () => {
    const record = {
      'SFS 1977:1160': {
        documentNumber: 'SFS 1977:1160',
        title: 'Test',
        snippet: null,
        slug: null,
        path: null,
        anchorId: null,
      },
    }
    const map = sourcesToMap(record)
    expect(map.size).toBe(1)
    expect(map.get('SFS 1977:1160')?.title).toBe('Test')
  })

  it('returns empty map for undefined', () => {
    expect(sourcesToMap(undefined).size).toBe(0)
  })
})

describe('getDocBrowsePath [Story 9.7]', () => {
  it('routes agency författningssamlingar to /browse/foreskrifter', () => {
    // SKOLFS (joint samling) was the production bug — mis-routed to /browse/lagar
    expect(getDocBrowsePath('SKOLFS 2010:37')).toBe('/browse/foreskrifter')
    expect(getDocBrowsePath('AFS 2023:1')).toBe('/browse/foreskrifter')
    expect(getDocBrowsePath('SOSFS 2011:9')).toBe('/browse/foreskrifter')
    expect(getDocBrowsePath('HSLF-FS 2022:30')).toBe('/browse/foreskrifter')
    // previously-missing map prefixes (latent bug)
    expect(getDocBrowsePath('LMFS 2020:1')).toBe('/browse/foreskrifter')
    expect(getDocBrowsePath('SSMFS 2018:1')).toBe('/browse/foreskrifter')
    // supplementary prefixes not in the canonical map
    expect(getDocBrowsePath('LVFS 2009:20')).toBe('/browse/foreskrifter')
  })

  it('routes SFS to /browse/lagar and EU to /browse/eu', () => {
    expect(getDocBrowsePath('SFS 1977:1160')).toBe('/browse/lagar')
    expect(getDocBrowsePath('EU 2016/679')).toBe('/browse/eu')
  })
})
