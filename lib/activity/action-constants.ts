/**
 * Every known activity action string, collected here so the category map and
 * the formatter stay in sync. Adding a new action without entry here is
 * caught by the exhaustiveness test in lib/activity/categories.test.ts.
 */

export const KNOWN_ACTIONS = [
  // Task lifecycle
  'created',
  'deleted',
  'title_updated',
  'description_updated',
  'status_updated',
  'assignee_updated',
  'due_date_updated',
  'priority_updated',
  'labels_updated',
  'law_linked',
  'law_unlinked',

  // List-item compliance
  'status_changed',
  'responsible_changed',
  'priority_changed',
  'business_context_updated',
  'compliance_narrative_updated',

  // Comments (shared across task and list_item)
  'comment_added',
  'comment_updated',
  'comment_deleted',

  // Evidence (not currently written but reserved in legacy labels)
  'evidence_uploaded',
  'evidence_deleted',

  // Task↔List item reverse links (reserved in legacy labels)
  'task_linked',
  'task_unlinked',

  // Requirement / kravpunkter
  'requirement_created',
  'requirement_deleted',
  'requirement_text_updated',
  'requirement_marked_fulfilled',
  'requirement_marked_unfulfilled',
  'requirement_marked_bevis_required',
  'requirement_marked_bevis_optional',
  'requirement_evidence_linked',
  'requirement_evidence_unlinked',

  // Workspace documents
  'document_created',
  'document_imported',
  'document_version_saved',
  'document_version_restored',
  'document_status_changed',
  'document_linked_to_task',
  'document_linked_to_list_item',
  'document_unlinked_from_task',
  'document_unlinked_from_list_item',

  // Email / notifications
  'notification_sent',

  // Compliance-audit cycle (Epic 21 — Stories 21.2 + 21.5)
  'cycle_created',
  'cycle_metadata_updated',
  'cycle_soft_deleted',
  'cycle_materialised',
  'cycle_item_bedomning_updated',
  'cycle_item_motivering_updated',
  'cycle_item_signed_off',
  'cycle_item_unsigned',

  // Story 21.6 — cycle lifecycle transitions
  'cycle_completed',
  'cycle_reverted_to_pagaende',

  // Story 21.9 — seal
  'cycle_sealed',

  // Story 21.12 — revisionsrapport PDF generation
  'cycle_report_generated',

  // Compliance-audit findings (Epic 21 — Story 21.7)
  'finding_created',
  'finding_updated',
  'finding_closed',
  'finding_reopened',

  // Compliance-audit findings — corrective-action task loop (Epic 21 — Story 21.8)
  'finding_task_spawned',
  'finding_task_completed',
  'finding_task_completion_notified',

  // Compliance-audit findings — verify step (Epic 21 follow-up)
  'finding_verified',

  // Trial expiration lifecycle (Story 5.13)
  'trial_expired',
  'trial_paused',
  'trial_workspace_deleted',
  'trial_converted',
  'workspace_reactivated_from_trial_pause',

  // Epic 24 — Import existing law list (Story 24.1: only create + commit;
  // per-row events are added in subsequent stories)
  'law_list_import.created',
  'law_list_import.committed',

  // Story 24.3 — matching engine lifecycle
  'law_list_import.matching_started',
  'law_list_import.matching_completed',
  'law_list_import.matching_failed',

  // Story 24.4 — review-surface per-row decisions + batch + commit
  'law_list_import.row_accepted',
  'law_list_import.row_replaced',
  'law_list_import.row_rejected',
  'law_list_import.row_catalog_requested',
  'law_list_import.row_decision_undone',
  'law_list_import.bulk_accepted_high',
  // Banner cancel action — hard-deletes an in-flight import (24.x follow-up)
  'law_list_import.discarded',

  // Story 24.7 — LLM-suggested groupings on the granska page
  'law_list_import.groupings_proposed',

  // Story 24.5 — catalog-requests admin queue
  'catalog_request.fulfilled',
  'catalog_request.rejected',
] as const

export type KnownAction = (typeof KNOWN_ACTIONS)[number]
