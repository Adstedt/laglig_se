'use client'

/**
 * The REAL law-list-item modal body (ModalHeader + LeftPanel + RightPanel),
 * rendered for the landing feature-showcase with mocked data — now
 * document-driven so the showcase tabs can swap between regelverk types
 * (lag / föreskrift / EU-förordning).
 *
 * Safe on a public page: `SWRConfig` with revalidation off (no server actions
 * fire), `initialOpenItems` opens kravpunkter + uppgifter, the tree is
 * `pointer-events-none`, and it's loaded via `dynamic(ssr:false)`.
 */

import { SWRConfig } from 'swr'
import { ModalHeader } from '@/components/features/document-list/legal-document-modal/modal-header'
import { LeftPanel } from '@/components/features/document-list/legal-document-modal/left-panel'
import { RightPanel } from '@/components/features/document-list/legal-document-modal/right-panel'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import type {
  RequirementWithEvidence,
  RequirementEvidenceSummary,
} from '@/app/actions/law-list-item-requirements'

const D = (s: string) => new Date(s)
const noop = () => {}
const noopAsync = async () => {}

const MEMBERS: WorkspaceMemberOption[] = [
  {
    id: 'u-anna',
    name: 'Anna Lindqvist',
    email: 'anna@nordviken.se',
    avatarUrl: '/demo-team/anna.webp',
  },
  {
    id: 'u-erik',
    name: 'Erik Holm',
    email: 'erik@nordviken.se',
    avatarUrl: '/demo-team/erik.webp',
  },
  {
    id: 'u-johan',
    name: 'Johan Berg',
    email: 'johan@nordviken.se',
    avatarUrl: '/demo-team/johan.webp',
  },
  {
    id: 'u-maria',
    name: 'Maria Ek',
    email: 'maria@nordviken.se',
    avatarUrl: '/demo-team/maria.webp',
  },
]
const memberById = (id: string) => MEMBERS.find((m) => m.id === id)!

const evFile = (id: string, filename: string): RequirementEvidenceSummary => ({
  id,
  linkedAt: D('2026-02-01'),
  file: { id: `f-${id}`, filename, mimeType: 'application/pdf' },
  workspaceDocument: null,
})
const evDoc = (id: string, title: string): RequirementEvidenceSummary => ({
  id,
  linkedAt: D('2026-02-01'),
  file: null,
  workspaceDocument: {
    id: `d-${id}`,
    title,
    documentType: 'POLICY',
    status: 'APPROVED',
  },
})

function mkReq(p: {
  id: string
  pos: number
  text: string
  fulfilled: boolean
  owner: string
  comment?: string
  evidence?: RequirementEvidenceSummary[]
}): RequirementWithEvidence {
  return {
    id: p.id,
    text: p.text,
    comment: p.comment ?? null,
    isFulfilled: p.fulfilled,
    bevisRequired: true,
    position: p.pos,
    createdAt: D('2026-01-12'),
    updatedAt: D('2026-03-01'),
    createdBy: p.owner,
    responsibleUserId: p.owner,
    effectiveAssignee: { userId: p.owner, isInherited: false },
    evidence: p.evidence ?? [],
  }
}

