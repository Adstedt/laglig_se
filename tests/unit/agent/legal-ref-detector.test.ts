import { describe, it, expect } from 'vitest'
import { detectLegalReferences } from '@/lib/agent/legal-ref-detector'

describe('detectLegalReferences', () => {
  describe('SFS number detection', () => {
    it('detects "SFS 1977:1160"', () => {
      const result = detectLegalReferences('Vad säger SFS 1977:1160?')
      expect(result.sfsNumbers).toEqual(['1977:1160'])
    })

    it('detects bare "1977:1160" without SFS prefix', () => {
      const result = detectLegalReferences('Kolla 1977:1160')
      expect(result.sfsNumbers).toEqual(['1977:1160'])
    })

    it('detects multiple SFS numbers', () => {
      const result = detectLegalReferences(
        'Jämför SFS 1977:1160 och 2010:800 med SFS 2003:460'
      )
      expect(result.sfsNumbers).toEqual(['1977:1160', '2010:800', '2003:460'])
    })

    it('deduplicates SFS numbers', () => {
      const result = detectLegalReferences('SFS 1977:1160 och 1977:1160 igen')
      expect(result.sfsNumbers).toEqual(['1977:1160'])
    })
  })

  describe('chapter/section detection', () => {
    it('detects "3 kap. 5 §"', () => {
      const result = detectLegalReferences('Se 3 kap. 5 §')
      expect(result.sectionRefs).toEqual([{ chapter: 3, section: '5' }])
    })

    it('detects section with letter suffix "12a §"', () => {
      const result = detectLegalReferences('Enligt 2 kap. 12a §')
      expect(result.sectionRefs).toEqual([{ chapter: 2, section: '12a' }])
    })

    it('detects standalone "5 §" without chapter', () => {
      const result = detectLegalReferences('Se 5 §')
      expect(result.sectionRefs).toEqual([{ section: '5' }])
    })

    it('detects standalone section with letter suffix', () => {
      const result = detectLegalReferences('Gäller 12a §')
      expect(result.sectionRefs).toEqual([{ section: '12a' }])
    })
  })

  describe('no references', () => {
    it('returns empty for plain text', () => {
      const result = detectLegalReferences(
        'Hur hanterar man arbetsmiljöfrågor?'
      )
      expect(result.sfsNumbers).toEqual([])
      expect(result.sectionRefs).toEqual([])
    })
  })

  describe('mixed references in natural language', () => {
    it('detects SFS + chapter/section in same query', () => {
      const result = detectLegalReferences(
        'Vad innebär 3 kap. 2 § i SFS 1977:1160 för arbetsgivaren?'
      )
      expect(result.sfsNumbers).toEqual(['1977:1160'])
      expect(result.sectionRefs).toEqual([{ chapter: 3, section: '2' }])
    })

    it('detects multiple section refs and SFS numbers', () => {
      const result = detectLegalReferences(
        'Jämför 3 kap. 5 § och 7 § i SFS 1977:1160 med 2 kap. 1 § i 2010:800'
      )
      expect(result.sfsNumbers).toEqual(['1977:1160', '2010:800'])
      expect(result.sectionRefs).toContainEqual({ chapter: 3, section: '5' })
      expect(result.sectionRefs).toContainEqual({ section: '7' })
      expect(result.sectionRefs).toContainEqual({ chapter: 2, section: '1' })
    })
  })
})
