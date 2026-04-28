/**
 * Shared Swedish copy for read-only cycle states.
 * Consumers: cycle-items-tab, cycle-item-modal/right-panel,
 * complete-cycle-dialog. Findings stay editable through AVSLUTAD post 21.27;
 * only items lock at AVSLUTAD.
 */

import { ComplianceCycleStatus } from '@prisma/client'

export function getCycleReadOnlyReason(
  status: ComplianceCycleStatus
): string | null {
  // Story 21.26 — SEALED case removed alongside the SEAL collapse.
  // Story 21.27 — ARKIVERAD case removed alongside the ARKIVERAD collapse.
  // AVSLUTAD is the only terminal active state; revert is the escape hatch.
  if (status === ComplianceCycleStatus.AVSLUTAD) {
    return 'Kontrollen är avslutad. Återställ till pågående för att redigera.'
  }
  return null
}
