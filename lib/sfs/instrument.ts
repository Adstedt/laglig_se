/**
 * SFS Instrument Inference (Story 2.32)
 *
 * Maps a document title to its SFS instrument subtype (LAG / FORORDNING /
 * KUNGORELSE / OTHER). Reuses the title classifier in ./classify.ts and
 * applies a confidence threshold so ambiguous titles stay OTHER rather than
 * getting mislabeled.
 *
 * Used by:
 *   - SFS sync write paths (scripts/sync-sfs.ts, scripts/ingest-sfs-laws.ts)
 *   - Amendment ingestion (lib/sfs/amendment-to-legal-document.ts)
 *   - One-shot backfill script (scripts/backfill-sfs-instrument.ts)
 */
import { SfsInstrument } from '@prisma/client'
import { classifyLawType } from './classify'

/** Below this score, the classifier's verdict is treated as too uncertain. */
const CONFIDENCE_THRESHOLD = 0.9

/**
 * Infer the SFS instrument subtype for a document title.
 *
 * Returns OTHER for empty/non-string input, low-confidence classifications,
 * or types outside the LAG/FORORDNING/KUNGORELSE set.
 */
export function inferSfsInstrument(title: string): SfsInstrument {
  const { type, confidence } = classifyLawType(title)
  if (confidence < CONFIDENCE_THRESHOLD) return SfsInstrument.OTHER
  switch (type) {
    case 'lag':
      return SfsInstrument.LAG
    case 'förordning':
      return SfsInstrument.FORORDNING
    case 'kungörelse':
      return SfsInstrument.KUNGORELSE
    default:
      return SfsInstrument.OTHER
  }
}
