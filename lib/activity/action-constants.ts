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
  'compliance_actions_updated',

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
] as const

export type KnownAction = (typeof KNOWN_ACTIONS)[number]
