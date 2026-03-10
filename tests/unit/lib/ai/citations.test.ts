import { describe, it, expect } from 'vitest'
import {
  hasCitationMarkers,
  extractSourcesFromToolResult,
  resolveSource,
  sourcesToMap,
  anchorIdFromPath,
  chunkCitationKey,
  parseCitationLabel,
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

  it('returns empty for unknown tool', () => {
    const sources = extractSourcesFromToolResult('unknown', { data: {} })
    expect(Object.keys(sources)).toHaveLength(0)
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

  it('returns null for unknown document', () => {
    expect(resolveSource('SFS 9999:999', buildMap())).toBeNull()
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
