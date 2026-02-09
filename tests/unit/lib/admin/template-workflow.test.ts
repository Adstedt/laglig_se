import { describe, it, expect } from 'vitest'

import { canTransitionTo } from '@/lib/admin/template-workflow'

describe('canTransitionTo', () => {
  describe('DRAFT → IN_REVIEW', () => {
    it('allows when items exist and no STUB statuses', () => {
      const result = canTransitionTo('DRAFT', 'IN_REVIEW', [
        'AI_GENERATED',
        'HUMAN_REVIEWED',
        'APPROVED',
      ])
      expect(result).toEqual({ allowed: true })
    })

    it('blocks when STUB items exist', () => {
      const result = canTransitionTo('DRAFT', 'IN_REVIEW', [
        'AI_GENERATED',
        'STUB',
      ])
      expect(result).toEqual({
        allowed: false,
        reason: 'Alla objekt måste ha minst AI-genererat innehåll',
      })
    })

    it('blocks when template has 0 items', () => {
      const result = canTransitionTo('DRAFT', 'IN_REVIEW', [])
      expect(result).toEqual({
        allowed: false,
        reason: 'Mallen måste innehålla minst ett objekt',
      })
    })
  })

  describe('IN_REVIEW → PUBLISHED', () => {
    it('allows when items exist and no STUB statuses', () => {
      const result = canTransitionTo('IN_REVIEW', 'PUBLISHED', [
        'AI_GENERATED',
        'APPROVED',
      ])
      expect(result).toEqual({ allowed: true })
    })

    it('blocks when STUB items exist', () => {
      const result = canTransitionTo('IN_REVIEW', 'PUBLISHED', [
        'STUB',
        'AI_GENERATED',
      ])
      expect(result).toEqual({
        allowed: false,
        reason: 'Alla objekt måste ha minst AI-genererat innehåll',
      })
    })

    it('blocks when template has 0 items', () => {
      const result = canTransitionTo('IN_REVIEW', 'PUBLISHED', [])
      expect(result).toEqual({
        allowed: false,
        reason: 'Mallen måste innehålla minst ett objekt',
      })
    })
  })

  describe('PUBLISHED → ARCHIVED', () => {
    it('always allows', () => {
      const result = canTransitionTo('PUBLISHED', 'ARCHIVED', [])
      expect(result).toEqual({ allowed: true })
    })

    it('allows even with STUB items', () => {
      const result = canTransitionTo('PUBLISHED', 'ARCHIVED', ['STUB'])
      expect(result).toEqual({ allowed: true })
    })
  })

  describe('Invalid transitions', () => {
    it('rejects DRAFT → PUBLISHED', () => {
      const result = canTransitionTo('DRAFT', 'PUBLISHED', ['AI_GENERATED'])
      expect(result).toEqual({
        allowed: false,
        reason: 'Ogiltig statusövergång',
      })
    })

    it('rejects ARCHIVED → DRAFT', () => {
      const result = canTransitionTo('ARCHIVED', 'DRAFT', ['AI_GENERATED'])
      expect(result).toEqual({
        allowed: false,
        reason: 'Ogiltig statusövergång',
      })
    })

    it('rejects IN_REVIEW → DRAFT', () => {
      const result = canTransitionTo('IN_REVIEW', 'DRAFT', ['AI_GENERATED'])
      expect(result).toEqual({
        allowed: false,
        reason: 'Ogiltig statusövergång',
      })
    })

    it('rejects DRAFT → ARCHIVED', () => {
      const result = canTransitionTo('DRAFT', 'ARCHIVED', ['AI_GENERATED'])
      expect(result).toEqual({
        allowed: false,
        reason: 'Ogiltig statusövergång',
      })
    })

    it('rejects PUBLISHED → DRAFT', () => {
      const result = canTransitionTo('PUBLISHED', 'DRAFT', ['AI_GENERATED'])
      expect(result).toEqual({
        allowed: false,
        reason: 'Ogiltig statusövergång',
      })
    })

    it('rejects PUBLISHED → IN_REVIEW', () => {
      const result = canTransitionTo('PUBLISHED', 'IN_REVIEW', ['AI_GENERATED'])
      expect(result).toEqual({
        allowed: false,
        reason: 'Ogiltig statusövergång',
      })
    })
  })
})
