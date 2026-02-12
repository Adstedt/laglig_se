/**
 * Story 9.1: Unit Tests for AFS Consolidated PDF Download Script
 *
 * Tests URL configuration completeness, file naming conventions,
 * and URL registry coverage.
 */

import { describe, it, expect } from 'vitest'
import { AFS_REGISTRY } from '@/lib/agency/afs-registry'
import {
  AFS_URL_REGISTRY,
  getPdfFileName,
} from '@/scripts/download-afs-consolidated'

describe('download-afs-consolidated', () => {
  describe('URL registry coverage', () => {
    it('has URLs for all 15 AFS documents', () => {
      for (const doc of AFS_REGISTRY) {
        const urls = AFS_URL_REGISTRY[doc.documentNumber]
        expect(
          urls,
          `Missing URL config for ${doc.documentNumber}`
        ).toBeDefined()
      }
    })

    it('all pdfUrl entries point to av.se', () => {
      for (const [docNum, urls] of Object.entries(AFS_URL_REGISTRY)) {
        expect(urls.pdfUrl, `${docNum} pdfUrl`).toContain('av.se')
        expect(urls.pdfUrl, `${docNum} pdfUrl`).toMatch(/\.pdf$/)
      }
    })

    it('all pageUrl entries point to av.se', () => {
      for (const [docNum, urls] of Object.entries(AFS_URL_REGISTRY)) {
        expect(urls.pageUrl, `${docNum} pageUrl`).toContain('av.se')
      }
    })

    it('all historikUrl entries point to av.se', () => {
      for (const [docNum, urls] of Object.entries(AFS_URL_REGISTRY)) {
        expect(urls.historikUrl, `${docNum} historikUrl`).toContain('av.se')
        expect(urls.historikUrl, `${docNum} historikUrl`).toContain(
          'forfattningshistorik'
        )
      }
    })
  })

  describe('getPdfFileName', () => {
    it('converts document number to file name', () => {
      expect(getPdfFileName('AFS 2023:1')).toBe('AFS-2023-1.pdf')
      expect(getPdfFileName('AFS 2023:10')).toBe('AFS-2023-10.pdf')
      expect(getPdfFileName('AFS 2023:15')).toBe('AFS-2023-15.pdf')
    })

    it('produces unique file names for all 15 documents', () => {
      const fileNames = AFS_REGISTRY.map((d) =>
        getPdfFileName(d.documentNumber)
      )
      const unique = new Set(fileNames)
      expect(unique.size).toBe(15)
    })
  })
})
