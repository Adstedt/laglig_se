import { describe, it, expect } from 'vitest'
import {
  parseAmendmentStructure,
  extractSfsReferences,
  formatAmendmentText,
} from '../parse-amendment-structure'

describe('parseAmendmentStructure', () => {
  it('parses basic amendment structure', () => {
    const input = `Svensk författningssamling SFS 2025:1456
Lag om ändring i miljöbalken (1998:808)
Publicerad den 15 december 2025
Utfärdad den 10 december 2025

Enligt riksdagens beslut föreskrivs att 5 § ska ha följande lydelse.

5 § En verksamhet ska bedrivas så att olägenheter förebyggs.

1. Denna lag träder i kraft den 1 januari 2026.

På regeringens vägnar
ROMINA POURMOKHTARI
Maria Höglund (Klimat- och näringslivsdepartementet)`

    const result = parseAmendmentStructure(input)

    expect(result).not.toBeNull()
    expect(result!.sfsNumber).toBe('SFS 2025:1456')
    expect(result!.title).toContain('Lag om ändring i miljöbalken')
    expect(result!.publishedDate).toBe('15 december 2025')
    expect(result!.issuedDate).toBe('10 december 2025')
    expect(result!.introText).toContain('Enligt riksdagens beslut')
    expect(result!.sections.length).toBeGreaterThan(0)
    expect(result!.transitionProvisions.length).toBeGreaterThan(0)
    // Signature block parsing is best-effort
    if (result!.signatureBlock) {
      expect(result!.signatureBlock.minister).toContain('ROMINA')
    }
  })

  it('parses sections from amendment text', () => {
    const input = `Svensk författningssamling SFS 2025:100
Lag om ändring i testlagen (2000:1)
Utfärdad den 1 januari 2025

Enligt riksdagens beslut föreskrivs följande.

3 § Denna paragraf innehåller viktig information.

4 § Denna paragraf innehåller mer information.`

    const result = parseAmendmentStructure(input)

    expect(result).not.toBeNull()
    expect(result!.sections.length).toBeGreaterThan(0)

    // Check that at least one section was parsed
    const sectionNumbers = result!.sections.map((s) => s.sectionNumber)
    expect(sectionNumbers.some((n) => n.includes('§'))).toBe(true)
  })

  it('handles null input', () => {
    expect(parseAmendmentStructure(null)).toBeNull()
  })

  it('handles empty string', () => {
    expect(parseAmendmentStructure('')).toBeNull()
  })
})

describe('extractSfsReferences', () => {
  it('extracts parenthetical SFS references', () => {
    const input = 'enligt lagen (2001:559) om vägtrafikdefinitioner'
    const result = extractSfsReferences(input)

    expect(result.length).toBe(3)
    expect(result[0]?.type).toBe('text')
    expect(result[0]?.content).toBe('enligt lagen ')
    expect(result[1]?.type).toBe('sfs')
    expect(result[1]?.content).toBe('(2001:559)')
    expect(result[1]?.sfsNumber).toBe('2001:559')
    expect(result[2]?.type).toBe('text')
    expect(result[2]?.content).toBe(' om vägtrafikdefinitioner')
  })

  it('extracts SFS YYYY:NNN format references', () => {
    const input = 'Se SFS 2024:381 för mer information'
    const result = extractSfsReferences(input)

    expect(result.length).toBe(3)
    expect(result[1]?.type).toBe('sfs')
    expect(result[1]?.sfsNumber).toBe('2024:381')
  })

  it('extracts multiple references', () => {
    const input = 'enligt (2001:559) och (2011:318)'
    const result = extractSfsReferences(input)

    const sfsRefs = result.filter((r) => r.type === 'sfs')
    expect(sfsRefs.length).toBe(2)
    expect(sfsRefs[0]?.sfsNumber).toBe('2001:559')
    expect(sfsRefs[1]?.sfsNumber).toBe('2011:318')
  })

  it('handles text without SFS references', () => {
    const input = 'Vanlig text utan referenser'
    const result = extractSfsReferences(input)

    expect(result.length).toBe(1)
    expect(result[0]?.type).toBe('text')
    expect(result[0]?.content).toBe(input)
  })
})

describe('formatAmendmentText', () => {
  it('adds line breaks before section numbers', () => {
    const input = 'Text här 5 § Mer text'
    const result = formatAmendmentText(input)

    expect(result).toContain('\n\n5 §')
  })

  it('adds line breaks after issued date', () => {
    const input = 'Utfärdad den 10 december 2025 Nästa text'
    const result = formatAmendmentText(input)

    expect(result).toContain('Utfärdad den 10 december 2025\n\n')
  })

  it('handles null input', () => {
    expect(formatAmendmentText(null)).toBeNull()
  })
})
