/**
 * Tests for Section Parser
 * Story 2.13 QA Fix: TEST-001
 */

import { describe, it, expect } from 'vitest'
import {
  parseLawSections,
  normalizeSectionRef,
  formatSectionRef,
  createSectionKey,
} from '../../legal-document/section-parser'

describe('parseLawSections', () => {
  describe('empty/invalid input', () => {
    it('should return error for empty string', () => {
      const result = parseLawSections('')
      expect(result.sections).toHaveLength(0)
      expect(result.errors).toContain('Empty HTML content')
    })

    it('should return error for whitespace-only string', () => {
      const result = parseLawSections('   \n\t  ')
      expect(result.sections).toHaveLength(0)
      expect(result.errors).toContain('Empty HTML content')
    })

    it('should return error when no section anchors found', () => {
      const result = parseLawSections(
        '<div>Some content without sections</div>'
      )
      expect(result.sections).toHaveLength(0)
      expect(result.errors).toContain('No section anchors found in HTML')
    })
  })

  describe('laws WITHOUT chapters', () => {
    it('should parse single section', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <p>1 § First section content</p>
      `
      const result = parseLawSections(html)
      expect(result.hasChapters).toBe(false)
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0]!.chapter).toBeNull()
      expect(result.sections[0]!.section).toBe('1')
    })

    it('should parse multiple sections', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <p>1 § First section</p>
        <a class="paragraf" name="P2"></a>
        <p>2 § Second section</p>
        <a class="paragraf" name="P3"></a>
        <p>3 § Third section</p>
      `
      const result = parseLawSections(html)
      expect(result.hasChapters).toBe(false)
      expect(result.totalSections).toBe(3)
      expect(result.sections.map((s) => s.section)).toEqual(['1', '2', '3'])
    })

    it('should parse lettered sections (2a, 2b)', () => {
      const html = `
        <a class="paragraf" name="P2"></a>
        <p>2 § Section 2</p>
        <a class="paragraf" name="P2a"></a>
        <p>2 a § Section 2a</p>
        <a class="paragraf" name="P2b"></a>
        <p>2 b § Section 2b</p>
        <a class="paragraf" name="P3"></a>
        <p>3 § Section 3</p>
      `
      const result = parseLawSections(html)
      expect(result.sections.map((s) => s.section)).toEqual([
        '2',
        '2a',
        '2b',
        '3',
      ])
    })

    it('should handle alternate anchor format', () => {
      const html = `
        <a name="P1" class="paragraf"></a>
        <p>1 § First section</p>
        <a name="P2" class="paragraf"></a>
        <p>2 § Second section</p>
      `
      const result = parseLawSections(html)
      expect(result.sections).toHaveLength(2)
    })
  })

  describe('laws WITH chapters', () => {
    it('should detect chapters from anchor pattern', () => {
      const html = `
        <a class="paragraf" name="K1P1"></a>
        <p>1 § Chapter 1, Section 1</p>
      `
      const result = parseLawSections(html)
      expect(result.hasChapters).toBe(true)
    })

    it('should parse chapter and section numbers', () => {
      const html = `
        <a class="paragraf" name="K1P1"></a>
        <p>1 § Chapter 1, Section 1</p>
        <a class="paragraf" name="K1P2"></a>
        <p>2 § Chapter 1, Section 2</p>
        <a class="paragraf" name="K2P1"></a>
        <p>1 § Chapter 2, Section 1</p>
      `
      const result = parseLawSections(html)
      expect(result.totalSections).toBe(3)
      expect(result.sections[0]).toMatchObject({ chapter: '1', section: '1' })
      expect(result.sections[1]).toMatchObject({ chapter: '1', section: '2' })
      expect(result.sections[2]).toMatchObject({ chapter: '2', section: '1' })
    })

    it('should parse lettered sections in chapters', () => {
      const html = `
        <a class="paragraf" name="K5P12"></a>
        <p>12 §</p>
        <a class="paragraf" name="K5P12a"></a>
        <p>12 a §</p>
      `
      const result = parseLawSections(html)
      expect(
        result.sections.map((s) => ({ ch: s.chapter, sec: s.section }))
      ).toEqual([
        { ch: '5', sec: '12' },
        { ch: '5', sec: '12a' },
      ])
    })
  })

  describe('content extraction', () => {
    it('should extract HTML content', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <p><b>1 §</b> Bold content here</p>
      `
      const result = parseLawSections(html)
      expect(result.sections[0]!.htmlContent).toContain('<b>1 §</b>')
    })

    it('should extract plain text content', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <p>1 § This is the content of section 1.</p>
      `
      const result = parseLawSections(html)
      expect(result.sections[0]!.textContent).toContain(
        'This is the content of section 1'
      )
    })

    it('should convert br tags to newlines', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <p>Line one<br>Line two<br/>Line three</p>
      `
      const result = parseLawSections(html)
      expect(result.sections[0]!.textContent).toContain('Line one')
      expect(result.sections[0]!.textContent).toContain('Line two')
    })

    it('should decode HTML entities', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <p>A &amp; B &lt; C &gt; D &quot;quoted&quot;</p>
      `
      const result = parseLawSections(html)
      expect(result.sections[0]!.textContent).toContain(
        'A & B < C > D "quoted"'
      )
    })
  })

  describe('heading extraction', () => {
    it('should extract h4 heading within section', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <h4 name="Tillämpningsområde">Tillämpningsområde</h4>
        <p>1 § Section content</p>
      `
      const result = parseLawSections(html)
      expect(result.sections[0]!.heading).toBe('Tillämpningsområde')
    })
  })

  describe('sorting', () => {
    it('should sort sections numerically', () => {
      const html = `
        <a class="paragraf" name="P10"></a><p>10 §</p>
        <a class="paragraf" name="P2"></a><p>2 §</p>
        <a class="paragraf" name="P1"></a><p>1 §</p>
      `
      const result = parseLawSections(html)
      expect(result.sections.map((s) => s.section)).toEqual(['1', '2', '10'])
    })

    it('should sort by chapter then section', () => {
      const html = `
        <a class="paragraf" name="K2P1"></a><p>2:1</p>
        <a class="paragraf" name="K1P2"></a><p>1:2</p>
        <a class="paragraf" name="K1P1"></a><p>1:1</p>
      `
      const result = parseLawSections(html)
      expect(result.sections.map((s) => `${s.chapter}:${s.section}`)).toEqual([
        '1:1',
        '1:2',
        '2:1',
      ])
    })
  })

  describe('transition provisions boundary', () => {
    it('should stop at övergångsbestämmelser', () => {
      const html = `
        <a class="paragraf" name="P1"></a>
        <p>1 § Regular section</p>
        <a name="overgang"></a>
        <p>Övergångsbestämmelser - this should not be in section</p>
      `
      const result = parseLawSections(html)
      expect(result.sections[0]!.textContent).not.toContain(
        'Övergångsbestämmelser'
      )
    })
  })
})

describe('normalizeSectionRef', () => {
  it('should remove § symbol', () => {
    expect(normalizeSectionRef('1 §')).toBe('1')
    expect(normalizeSectionRef('2a §')).toBe('2a')
  })

  it('should lowercase', () => {
    expect(normalizeSectionRef('2A §')).toBe('2a')
  })

  it('should trim whitespace', () => {
    expect(normalizeSectionRef('  1 §  ')).toBe('1')
  })
})

describe('formatSectionRef', () => {
  it('should format section without chapter', () => {
    expect(formatSectionRef(null, '1')).toBe('1 §')
    expect(formatSectionRef(null, '12')).toBe('12 §')
  })

  it('should format section with chapter', () => {
    expect(formatSectionRef('5', '12')).toBe('5 kap. 12 §')
    expect(formatSectionRef('1', '1')).toBe('1 kap. 1 §')
  })

  it('should add space before letter suffix', () => {
    expect(formatSectionRef(null, '2a')).toBe('2 a §')
    expect(formatSectionRef('3', '5b')).toBe('3 kap. 5 b §')
  })
})

describe('createSectionKey', () => {
  it('should create key without chapter', () => {
    expect(createSectionKey(null, '1')).toBe(':1')
    expect(createSectionKey(null, '2a')).toBe(':2a')
  })

  it('should create key with chapter', () => {
    expect(createSectionKey('5', '12')).toBe('5:12')
    expect(createSectionKey('1', '2a')).toBe('1:2a')
  })
})
