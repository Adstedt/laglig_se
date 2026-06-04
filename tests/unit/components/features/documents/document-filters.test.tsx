/**
 * matchesStatusFilter predicate tests — Story 17.17 AC 3 / AC 4.
 *
 * Verifies the pointer-aware status filter under Story 17.16's dual-pointer
 * model: a dual-state doc (APPROVED + draft pending) must match BOTH the
 * APPROVED filter AND the matching draft sub-status filter, by design.
 */
import { describe, it, expect } from 'vitest'
import {
  matchesStatusFilter,
  type StatusFilterableDoc,
} from '@/components/features/documents/document-filters'

const dualState: StatusFilterableDoc = {
  status: 'APPROVED',
  current_approved_version_id: 'v-approved',
  current_draft_version_id: 'v-draft',
  draft_status: 'DRAFT',
}

const dualStateInReview: StatusFilterableDoc = {
  ...dualState,
  draft_status: 'IN_REVIEW',
}

const approvedOnly: StatusFilterableDoc = {
  status: 'APPROVED',
  current_approved_version_id: 'v-approved',
  current_draft_version_id: null,
  draft_status: null,
}

const neverApprovedDraft: StatusFilterableDoc = {
  status: 'DRAFT',
  current_approved_version_id: null,
  current_draft_version_id: 'v-draft',
  draft_status: 'DRAFT',
}

const neverApprovedInReview: StatusFilterableDoc = {
  status: 'IN_REVIEW',
  current_approved_version_id: null,
  current_draft_version_id: 'v-draft',
  draft_status: 'IN_REVIEW',
}

const archived: StatusFilterableDoc = {
  status: 'ARCHIVED',
  current_approved_version_id: null,
  current_draft_version_id: null,
  draft_status: null,
}

const superseded: StatusFilterableDoc = {
  status: 'SUPERSEDED',
  current_approved_version_id: 'v-old-approved',
  current_draft_version_id: null,
  draft_status: null,
}

describe('matchesStatusFilter', () => {
  describe('APPROVED filter (AC 3)', () => {
    it('matches a stable approved doc', () => {
      expect(matchesStatusFilter(approvedOnly, 'APPROVED')).toBe(true)
    })

    it('matches a dual-state doc (the doc IS still operationally approved)', () => {
      expect(matchesStatusFilter(dualState, 'APPROVED')).toBe(true)
    })

    it('matches a dual-state-in-review doc', () => {
      expect(matchesStatusFilter(dualStateInReview, 'APPROVED')).toBe(true)
    })

    it('does NOT match a never-approved draft', () => {
      expect(matchesStatusFilter(neverApprovedDraft, 'APPROVED')).toBe(false)
    })

    it('does NOT match an archived doc with no approved pointer', () => {
      expect(matchesStatusFilter(archived, 'APPROVED')).toBe(false)
    })
  })

  describe('DRAFT filter (AC 4)', () => {
    it('matches a never-approved draft', () => {
      expect(matchesStatusFilter(neverApprovedDraft, 'DRAFT')).toBe(true)
    })

    it('matches a dual-state doc with draft_status=DRAFT', () => {
      expect(matchesStatusFilter(dualState, 'DRAFT')).toBe(true)
    })

    it('does NOT match a dual-state-in-review doc (draft_status mismatch)', () => {
      expect(matchesStatusFilter(dualStateInReview, 'DRAFT')).toBe(false)
    })

    it('does NOT match a stable approved doc', () => {
      expect(matchesStatusFilter(approvedOnly, 'DRAFT')).toBe(false)
    })
  })

  describe('IN_REVIEW filter (AC 4 extension)', () => {
    it('matches a never-approved IN_REVIEW doc', () => {
      expect(matchesStatusFilter(neverApprovedInReview, 'IN_REVIEW')).toBe(true)
    })

    it('matches a dual-state doc with draft_status=IN_REVIEW', () => {
      expect(matchesStatusFilter(dualStateInReview, 'IN_REVIEW')).toBe(true)
    })

    it('does NOT match a draft-only doc (sub-status mismatch)', () => {
      expect(matchesStatusFilter(neverApprovedDraft, 'IN_REVIEW')).toBe(false)
    })
  })

  describe('terminal-state filters (status-based, unchanged)', () => {
    it('ARCHIVED filter matches archived docs by status', () => {
      expect(matchesStatusFilter(archived, 'ARCHIVED')).toBe(true)
    })

    it('SUPERSEDED filter matches superseded docs by status', () => {
      expect(matchesStatusFilter(superseded, 'SUPERSEDED')).toBe(true)
    })

    it('ARCHIVED filter does NOT match a dual-state doc', () => {
      expect(matchesStatusFilter(dualState, 'ARCHIVED')).toBe(false)
    })
  })

  describe('"both filters at once" invariant (AC 3 + AC 4 intersection)', () => {
    it('a dual-state doc appears under BOTH "Godkända" AND "Utkast" filters', () => {
      expect(matchesStatusFilter(dualState, 'APPROVED')).toBe(true)
      expect(matchesStatusFilter(dualState, 'DRAFT')).toBe(true)
    })
  })
})
