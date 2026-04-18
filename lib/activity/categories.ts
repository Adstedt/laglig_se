import type { LucideIcon } from 'lucide-react'
import { Bell, Link2, Pencil, PlusCircle, Shield } from 'lucide-react'
import { KNOWN_ACTIONS, type KnownAction } from './action-constants'
import type { ActivityCategory } from './types'

export const ACTION_TO_CATEGORY: Record<KnownAction, ActivityCategory> = {
  // kopplingar
  law_linked: 'kopplingar',
  law_unlinked: 'kopplingar',
  task_linked: 'kopplingar',
  task_unlinked: 'kopplingar',
  document_linked_to_task: 'kopplingar',
  document_linked_to_list_item: 'kopplingar',
  document_unlinked_from_task: 'kopplingar',
  document_unlinked_from_list_item: 'kopplingar',
  requirement_evidence_linked: 'kopplingar',
  requirement_evidence_unlinked: 'kopplingar',

  // andringar
  status_changed: 'andringar',
  status_updated: 'andringar',
  priority_changed: 'andringar',
  priority_updated: 'andringar',
  responsible_changed: 'andringar',
  assignee_updated: 'andringar',
  due_date_updated: 'andringar',
  title_updated: 'andringar',
  description_updated: 'andringar',
  labels_updated: 'andringar',
  business_context_updated: 'andringar',
  compliance_actions_updated: 'andringar',
  document_status_changed: 'andringar',
  document_version_saved: 'andringar',
  document_version_restored: 'andringar',
  requirement_text_updated: 'andringar',
  requirement_marked_fulfilled: 'andringar',
  requirement_marked_unfulfilled: 'andringar',
  requirement_marked_bevis_required: 'andringar',
  requirement_marked_bevis_optional: 'andringar',

  // livscykel
  created: 'livscykel',
  deleted: 'livscykel',
  comment_added: 'livscykel',
  comment_updated: 'livscykel',
  comment_deleted: 'livscykel',
  evidence_uploaded: 'livscykel',
  evidence_deleted: 'livscykel',
  document_created: 'livscykel',
  document_imported: 'livscykel',
  requirement_created: 'livscykel',
  requirement_deleted: 'livscykel',

  // notifikationer
  notification_sent: 'notifikationer',
}

export const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; icon: LucideIcon; badgeClass: string }
> = {
  kopplingar: {
    label: 'Kopplingar',
    icon: Link2,
    badgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  },
  andringar: {
    label: 'Ändringar',
    icon: Pencil,
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  },
  livscykel: {
    label: 'Livscykel',
    icon: PlusCircle,
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  },
  notifikationer: {
    label: 'Notifikationer',
    icon: Bell,
    badgeClass:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
  },
  behorigheter: {
    label: 'Behörigheter',
    icon: Shield,
    badgeClass:
      'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
  },
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  'kopplingar',
  'andringar',
  'livscykel',
  'notifikationer',
  'behorigheter',
]

export function categoryForAction(action: string): ActivityCategory {
  const known = ACTION_TO_CATEGORY[action as KnownAction]
  return known ?? 'andringar'
}

export function actionsForCategory(category: ActivityCategory): string[] {
  return KNOWN_ACTIONS.filter((a) => ACTION_TO_CATEGORY[a] === category)
}
