import { describe, it, expect } from 'vitest'
import {
  formatTransparencyBlock,
  formatSourceCitation,
} from '@/lib/agent/transparency'
import type {
  TransparencySource,
  CitationSource,
} from '@/lib/agent/transparency'

// ---------------------------------------------------------------------------
// formatTransparencyBlock
// ---------------------------------------------------------------------------

describe('formatTransparencyBlock', () => {
  it('formats mixed source types correctly', () => {
    const sources: TransparencySource[] = [
      {
        documentTitle: 'Arbetsmiljölagen',
        documentNumber: 'SFS 1977:1160',
        sourceType: 'LEGAL_DOCUMENT',
        relevanceScore: 0.9,
      },
      {
        documentTitle: 'AFS 2023:1',
        documentNumber: 'AFS 2023:1',
        sourceType: 'LEGAL_DOCUMENT',
        relevanceScore: 0.85,
      },
      {
        documentTitle: 'arbetsmiljöpolicy.pdf',
        sourceType: 'USER_FILE',
      },
      {
        documentTitle: 'Diskrimineringslagen',
        documentNumber: 'SFS 2008:567',
        sourceType: 'CHANGE_EVENT',
      },
    ]

    const result = formatTransparencyBlock(sources)

    expect(result).toContain('Sökte i:')
    expect(result).toContain('Arbetsmiljölagen (SFS 1977:1160)')
    expect(result).toContain('AFS 2023:1 (AFS 2023:1)')
    expect(result).toContain('arbetsmiljöpolicy.pdf')
    expect(result).toContain('Ändring i Diskrimineringslagen')
    expect(result).toContain('Hittade 4 relevanta avsnitt')
  })

  it('deduplicates sources with the same document title', () => {
    const sources: TransparencySource[] = [
      {
        documentTitle: 'Arbetsmiljölagen',
        documentNumber: 'SFS 1977:1160',
        sourceType: 'LEGAL_DOCUMENT',
      },
      {
        documentTitle: 'Arbetsmiljölagen',
        documentNumber: 'SFS 1977:1160',
        sourceType: 'LEGAL_DOCUMENT',
      },
      {
        documentTitle: 'Arbetsmiljölagen',
        documentNumber: 'SFS 1977:1160',
        sourceType: 'LEGAL_DOCUMENT',
      },
    ]

    const result = formatTransparencyBlock(sources)

    // Should only mention the document once in the list
    const matches = result.match(/Arbetsmiljölagen/g)
    expect(matches).toHaveLength(1)
    // But count all chunks
    expect(result).toContain('Hittade 3 relevanta avsnitt')
  })

  it('returns appropriate message for empty array', () => {
    const result = formatTransparencyBlock([])
    expect(result).toBe('Inga dokument genomsöktes.')
  })
})

// ---------------------------------------------------------------------------
// formatSourceCitation
// ---------------------------------------------------------------------------

describe('formatSourceCitation', () => {
  it('formats LEGAL_DOCUMENT with full contextualHeader', () => {
    const source: CitationSource = {
      documentNumber: 'SFS 1977:1160',
      contextualHeader: 'Arbetsmiljölagen 2 kap. 3 §',
      sourceType: 'LEGAL_DOCUMENT',
    }

    const result = formatSourceCitation(source)
    expect(result).toBe('[Källa: SFS 1977:1160, Kap 2, 3 §]')
  })

  it('formats LEGAL_DOCUMENT with only document number (no location)', () => {
    const source: CitationSource = {
      documentNumber: 'SFS 2018:218',
      contextualHeader: null,
      sourceType: 'LEGAL_DOCUMENT',
    }

    const result = formatSourceCitation(source)
    expect(result).toBe('[Källa: SFS 2018:218]')
  })

  it('formats USER_FILE with path', () => {
    const source: CitationSource = {
      sourceType: 'USER_FILE',
      path: 'uploads/arbetsmiljöpolicy.pdf',
    }

    const result = formatSourceCitation(source)
    expect(result).toBe('[Källa: arbetsmiljöpolicy.pdf]')
  })

  it('formats CHANGE_EVENT with document number', () => {
    const source: CitationSource = {
      documentNumber: 'SFS 2024:123',
      sourceType: 'CHANGE_EVENT',
    }

    const result = formatSourceCitation(source)
    expect(result).toBe('[Källa: Ändring SFS 2024:123]')
  })

  it('handles missing fields gracefully for LEGAL_DOCUMENT', () => {
    const source: CitationSource = {
      documentNumber: null,
      contextualHeader: null,
      sourceType: 'LEGAL_DOCUMENT',
    }

    const result = formatSourceCitation(source)
    expect(result).toBe('[Källa: okänt dokument]')
  })

  it('handles missing path for USER_FILE', () => {
    const source: CitationSource = {
      sourceType: 'USER_FILE',
      path: null,
    }

    const result = formatSourceCitation(source)
    expect(result).toBe('[Källa: okänd fil]')
  })

  it('handles missing document number for CHANGE_EVENT', () => {
    const source: CitationSource = {
      documentNumber: null,
      sourceType: 'CHANGE_EVENT',
    }

    const result = formatSourceCitation(source)
    expect(result).toBe('[Källa: Ändring]')
  })
})
