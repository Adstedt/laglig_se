import { describe, expect, it } from 'vitest'
import {
  buildSeoDescription,
  cleanText,
  documentSeoTitle,
  lawTextExcerpt,
  truncateAtWord,
} from '../meta'

const RIKSDAGEN_FULL_TEXT = `Arbetsmiljölag (1977:1160)

SFS nr: \r
1977:1160

Departement/myndighet: \r
Arbetsmarknadsdepartementet ARM

Utfärdad: \r
1977-12-19

1 kap. Lagens ändamål och tillämpningsområde

1 § Lagens ändamål är att förebygga ohälsa och olycksfall i arbetet samt att även i övrigt uppnå en god arbetsmiljö.

2 § Denna lag gäller varje verksamhet i vilken arbetstagare utför arbete för en arbetsgivares räkning.`

describe('truncateAtWord', () => {
  it('returns short text unchanged', () => {
    expect(truncateAtWord('Kort text.')).toBe('Kort text.')
  })

  it('collapses whitespace and newlines', () => {
    expect(truncateAtWord('rad ett\n\nrad  två\r\n')).toBe('rad ett rad två')
  })

  it('truncates at a word boundary with ellipsis, never mid-word', () => {
    const text = 'ord '.repeat(100)
    const result = truncateAtWord(text, 50)
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result.endsWith('ord…')).toBe(true)
  })

  it('strips trailing punctuation before the ellipsis', () => {
    const result = truncateAtWord(
      'En mening som slutar, här och fortsätter länge till',
      25
    )
    expect(result).not.toMatch(/[,;:\-–]…$/)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('documentSeoTitle', () => {
  it('does not append the number when the title already contains it', () => {
    expect(
      documentSeoTitle('Arbetsmiljölag (1977:1160)', 'SFS 1977:1160')
    ).toBe('Arbetsmiljölag (1977:1160)')
  })

  it('appends the document number when missing from the title', () => {
    expect(documentSeoTitle('Lag om anställningsskydd', 'SFS 1982:80')).toBe(
      'Lag om anställningsskydd (SFS 1982:80)'
    )
  })

  it('handles a missing document number', () => {
    expect(documentSeoTitle('Någon titel', null)).toBe('Någon titel')
  })
})

describe('lawTextExcerpt', () => {
  it('skips the Riksdagen metadata header and starts at the law text', () => {
    const excerpt = lawTextExcerpt(RIKSDAGEN_FULL_TEXT)
    expect(excerpt).not.toBeNull()
    expect(excerpt).not.toContain('SFS nr')
    expect(excerpt).not.toContain('Departement')
    expect(excerpt).toContain('Lagens ändamål')
  })

  it('strips a leading "1 §" marker', () => {
    const excerpt = lawTextExcerpt(
      'Rubrik\n\nSFS nr:\n2000:1\n\n1 § Denna lag gäller alla arbetsgivare i Sverige och reglerar deras skyldigheter.'
    )
    expect(excerpt).toMatch(/^Denna lag gäller/)
  })

  it('returns null when no section marker exists', () => {
    expect(lawTextExcerpt('Bara en rubrik utan paragrafer')).toBeNull()
  })
})

describe('buildSeoDescription', () => {
  const fallback = 'Läs lagen i fulltext på Laglig.se.'

  it('prefers the summary', () => {
    const summary =
      'Arbetsmiljölagen reglerar arbetsgivarens ansvar för arbetsmiljön och gäller alla verksamheter med anställda.'
    expect(
      buildSeoDescription({ summary, fullText: RIKSDAGEN_FULL_TEXT, fallback })
    ).toBe(summary)
  })

  it('falls back to applicability hint, then law text excerpt', () => {
    const hint =
      'Gäller alla arbetsgivare. Reglerar systematiskt arbetsmiljöarbete och skyddsombud.'
    expect(buildSeoDescription({ applicabilityHint: hint, fallback })).toBe(
      hint
    )

    const fromText = buildSeoDescription({
      fullText: RIKSDAGEN_FULL_TEXT,
      fallback,
    })
    expect(fromText).toContain('Lagens ändamål')
    expect(fromText).not.toContain('SFS nr')
  })

  it('skips too-short candidates and uses the fallback', () => {
    expect(buildSeoDescription({ summary: 'Kort.', fallback })).toBe(fallback)
  })

  it('caps the description length', () => {
    const result = buildSeoDescription({
      summary: 'långt innehåll '.repeat(50),
      fallback,
    })
    expect(result.length).toBeLessThanOrEqual(158)
  })
})

describe('cleanText', () => {
  it('normalizes carriage returns and repeated spaces', () => {
    expect(cleanText('a\r\n b   c')).toBe('a b c')
  })
})
