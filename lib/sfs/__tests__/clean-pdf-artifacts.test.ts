import { describe, it, expect } from 'vitest'
import {
  cleanPdfArtifacts,
  cleanMarkdownContent,
  extractCleanSummary,
} from '../clean-pdf-artifacts'

describe('cleanPdfArtifacts', () => {
  it('removes Wolters Kluwer publisher name', () => {
    const input = 'SFS 2017:1309\nWolters Kluwer\nLag om ändring'
    const result = cleanPdfArtifacts(input)
    expect(result).not.toContain('Wolters Kluwer')
    expect(result).toContain('Lag om ändring')
  })

  it('removes Elanders Sverige AB with year', () => {
    const input = 'Elanders Sverige AB, 2017\nParagraf 1'
    const result = cleanPdfArtifacts(input)
    expect(result).not.toContain('Elanders')
    expect(result).not.toContain('2017')
    expect(result).toContain('Paragraf 1')
  })

  it('removes standalone SFS numbers (headers)', () => {
    const input = 'SFS 2017:1309\n\nLag om ändring i marknadsföringslagen'
    const result = cleanPdfArtifacts(input)
    // The SFS number alone on a line should be removed
    expect(
      result?.split('\n').filter((l) => l.trim() === 'SFS 2017:1309')
    ).toHaveLength(0)
  })

  it('removes page numbers', () => {
    const input = 'Text on page\n123\nMore text'
    const result = cleanPdfArtifacts(input)
    expect(result).not.toMatch(/^\d+$/m)
    expect(result).toContain('Text on page')
    expect(result).toContain('More text')
  })

  it('normalizes excessive newlines', () => {
    const input = 'Paragraph 1\n\n\n\n\n\nParagraph 2'
    const result = cleanPdfArtifacts(input)
    expect(result).toBe('Paragraph 1\n\nParagraph 2')
  })

  it('replaces non-breaking spaces', () => {
    const input = 'Text\u00a0with\u00a0nbsp'
    const result = cleanPdfArtifacts(input)
    expect(result).toBe('Text with nbsp')
  })

  it('handles null input', () => {
    expect(cleanPdfArtifacts(null)).toBeNull()
  })

  it('handles empty string', () => {
    expect(cleanPdfArtifacts('')).toBe('')
  })

  it('preserves meaningful content', () => {
    const input = `1 § Denna lag innehåller bestämmelser om marknadsföring.

2 § Lagen gäller inte för privat bruk.`
    const result = cleanPdfArtifacts(input)
    expect(result).toContain('1 §')
    expect(result).toContain('2 §')
    expect(result).toContain('marknadsföring')
  })
})

describe('cleanMarkdownContent', () => {
  it('cleans artifacts and fixes broken markdown', () => {
    const input = 'Wolters Kluwer\n\n# Rubrik\n\nText ] (broken link)'
    const result = cleanMarkdownContent(input)
    expect(result).not.toContain('Wolters Kluwer')
    expect(result).toContain('# Rubrik')
  })

  it('handles null input', () => {
    expect(cleanMarkdownContent(null)).toBeNull()
  })
})

describe('extractCleanSummary', () => {
  it('extracts first meaningful paragraph', () => {
    const input = `# Rubrik

Wolters Kluwer

Denna lag innehåller bestämmelser om hur marknadsföring ska utformas för att skydda konsumenter och näringsidkare.

Mer text här.`
    const result = extractCleanSummary(input)
    expect(result).toContain('marknadsföring')
    expect(result).not.toContain('Wolters Kluwer')
    expect(result).not.toContain('# Rubrik')
  })

  it('truncates at sentence boundary', () => {
    const input =
      'Detta är en lång mening som innehåller många ord. Detta är en annan mening. Och en till.'
    const result = extractCleanSummary(input, 60)
    expect(result?.endsWith('.')).toBe(true)
    expect(result!.length).toBeLessThanOrEqual(70) // Some margin for finding break point
  })

  it('handles null input', () => {
    expect(extractCleanSummary(null)).toBeNull()
  })
})
