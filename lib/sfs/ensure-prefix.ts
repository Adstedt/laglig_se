/** Ensure SFS number has "SFS " prefix (idempotent) */
export function ensureSfsPrefix(sfsNumber: string): string {
  return sfsNumber.startsWith('SFS ') ? sfsNumber : `SFS ${sfsNumber}`
}
