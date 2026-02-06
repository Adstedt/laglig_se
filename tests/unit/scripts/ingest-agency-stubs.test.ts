/**
 * Story 12.1: Unit Tests for Agency Regulation Stub Ingestion Script
 *
 * Tests the exported parsing helpers: extractBaseDocumentNumber and generateSlug.
 */

import { describe, it, expect } from 'vitest'
import {
  extractBaseDocumentNumber,
  generateSlug,
} from '@/scripts/ingest-agency-stubs'

describe('ingest-agency-stubs', () => {
  describe('extractBaseDocumentNumber', () => {
    it('returns unchanged input when no (ersätter ...) clause', () => {
      expect(extractBaseDocumentNumber('AFS 2023:1')).toBe('AFS 2023:1')
      expect(extractBaseDocumentNumber('BFS 2011:6')).toBe('BFS 2011:6')
      expect(extractBaseDocumentNumber('NFS 2004:10')).toBe('NFS 2004:10')
    })

    it('strips (ersätter ...) clause with Swedish chars', () => {
      expect(
        extractBaseDocumentNumber('AFS 2023:2 (ersätter AFS 2001:1)')
      ).toBe('AFS 2023:2')
    })

    it('strips (ersatter ...) clause with ASCII chars', () => {
      expect(
        extractBaseDocumentNumber('AFS 2023:2 (ersatter AFS 2001:1)')
      ).toBe('AFS 2023:2')
    })

    it('handles complex replacement references', () => {
      expect(
        extractBaseDocumentNumber(
          'AFS 2023:2 (ersätter AFS 2006:4, AFS 2008:3)'
        )
      ).toBe('AFS 2023:2')
    })

    it('handles whitespace around the clause', () => {
      expect(
        extractBaseDocumentNumber('AFS 2023:1  (ersätter AFS 2000:1)  ')
      ).toBe('AFS 2023:1')
    })

    it('handles ELSÄK-FS hyphenated prefix', () => {
      expect(
        extractBaseDocumentNumber('ELSÄK-FS 2022:1 (ersätter ELSÄK-FS 2008:1)')
      ).toBe('ELSÄK-FS 2022:1')
    })
  })

  describe('generateSlug', () => {
    it('converts basic document number to slug', () => {
      expect(generateSlug('AFS 2023:1')).toBe('afs-2023-1')
    })

    it('handles colon and space replacement', () => {
      expect(generateSlug('BFS 2011:6')).toBe('bfs-2011-6')
    })

    it('handles Swedish characters', () => {
      expect(generateSlug('ELSÄK-FS 2022:1')).toBe('elsak-fs-2022-1')
    })

    it('removes consecutive hyphens', () => {
      expect(generateSlug('AFS  2023:1')).toBe('afs-2023-1')
    })

    it('handles NFS prefix', () => {
      expect(generateSlug('NFS 2004:10')).toBe('nfs-2004-10')
    })

    it('handles KIFS prefix', () => {
      expect(generateSlug('KIFS 2017:7')).toBe('kifs-2017-7')
    })

    it('handles MSBFS prefix', () => {
      expect(generateSlug('MSBFS 2020:7')).toBe('msbfs-2020-7')
    })

    it('strips leading and trailing hyphens', () => {
      expect(generateSlug('-AFS 2023:1-')).toBe('afs-2023-1')
    })
  })
})
