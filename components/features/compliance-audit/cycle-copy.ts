/**
 * Shared Swedish copy for read-only cycle states.
 * Consumers: cycle-items-tab, cycle-item-modal/right-panel, cycle-findings-tab,
 * complete-cycle-dialog. Keeps "Avslutad" / "Fastställd" / "Arkiverad" copy
 * accurate per status — auditors see WHY a cycle is locked, not a generic message.
 */

import { ComplianceCycleStatus } from '@prisma/client'

export function getCycleReadOnlyReason(
  status: ComplianceCycleStatus
): string | null {
  switch (status) {
    case ComplianceCycleStatus.AVSLUTAD:
      return 'Kontrollen är avslutad. Återställ till pågående för att redigera.'
    case ComplianceCycleStatus.SEALED:
      return 'Kontrollen är fastställd och kan inte längre ändras.'
    case ComplianceCycleStatus.ARKIVERAD:
      return 'Kontrollen är arkiverad och kan inte längre ändras.'
    default:
      return null
  }
}
