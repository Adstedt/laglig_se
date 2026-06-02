/**
 * Mock data for the Uppgifter showcase — shaped to the real `TaskWithRelations`
 * + `TaskColumnWithCount` types so the actual tasks `ListTab` renders unchanged.
 * Nordviken framing; tasks reference real-sounding regelverk via list_item_links.
 */
import type {
  TaskWithRelations,
  TaskColumnWithCount,
} from '@/app/actions/tasks'
import { MEMBERS } from './hero-shot-data'

const D = (s: string) => new Date(s)
const WS = 'ws-nordviken'

const memberById = (id: string) => MEMBERS.find((m) => m.id === id) ?? null

function assignee(id: string | null): TaskWithRelations['assignee'] {
  const m = id ? memberById(id) : null
  if (!m) return null
  return { id: m.id, name: m.name, email: m.email, avatar_url: m.avatarUrl }
}

export const COLUMNS: TaskColumnWithCount[] = [
  {
    id: 'col-todo',
    workspace_id: WS,
    name: 'Att göra',
    color: '#f59e0b',
    position: 0,
    is_default: true,
    is_done: false,
    created_at: D('2026-01-01'),
    updated_at: D('2026-01-01'),
    _count: { tasks: 2 },
  },
  {
    id: 'col-doing',
    workspace_id: WS,
    name: 'Pågår',
    color: '#0ea5e9',
    position: 1,
    is_default: true,
    is_done: false,
    created_at: D('2026-01-01'),
    updated_at: D('2026-01-01'),
    _count: { tasks: 2 },
  },
  {
    id: 'col-done',
    workspace_id: WS,
    name: 'Klart',
    color: '#10b981',
    position: 2,
    is_default: true,
    is_done: true,
    created_at: D('2026-01-01'),
    updated_at: D('2026-01-01'),
    _count: { tasks: 2 },
  },
]

const COL = {
  todo: { id: 'col-todo', name: 'Att göra', color: '#f59e0b', is_done: false },
  doing: { id: 'col-doing', name: 'Pågår', color: '#0ea5e9', is_done: false },
  done: { id: 'col-done', name: 'Klart', color: '#10b981', is_done: true },
}

function link(
  id: string,
  title: string,
  documentNumber: string,
  listName: string
): TaskWithRelations['list_item_links'][number] {
  return {
    law_list_item: {
      id,
      document: { title, document_number: documentNumber },
      law_list: { id: 'list-1', name: listName },
    },
  }
}

function mk(p: {
  id: string
  title: string
  description?: string | null
  col: keyof typeof COL
  priority: TaskWithRelations['priority']
  due?: string | null
  ownerId: string | null
  created: string
  comments?: number
  links?: TaskWithRelations['list_item_links']
}): TaskWithRelations {
  const c = COL[p.col]
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    column_id: c.id,
    position: 0,
    priority: p.priority,
    due_date: p.due ? D(p.due) : null,
    assignee_id: p.ownerId,
    created_by: 'u-anna',
    created_at: D(p.created),
    updated_at: D('2026-05-01'),
    completed_at: p.col === 'done' ? D('2026-04-20') : null,
    workspace_id: WS,
    column: c,
    assignee: assignee(p.ownerId),
    creator: {
      id: 'u-anna',
      name: 'Anna Lindqvist',
      email: 'anna@nordviken.se',
    },
    list_item_links: p.links ?? [],
    _count: { comments: p.comments ?? 0 },
  }
}

export const TASKS: TaskWithRelations[] = [
  mk({
    id: 't-1',
    title: 'Uppdatera rutin för serveringspersonal',
    description:
      'Alkohollagen kräver dokumenterade rutiner för ansvarsfull servering. Revidera och låt personalen kvittera.',
    col: 'doing',
    priority: 'HIGH',
    due: '2026-05-20',
    ownerId: 'u-anna',
    created: '2026-04-02',
    comments: 3,
    links: [
      link(
        'li-1',
        'Alkohollag (2010:1622)',
        'SFS 2010:1622',
        'Restaurang & servering'
      ),
    ],
  }),
  mk({
    id: 't-2',
    title: 'Genomför skyddsrond Q2',
    description: 'Årlig skyddsrond enligt det systematiska arbetsmiljöarbetet.',
    col: 'todo',
    priority: 'MEDIUM',
    due: '2026-06-10',
    ownerId: 'u-sofia',
    created: '2026-04-10',
    comments: 1,
    links: [
      link(
        'li-2',
        'Arbetsmiljölagen',
        'SFS 1977:1160',
        'Arbetsmiljö & personal'
      ),
    ],
  }),
  mk({
    id: 't-3',
    title: 'Upprätta register över personuppgiftsbehandlingar',
    col: 'todo',
    priority: 'CRITICAL',
    due: '2026-05-15',
    ownerId: 'u-johan',
    created: '2026-03-28',
    links: [link('li-3', 'GDPR', 'EU 2016/679', 'Dataskydd')],
  }),
  mk({
    id: 't-4',
    title: 'Kontrollera temperaturloggar i kyl & frys',
    description: 'Egenkontroll livsmedel — veckovis avläsning.',
    col: 'doing',
    priority: 'MEDIUM',
    due: '2026-05-12',
    ownerId: 'u-erik',
    created: '2026-04-22',
    comments: 2,
  }),
  mk({
    id: 't-5',
    title: 'Boka brandskyddsutbildning för ny personal',
    col: 'done',
    priority: 'LOW',
    ownerId: 'u-maria',
    created: '2026-03-05',
  }),
  mk({
    id: 't-6',
    title: 'Dokumentera systematiskt brandskyddsarbete (SBA)',
    col: 'done',
    priority: 'HIGH',
    ownerId: 'u-anna',
    created: '2026-02-18',
    comments: 4,
  }),
]
