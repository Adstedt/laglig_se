/**
 * Story 6.10: Activity Action Labels
 * Shared Swedish labels for activity log actions and entity types.
 *
 * The workspace activity log renders full Swedish sentences via
 * `lib/activity/format-activity.ts` and no longer relies on this lookup.
 * HistoryTab (task modal, legal-document-modal) still falls back here, so
 * every known action needs a label entry.
 */

/** Combined action labels for both task and list item entities */
export const ACTION_LABELS: Record<string, string> = {
  // List item actions
  status_changed: 'ändrade efterlevnadsstatus',
  responsible_changed: 'ändrade ansvarig',
  business_context_updated: 'uppdaterade affärskontext',
  compliance_narrative_updated: 'uppdaterade efterlevnadsbeskrivning',
  priority_changed: 'ändrade prioritet',
  comment_added: 'lade till en kommentar',
  comment_updated: 'redigerade en kommentar',
  comment_deleted: 'raderade en kommentar',
  evidence_uploaded: 'laddade upp bevis',
  evidence_deleted: 'raderade bevis',
  task_linked: 'länkade en uppgift',
  task_unlinked: 'tog bort en uppgiftslänk',
  created: 'skapade',

  // Task actions
  title_updated: 'ändrade titel',
  description_updated: 'uppdaterade beskrivning',
  status_updated: 'ändrade status',
  assignee_updated: 'ändrade ansvarig',
  due_date_updated: 'ändrade förfallodatum',
  priority_updated: 'ändrade prioritet',
  labels_updated: 'uppdaterade etiketter',
  law_linked: 'länkade en lag',
  law_unlinked: 'tog bort en lag-länk',
  deleted: 'raderade',

  // Document actions (Epic 17)
  document_created: 'skapade dokument',
  document_version_saved: 'sparade en ny version',
  document_draft_edited: 'justerade utkastet',
  document_version_restored: 'återställde version',
  document_status_changed: 'ändrade dokumentstatus',
  document_imported: 'importerade dokument',
  document_linked_to_task: 'kopplade dokument till uppgift',
  document_linked_to_list_item: 'kopplade dokument till laglistpost',
  document_unlinked_from_task: 'tog bort dokumentkoppling från uppgift',
  document_unlinked_from_list_item:
    'tog bort dokumentkoppling från laglistpost',

  // Requirement / kravpunkter actions (Story 17.16)
  requirement_created: 'skapade en kravpunkt',
  requirement_deleted: 'raderade en kravpunkt',
  requirement_text_updated: 'ändrade text på kravpunkt',
  requirement_marked_fulfilled: 'markerade kravpunkt som uppfylld',
  requirement_marked_unfulfilled: 'markerade kravpunkt som ej uppfylld',
  requirement_marked_bevis_required: 'krävde bevis på kravpunkt',
  requirement_marked_bevis_optional: 'gjorde bevis valfritt på kravpunkt',
  requirement_evidence_linked: 'kopplade bevis till kravpunkt',
  requirement_evidence_unlinked: 'tog bort bevis från kravpunkt',

  // Notifications
  notification_sent: 'skickade notis',
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  list_item: 'Lagpost',
  task: 'Uppgift',
  comment: 'Kommentar',
  evidence: 'Bevis',
  workspace_document: 'Styrdokument',
  requirement: 'Kravpunkt',
  email: 'E-post',
}
