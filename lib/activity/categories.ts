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
  compliance_narrative_updated: 'andringar',
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

  // compliance-audit cycle (Epic 21)
  cycle_created: 'livscykel',
  cycle_metadata_updated: 'andringar',
  cycle_soft_deleted: 'livscykel',
  cycle_materialised: 'livscykel',
  cycle_item_bedomning_updated: 'andringar',
  cycle_item_motivering_updated: 'andringar',
  cycle_item_signed_off: 'andringar',
  cycle_item_unsigned: 'andringar',

  // Story 21.6 — cycle lifecycle transitions
  cycle_completed: 'livscykel',
  cycle_reverted_to_pagaende: 'livscykel',

  // Story 21.9 — seal
  cycle_sealed: 'livscykel',

  // Story 21.12 — revisionsrapport PDF generation
  cycle_report_generated: 'livscykel',

  // compliance-audit findings (Epic 21)
  finding_created: 'livscykel',
  finding_updated: 'andringar',
  finding_closed: 'livscykel',
  finding_reopened: 'livscykel',

  // compliance-audit findings — corrective-action task loop (Epic 21 — Story 21.8)
  finding_task_spawned: 'kopplingar',
  finding_task_completed: 'livscykel',
  finding_task_completion_notified: 'notifikationer',

  // compliance-audit findings — verify step (Epic 21 follow-up)
  finding_verified: 'livscykel',

  // Trial expiration lifecycle (Story 5.13)
  trial_expired: 'livscykel',
  trial_paused: 'livscykel',
  trial_workspace_deleted: 'livscykel',
  trial_converted: 'livscykel',
  workspace_reactivated_from_trial_pause: 'livscykel',

  // Epic 24 — Import existing law list (Story 24.1)
  'law_list_import.created': 'livscykel',
  'law_list_import.committed': 'livscykel',
  // Story 24.3 — matching lifecycle
  'law_list_import.matching_started': 'livscykel',
  'law_list_import.matching_completed': 'livscykel',
  'law_list_import.matching_failed': 'livscykel',

  // Story 24.4 — review-surface per-row decisions
  'law_list_import.row_accepted': 'andringar',
  'law_list_import.row_replaced': 'andringar',
  'law_list_import.row_rejected': 'andringar',
  'law_list_import.row_catalog_requested': 'kopplingar',
  'law_list_import.row_decision_undone': 'andringar',
  'law_list_import.bulk_accepted_high': 'andringar',
  // Discard is a lifecycle event (terminates the import)
  'law_list_import.discarded': 'livscykel',
  // Story 24.7 — AI-suggested groupings on the granska commit dialog.
  // Surfaced as an "andringar" event because it represents a user-visible
  // proposal the dev/QA can replay from the activity feed.
  'law_list_import.groupings_proposed': 'andringar',

  // Story 24.5 — catalog-requests admin queue (ops fulfilment loop)
  'catalog_request.fulfilled': 'livscykel',
  'catalog_request.rejected': 'livscykel',
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
