/**
 * Mock data for the Styrdokument showcase — shaped to the real `DocumentItem`
 * type so the frozen `MarketingDocumentTable` renders unchanged. Nordviken framing.
 *
 * Story 17.17 — extended with Story 17.16's dual-pointer fields so the
 * composite "Godkänd v{N} · Utkast v{N+1} pågår" badge gets a live demo
 * (doc-2). The rest stay single-state to keep the showcase honest.
 */
import type { DocumentItem } from './marketing-document-table'

const TS = (s: string) => new Date(s).toISOString()

// Builders keep the dual-pointer boilerplate readable across all 7 mocks.

function approvedOnly(versionNumber: number, approvedAt: string) {
  return {
    current_approved_version_id: `v-${approvedAt}`,
    current_draft_version_id: null,
    draft_status: null,
    current_approved_version: {
      version_number: versionNumber,
      approved_at: TS(approvedAt),
    },
    current_draft_version: null,
  } as const
}

function dualState(
  approvedVersionNumber: number,
  approvedAt: string,
  draftVersionNumber: number,
  draftCreatedAt: string,
  draftStatus: 'DRAFT' | 'IN_REVIEW' = 'DRAFT'
) {
  return {
    current_approved_version_id: `v-approved-${approvedAt}`,
    current_draft_version_id: `v-draft-${draftCreatedAt}`,
    draft_status: draftStatus,
    current_approved_version: {
      version_number: approvedVersionNumber,
      approved_at: TS(approvedAt),
    },
    current_draft_version: {
      version_number: draftVersionNumber,
      created_at: TS(draftCreatedAt),
    },
  } as const
}

function draftOnly(versionNumber: number, createdAt: string) {
  return {
    current_approved_version_id: null,
    current_draft_version_id: `v-draft-${createdAt}`,
    draft_status: 'DRAFT' as const,
    current_approved_version: null,
    current_draft_version: {
      version_number: versionNumber,
      created_at: TS(createdAt),
    },
  } as const
}

function inReviewOnly(versionNumber: number, createdAt: string) {
  return {
    current_approved_version_id: null,
    current_draft_version_id: `v-draft-${createdAt}`,
    draft_status: 'IN_REVIEW' as const,
    current_approved_version: null,
    current_draft_version: {
      version_number: versionNumber,
      created_at: TS(createdAt),
    },
  } as const
}

export const DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'Rutin för ansvarsfull alkoholservering',
    document_type: 'PROCEDURE',
    status: 'APPROVED',
    document_number: 'RUT-014',
    current_version_number: 3,
    review_date: '2026-09-01',
    created_at: TS('2025-02-10'),
    updated_at: TS('2026-03-02'),
    creator: {
      id: 'u-anna',
      name: 'Anna Lindqvist',
      email: 'anna@nordviken.se',
    },
    ...approvedOnly(3, '2026-03-02'),
  },
  {
    // Dual-state showcase: this is the doc that demonstrates the new
    // composite "Godkänd v5 · Utkast v6 pågår" badge on the landing table.
    id: 'doc-2',
    title: 'Systematiskt arbetsmiljöarbete – policy',
    document_type: 'POLICY',
    status: 'APPROVED',
    document_number: 'POL-002',
    current_version_number: 6,
    review_date: '2026-06-15',
    created_at: TS('2024-11-01'),
    updated_at: TS('2026-04-22'),
    creator: {
      id: 'u-sofia',
      name: 'Sofia Karlsson',
      email: 'sofia@nordviken.se',
    },
    ...dualState(5, '2026-02-18', 6, '2026-04-22', 'DRAFT'),
  },
  {
    id: 'doc-3',
    title: 'Riskbedömning kök & servering 2026',
    document_type: 'RISK_ASSESSMENT',
    status: 'IN_REVIEW',
    document_number: 'RISK-021',
    current_version_number: 2,
    review_date: '2026-05-30',
    created_at: TS('2026-01-20'),
    updated_at: TS('2026-04-28'),
    creator: { id: 'u-erik', name: 'Erik Holm', email: 'erik@nordviken.se' },
    ...inReviewOnly(2, '2026-04-28'),
  },
  {
    id: 'doc-4',
    title: 'Behandling av personuppgifter (GDPR)',
    document_type: 'POLICY',
    status: 'APPROVED',
    document_number: 'POL-008',
    current_version_number: 4,
    review_date: '2026-12-01',
    created_at: TS('2024-05-12'),
    updated_at: TS('2026-01-09'),
    creator: { id: 'u-johan', name: 'Johan Berg', email: 'johan@nordviken.se' },
    ...approvedOnly(4, '2026-01-09'),
  },
  {
    id: 'doc-5',
    title: 'Handlingsplan brandskydd',
    document_type: 'ACTION_PLAN',
    status: 'DRAFT',
    document_number: null,
    current_version_number: 1,
    review_date: null,
    created_at: TS('2026-04-15'),
    updated_at: TS('2026-04-15'),
    creator: { id: 'u-maria', name: 'Maria Ek', email: 'maria@nordviken.se' },
    ...draftOnly(1, '2026-04-15'),
  },
  {
    id: 'doc-6',
    title: 'Egenkontroll livsmedel – instruktion',
    document_type: 'INSTRUCTION',
    status: 'APPROVED',
    document_number: 'INS-031',
    current_version_number: 2,
    review_date: '2026-08-20',
    created_at: TS('2025-06-03'),
    updated_at: TS('2026-02-25'),
    creator: {
      id: 'u-anna',
      name: 'Anna Lindqvist',
      email: 'anna@nordviken.se',
    },
    ...approvedOnly(2, '2026-02-25'),
  },
  {
    id: 'doc-7',
    title: 'Checklista öppning & stängning',
    document_type: 'CHECKLIST',
    status: 'APPROVED',
    document_number: 'CHK-005',
    current_version_number: 6,
    review_date: '2026-07-01',
    created_at: TS('2024-09-18'),
    updated_at: TS('2026-03-30'),
    creator: {
      id: 'u-sofia',
      name: 'Sofia Karlsson',
      email: 'sofia@nordviken.se',
    },
    ...approvedOnly(6, '2026-03-30'),
  },
]
