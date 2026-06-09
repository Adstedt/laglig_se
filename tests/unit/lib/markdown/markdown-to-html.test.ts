/**
 * Story 14.22: tests for markdownToHtml — bridges agent markdown → the task
 * description's HTML rich-text field.
 */

import { describe, it, expect } from 'vitest'
import { markdownToHtml } from '@/lib/markdown/markdown-to-html'

describe('markdownToHtml', () => {
  it('returns empty string for empty / whitespace input', () => {
    expect(markdownToHtml('')).toBe('')
    expect(markdownToHtml('   \n  ')).toBe('')
  })

  it('converts **bold** to <strong>', () => {
    expect(markdownToHtml('**Anmälningsskyldighet**')).toContain(
      '<strong>Anmälningsskyldighet</strong>'
    )
  })

  it('converts an ordered list to <ol><li>', () => {
    const html = markdownToHtml('1. Första punkten\n2. Andra punkten')
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>Första punkten</li>')
    expect(html).toContain('<li>Andra punkten</li>')
  })

  it('separates blank-line-delimited paragraphs into <p> blocks', () => {
    const html = markdownToHtml('Stycke ett.\n\nStycke två.')
    expect(html).toMatch(/<p>Stycke ett\.<\/p>/)
    expect(html).toMatch(/<p>Stycke två\.<\/p>/)
  })

  it('handles a realistic multi-section agent description', () => {
    const md = [
      'Gå igenom och säkerställ att följande krav uppfylls:',
      '',
      '1. **Anmälningsskyldighet** — Kontrollera rutiner (2 §).',
      '2. **Dokumentationsförvaring** — Spara i minst 5 år (3 §).',
    ].join('\n')
    const html = markdownToHtml(md)
    expect(html).toContain('<ol>')
    expect(html).toContain('<strong>Anmälningsskyldighet</strong>')
    expect(html).toContain('<strong>Dokumentationsförvaring</strong>')
    // the intro is its own paragraph, not run together with the list
    expect(html).toMatch(/<p>Gå igenom[^<]*<\/p>/)
  })
})
