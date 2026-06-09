/**
 * Hardcoded demo data for the landing-page product mock. Shaped to the real
 * `app/actions/document-list` types so it can feed the actual app components
 * (e.g. `GroupedComplianceTable`) with zero backend.
 */
import type {
  DocumentListItem,
  ListGroupSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'

const NOW = new Date('2026-05-01T00:00:00Z')

export const MEMBERS: WorkspaceMemberOption[] = [
  {
    id: 'u-anna',
    name: 'Anna Lindqvist',
    email: 'anna.lindqvist@nordviken.example',
    avatarUrl: '/demo-team/anna.webp',
  },
  {
    id: 'u-sofia',
    name: 'Sofia Karlsson',
    email: 'sofia.karlsson@nordviken.example',
    avatarUrl: '/demo-team/sofia.webp',
  },
  {
    id: 'u-erik',
    name: 'Erik Bergström',
    email: 'erik.bergstrom@nordviken.example',
    avatarUrl: '/demo-team/erik.webp',
  },
  {
    id: 'u-johan',
    name: 'Johan Nilsson',
    email: 'johan.nilsson@nordviken.example',
    avatarUrl: '/demo-team/johan.webp',
  },
  {
    id: 'u-maria',
    name: 'Maria Holm',
    email: 'maria.holm@nordviken.example',
    avatarUrl: '/demo-team/maria.webp',
  },
]

const memberById = (id: string): WorkspaceMemberOption | null =>
  MEMBERS.find((m) => m.id === id) ?? null

let seq = 0
function mk(
  partial: Partial<DocumentListItem> & {
    groupId: string
    complianceStatus: DocumentListItem['complianceStatus']
  }
): DocumentListItem {
  seq += 1
  const { document: doc, ...rest } = partial
  return {
    id: `item-${seq}`,
    position: seq,
    commentary: null,
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    notes: null,
    addedAt: NOW,
    dueDate: null,
    assignee: null,
    groupName: null,
    responsibleUser: null,
    category: null,
    businessContext: null,
    businessContextUpdatedAt: null,
    businessContextUpdatedBy: null,
    complianceNarrative: null,
    complianceNarrativeUpdatedAt: null,
    complianceNarrativeUpdatedBy: null,
    updatedAt: NOW,
    pendingChangeCount: 0,
    requirementTotal: 0,
    requirementFulfilled: 0,
    ...rest,
    document: {
      id: `doc-${seq}`,
      title: 'Författning',
      documentNumber: '',
      contentType: 'SFS_LAW',
      sfsInstrument: 'lag',
      slug: `doc-${seq}`,
      summary: null,
      effectiveDate: null,
      sourceUrl: null,
      status: 'PUBLISHED',
      ...doc,
    },
  }
}

const S = ['PAGAENDE', 'EJ_UPPFYLLD', 'EJ_PABORJAD'] as const

/** Filler rows for a collapsed group — only the status distribution is visible
 *  (drives the group's X/Y indicator); titles aren't shown while collapsed. */
function filler(
  groupId: string,
  total: number,
  compliant: number
): DocumentListItem[] {
  return Array.from({ length: total }, (_, i) =>
    mk({
      groupId,
      complianceStatus: i < compliant ? 'UPPFYLLD' : S[(i - compliant) % 3]!,
    })
  )
}

export const GROUPS: ListGroupSummary[] = [
  {
    id: 'g-bolag',
    name: 'Bolagsrätt',
    position: 0,
    itemCount: 3,
    createdAt: NOW,
  },
  {
    id: 'g-arbets',
    name: 'Arbetsrätt',
    position: 1,
    itemCount: 19,
    createdAt: NOW,
  },
  {
    id: 'g-skatt',
    name: 'Skatt & Redovisning',
    position: 2,
    itemCount: 4,
    createdAt: NOW,
  },
  {
    id: 'g-restaurang',
    name: 'Restaurang & Alkohol',
    position: 3,
    itemCount: 3,
    createdAt: NOW,
  },
  {
    id: 'g-hotell',
    name: 'Hotell & Logi',
    position: 4,
    itemCount: 2,
    createdAt: NOW,
  },
  {
    id: 'g-konsument',
    name: 'Konsumenträtt',
    position: 5,
    itemCount: 2,
    createdAt: NOW,
  },
  {
    id: 'g-dataskydd',
    name: 'Dataskydd',
    position: 6,
    itemCount: 2,
    createdAt: NOW,
  },
  {
    id: 'g-arbetsmiljo',
    name: 'Arbetsmiljö',
    position: 7,
    itemCount: 18,
    createdAt: NOW,
  },
  {
    id: 'g-brand',
    name: 'Brand & Säkerhet',
    position: 8,
    itemCount: 7,
    createdAt: NOW,
  },
  {
    id: 'g-fastighet',
    name: 'Fastighet & Byggrätt',
    position: 9,
    itemCount: 3,
    createdAt: NOW,
  },
  {
    id: 'g-halsa',
    name: 'Hälsa & Säkerhet',
    position: 10,
    itemCount: 2,
    createdAt: NOW,
  },
  {
    id: 'g-aktivitet',
    name: 'Aktiviteter & Friluftsliv',
    position: 11,
    itemCount: 2,
    createdAt: NOW,
  },
]

const RESTAURANG: DocumentListItem[] = [
  mk({
    groupId: 'g-restaurang',
    complianceStatus: 'UPPFYLLD',
    priority: 'HIGH',
    requirementTotal: 3,
    requirementFulfilled: 3,
    responsibleUser: memberById('u-anna'),
    businessContext:
      'Serveringstillstånd kräver dokumenterade rutiner för ansvarsfull alkoholservering och utbildad personal.',
    document: {
      id: 'd-alko',
      title: 'Alkohollag (2010:1622)',
      documentNumber: 'SFS 2010:1622',
      contentType: 'SFS_LAW',
      sfsInstrument: 'lag',
      slug: 'sfs-2010-1622',
      summary: null,
      effectiveDate: null,
      sourceUrl: null,
      status: 'PUBLISHED',
    },
  }),
  mk({
    groupId: 'g-restaurang',
    complianceStatus: 'UPPFYLLD',
    priority: 'MEDIUM',
    requirementTotal: 3,
    requirementFulfilled: 3,
    responsibleUser: memberById('u-johan'),
    businessContext:
      'Som hotell med restaurang omfattas ni av krav på egenkontroll, HACCP och spårbarhet i livsmedelshanteringen.',
    document: {
      id: 'd-livs',
      title: 'Livsmedelslag (2006:804)',
      documentNumber: 'SFS 2006:804',
      contentType: 'SFS_LAW',
      sfsInstrument: 'lag',
      slug: 'sfs-2006-804',
      summary: null,
      effectiveDate: null,
      sourceUrl: null,
      status: 'PUBLISHED',
    },
  }),
  mk({
    groupId: 'g-restaurang',
    complianceStatus: 'PAGAENDE',
    priority: 'LOW',
    requirementTotal: 3,
    requirementFulfilled: 2,
    responsibleUser: memberById('u-maria'),
    businessContext:
      'Kompletterar livsmedelslagen med detaljerade krav på hantering, märkning och temperatur.',
    document: {
      id: 'd-livsf',
      title: 'Livsmedelsförordning (2006:813)',
      documentNumber: 'SFS 2006:813',
      contentType: 'SFS_LAW',
      sfsInstrument: 'förordning',
      slug: 'sfs-2006-813',
      summary: null,
      effectiveDate: null,
      sourceUrl: null,
      status: 'PUBLISHED',
    },
  }),
]

export const ITEMS: DocumentListItem[] = [
  ...filler('g-bolag', 3, 3),
  ...filler('g-arbets', 19, 12),
  ...filler('g-skatt', 4, 3),
  ...RESTAURANG,
  ...filler('g-hotell', 2, 2),
  ...filler('g-konsument', 2, 1),
  ...filler('g-dataskydd', 2, 1),
  ...filler('g-arbetsmiljo', 18, 9),
  ...filler('g-brand', 7, 4),
  ...filler('g-fastighet', 3, 1),
  ...filler('g-halsa', 2, 1),
  ...filler('g-aktivitet', 2, 1),
]

export const TOTAL = ITEMS.length

/** Only the on-theme small group is expanded — the rest stay collapsed. */
export const EXPANDED_GROUPS: Record<string, boolean> = { 'g-restaurang': true }