function mkItem(p: {
  id: string
  title: string
  documentNumber: string
  contentType: string
  summary: string
  complianceStatus: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  businessContext: string
  narrative: string
  ownerId: string
  category: string
}): ListItemDetails {
  return {
    id: p.id,
    position: 0,
    complianceStatus: p.complianceStatus,
    priority: p.priority,
    businessContext: p.businessContext,
    aiCommentary: null,
    category: p.category,
    addedAt: D('2026-01-10'),
    updatedAt: D('2026-03-07'),
    dueDate: null,
    complianceNarrative: p.narrative,
    complianceNarrativeUpdatedAt: D('2026-02-28'),
    complianceNarrativeUpdatedBy: p.ownerId,
    legalDocument: {
      id: `doc-${p.id}`,
      title: p.title,
      documentNumber: p.documentNumber,
      htmlContent: null,
      summary: p.summary,
      slug: p.id,
      status: 'ACTIVE',
      sourceUrl: null,
      contentType: p.contentType,
      effectiveDate: D('2011-01-01'),
    },
    lawList: { id: 'list-1', name: 'Er laglista' },
    responsibleUser: memberById(p.ownerId),
    latestAmendment: null,
    lastChangeAcknowledgedAt: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ListItemDetails
}

const TASK_COLUMNS = [
  {
    id: 'col-todo',
    name: 'Att göra',
    color: '#f59e0b',
    is_done: false,
    position: 0,
  },
  {
    id: 'col-done',
    name: 'Klart',
    color: '#22c55e',
    is_done: true,
    position: 2,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any

const mkTask = (id: string, title: string, owner: string) =>
  ({
    total: 1,
    completed: 0,
    tasks: [
      {
        id,
        title,
        columnId: 'col-todo',
        columnName: 'Att göra',
        isDone: false,
        columnColor: '#f59e0b',
        assignee: {
          name: memberById(owner).name,
          avatarUrl: memberById(owner).avatarUrl,
        },
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

const mkArtifacts = (n: number) => ({
  artifacts: Array.from({ length: n }, (_, i) => ({ id: `a${i}` })),
  tasksWithoutAttachmentCount: 0,
})

interface DocData {
  listItem: ListItemDetails
  reqs: RequirementWithEvidence[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taskProgress: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artifacts: any
  ownerId: string
}

const DOC_DATA: Record<string, DocData> = {
  alkohollag: {
    ownerId: 'u-anna',
    listItem: mkItem({
      id: 'alkohollag',
      title: 'Alkohollag (2010:1622)',
      documentNumber: '2010:1622',
      contentType: 'LAW',
      summary:
        'Reglerar servering av alkohol. 8 kap. ställer krav på serveringstillstånd, rutiner och kunskap.',
      complianceStatus: 'PAGAENDE',
      priority: 'HIGH',
      businessContext:
        'Vi driver restaurang och konferens med servering — alkohollagens krav på rutiner och kunskap berör oss direkt.',
      narrative:
        'Vi följer en dokumenterad serveringsrutin och utbildar all personal i ansvarsfull servering. Den årliga kunskapsprövningen är inplanerad men inte genomförd ännu.',
      ownerId: 'u-anna',
      category: 'Restaurang & Alkohol',
    }),
    reqs: [
      mkReq({
        id: 'ak1',
        pos: 0,
        text: 'Dokumenterade rutiner för ansvarsfull alkoholservering',
        fulfilled: true,
        owner: 'u-anna',
        comment:
          'Uppdaterad efter ändringen i 8 kap. — nya rutiner gäller från mars.',
        evidence: [
          evFile('ak1a', 'Serveringsrutin_2026.pdf'),
          evDoc('ak1b', 'Alkoholpolicy'),
        ],
      }),
      mkReq({
        id: 'ak2',
        pos: 1,
        text: 'Årlig kunskapsprövning genomförd och dokumenterad',
        fulfilled: false,
        owner: 'u-erik',
      }),
    ],
    taskProgress: mkTask(
      't-ak',
      'Boka årlig kunskapsprövning för serveringspersonal',
      'u-anna'
    ),
    artifacts: mkArtifacts(3),
  },
  arbetsmiljolagen: {
    ownerId: 'u-erik',
    listItem: mkItem({
      id: 'arbetsmiljolagen',
      title: 'Arbetsmiljölag (1977:1160)',
      documentNumber: '1977:1160',
      contentType: 'LAW',
      summary:
        'Ställer krav på en säker och hälsosam arbetsmiljö för alla anställda — gäller varje arbetsgivare.',
      complianceStatus: 'UPPFYLLD',
      priority: 'MEDIUM',
      businessContext:
        'Som arbetsgivare omfattas vi av arbetsmiljölagens krav på en säker arbetsmiljö för all personal.',
      narrative:
        'Vi har en aktuell arbetsmiljöpolicy, ett utsett skyddsombud och genomför regelbundna skyddsronder med dokumenterad uppföljning.',
      ownerId: 'u-erik',
      category: 'Arbetsmiljö',
    }),
    reqs: [
      mkReq({
        id: 'am1',
        pos: 0,
        text: 'Skriftlig arbetsmiljöpolicy finns och hålls aktuell',
        fulfilled: true,
        owner: 'u-erik',
        evidence: [evDoc('am1a', 'Arbetsmiljöpolicy')],
      }),
      mkReq({
        id: 'am2',
        pos: 1,
        text: 'Skyddsombud utsett och anmält till Arbetsmiljöverket',
        fulfilled: true,
        owner: 'u-erik',
        comment: 'Skyddsombud omvalt på årsmötet i januari.',
        evidence: [evFile('am2a', 'Anmalan_skyddsombud.pdf')],
      }),
    ],
    taskProgress: mkTask('t-am', 'Planera nästa skyddskommittémöte', 'u-erik'),
    artifacts: mkArtifacts(2),
  },
  afs2023: {
    ownerId: 'u-erik',
    listItem: mkItem({
      id: 'afs2023',
      title: 'AFS 2023:1 – Systematiskt arbetsmiljöarbete',
      documentNumber: 'AFS 2023:1',
      contentType: 'AGENCY_REGULATION',
      summary:
        'Arbetsmiljöverkets föreskrifter om systematiskt arbetsmiljöarbete och arbetsmiljöarbetets organisering.',
      complianceStatus: 'PAGAENDE',
      priority: 'HIGH',
      businessContext:
        'Föreskrifterna kräver att vi bedriver ett systematiskt arbetsmiljöarbete med rutiner, riskbedömning och uppföljning.',
      narrative:
        'Vårt systematiska arbetsmiljöarbete följer ett årshjul med rutiner och uppföljning. Årets riskbedömning återstår att genomföra.',
      ownerId: 'u-erik',
      category: 'Arbetsmiljö',
    }),
    reqs: [
      mkReq({
        id: 'af1',
        pos: 0,
        text: 'Rutin för systematiskt arbetsmiljöarbete (SAM) upprättad',
        fulfilled: true,
        owner: 'u-erik',
        comment: 'Reviderad i samband med övergången till AFS 2023:1.',
        evidence: [
          evDoc('af1a', 'SAM-rutin'),
          evFile('af1b', 'Arshjul_SAM.pdf'),
        ],
      }),
      mkReq({
        id: 'af2',
        pos: 1,
        text: 'Årlig riskbedömning genomförd och dokumenterad',
        fulfilled: false,
        owner: 'u-erik',
      }),
    ],
    taskProgress: mkTask('t-af', 'Genomför riskbedömning för 2026', 'u-erik'),
    artifacts: mkArtifacts(4),
  },
  livsfs: {
    ownerId: 'u-johan',
    listItem: mkItem({
      id: 'livsfs',
      title: 'LIVSFS 2005:20 – Livsmedelshygien',
      documentNumber: 'LIVSFS 2005:20',
      contentType: 'AGENCY_REGULATION',
      summary:
        'Livsmedelsverkets föreskrifter om livsmedelshygien — krav på egenkontroll och dokumentation.',
      complianceStatus: 'UPPFYLLD',
      priority: 'MEDIUM',
      businessContext:
        'Vår restaurangverksamhet omfattas av kraven på livsmedelshygien och dokumenterad egenkontroll (HACCP).',
      narrative:
        'Vi arbetar efter ett HACCP-baserat egenkontrollprogram och all kökspersonal är utbildad i livsmedelshygien. Egenkontrollen följs upp löpande.',
      ownerId: 'u-johan',
      category: 'Livsmedel',
    }),
    reqs: [
      mkReq({
        id: 'lv1',
        pos: 0,
        text: 'HACCP-plan och egenkontrollprogram upprättat',
        fulfilled: true,
        owner: 'u-johan',
        evidence: [
          evDoc('lv1a', 'HACCP-plan'),
          evFile('lv1b', 'Egenkontroll_2026.pdf'),
        ],
      }),
      mkReq({
        id: 'lv2',
        pos: 1,
        text: 'Personal utbildad i livsmedelshygien',
        fulfilled: true,
        owner: 'u-johan',
        evidence: [evFile('lv2a', 'Utbildningsintyg_hygien.pdf')],
      }),
    ],
    taskProgress: mkTask(
      't-lv',
      'Uppdatera egenkontrollprogrammet inför sommaren',
      'u-johan'
    ),
    artifacts: mkArtifacts(3),
  },
  gdpr: {
    ownerId: 'u-maria',
    listItem: mkItem({
      id: 'gdpr',
      title: 'Dataskyddsförordningen (GDPR)',
      documentNumber: '(EU) 2016/679',
      contentType: 'EU_REGULATION',
      summary:
        'EU:s dataskyddsförordning reglerar behandling av personuppgifter om gäster och anställda.',
      complianceStatus: 'PAGAENDE',
      priority: 'HIGH',
      businessContext:
        'Vi behandlar personuppgifter om gäster och anställda och omfattas därför av GDPR.',
      narrative:
        'Vi har en registerförteckning över personuppgiftsbehandlingar. Rutinen för registrerades rättigheter är under framtagande.',
      ownerId: 'u-maria',
      category: 'Dataskydd',
    }),
    reqs: [
      mkReq({
        id: 'gd1',
        pos: 0,
        text: 'Registerförteckning över personuppgiftsbehandlingar',
        fulfilled: true,
        owner: 'u-maria',
        evidence: [evDoc('gd1a', 'Registerförteckning')],
      }),
      mkReq({
        id: 'gd2',
        pos: 1,
        text: 'Rutin för registrerades rättigheter (radering, registerutdrag)',
        fulfilled: false,
        owner: 'u-maria',
      }),
    ],
    taskProgress: mkTask(
      't-gd',
      'Upprätta personuppgiftsbiträdesavtal med IT-leverantör',
      'u-maria'
    ),
    artifacts: mkArtifacts(5),
  },
}

export function LawItemModalReal({ docId }: { docId: string }) {
  const doc = DOC_DATA[docId] ?? DOC_DATA.alkohollag!
  const id = doc.listItem.id

  return (
    <SWRConfig
      value={{
        revalidateOnMount: false,
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        fallback: {
          [`list-item-requirements:${id}`]: doc.reqs,
          [`linked-artifacts:${id}`]: doc.artifacts,
        } as Record<string, unknown>,
      }}
    >
      <div
        key={id}
        className="pointer-events-none flex w-full select-none flex-col bg-background text-left"
      >
        <ModalHeader
          listName="Er laglista"
          listId="list-1"
          documentNumber={doc.listItem.legalDocument.documentNumber}
          slug={doc.listItem.legalDocument.slug}
          onClose={noop}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 overflow-hidden">
            <LeftPanel
              listItem={doc.listItem}
              workspaceMembers={MEMBERS}
              listItemResponsibleUserId={doc.ownerId}
              initialOpenItems={['kravpunkter', 'tasks']}
              taskProgress={doc.taskProgress}
              taskColumns={TASK_COLUMNS}
              onTasksUpdate={noopAsync}
            />
          </div>
          <div className="overflow-hidden">
            <RightPanel
              listItem={doc.listItem}
              workspaceMembers={MEMBERS}
              onUpdate={noopAsync}
              onLinkedArtifactsClick={noop}
              onKravpunkterGapClick={noop}
            />
          </div>
        </div>
      </div>
    </SWRConfig>
  )
}
