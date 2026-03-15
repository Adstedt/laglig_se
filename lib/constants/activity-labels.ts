/**
 * Story 6.10: Activity Action Labels
 * Shared Swedish labels for activity log actions and entity types
 */

/** Combined action labels for both task and list item entities */
export const ACTION_LABELS: Record<string, string> = {
  // List item actions
  status_changed: 'ändrade efterlevnadsstatus',
  responsible_changed: 'ändrade ansvarig',
  business_context_updated: 'uppdaterade affärskontext',
  compliance_actions_updated: 'uppdaterade efterlevnadsåtgärder',
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
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  list_item: 'Lagpost',
  task: 'Uppgift',
  comment: 'Kommentar',
  evidence: 'Bevis',
}
