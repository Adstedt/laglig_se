/**
 * Badge tone × variant token map and per-domain status mappers.
 *
 * Single source of truth for status / priority / severity / type pill
 * appearance across the workspace. Consumed by `components/ui/badge.tsx`
 * (cva compound variants) and by domain components via the
 * `getStatusBadgeProps` / `getPriorityBadgeProps` helpers.
 *
 * Story 22.1 — UI Primitives Alignment.
 *
 * Class strings target the dark theme (the active theme today). Light
 * analogues are tracked in BADGE_TONES_LIGHT for future-use; no surface
 * renders in light mode today, so the active map is BADGE_TONES.
 */

export const TONES = [
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
] as const
export type Tone = (typeof TONES)[number]

export const VARIANTS = ['soft', 'solid', 'outline'] as const
export type Variant = (typeof VARIANTS)[number]

/**
 * Dual-theme tone × variant class strings. Each cell combines the light-
 * theme defaults (high-contrast `-100`/`-700` pairs) with `dark:` overrides
 * (low-opacity tinted bg + `-300` text) so a single Badge renders correctly
 * in both themes without consumer awareness.
 *
 * Tailwind JIT requires literal full class names — do NOT construct these
 * at runtime.
 *
 * `soft` (default): low-contrast tinted background, suitable for inline
 *   table-cell pills. Reads as "this is a status, not a button".
 * `solid`: high-contrast saturated background, reserved for terminal /
 *   final states (SEALED, KRITISK) — visually shouts "this is locked".
 * `outline`: bordered, transparent background. Use for "secondary signal"
 *   readings (open/closed state, not-applicable) where the row's primary
 *   identifier lives elsewhere.
 *
 * Story 22.1 v0.2 — initial release shipped dark-only classes which left
 * pills illegible in light theme (`text-{tone}-300` on white → poor AA
 * contrast). Now dual-theme via `dark:` prefix.
 */
export const BADGE_TONES: Record<Tone, Record<Variant, string>> = {
  neutral: {
    soft: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    solid: 'bg-slate-500 text-white dark:bg-slate-500 dark:text-white',
    outline:
      'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300',
  },
  info: {
    soft: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    solid: 'bg-blue-500 text-white dark:bg-blue-500 dark:text-white',
    outline:
      'border border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300',
  },
  success: {
    soft: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    solid: 'bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white',
    outline:
      'border border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
  },
  warning: {
    soft: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    // amber-500 needs dark text for AA contrast in both themes
    solid: 'bg-amber-500 text-amber-950 dark:bg-amber-500 dark:text-amber-950',
    outline:
      'border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300',
  },
  danger: {
    soft: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    solid: 'bg-rose-500 text-white dark:bg-rose-500 dark:text-white',
    outline:
      'border border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300',
  },
}

// ---------------------------------------------------------------------------
// Domain → (tone, variant, label) mappers
// ---------------------------------------------------------------------------

export const STATUS_DOMAINS = [
  'compliance-status',
  'cycle-status',
  'document-status',
  'finding-severity',
  'finding-type',
] as const
export type StatusDomain = (typeof STATUS_DOMAINS)[number]

export interface BadgeProps {
  tone: Tone
  variant: Variant
  label: string
}

// Prisma `ComplianceStatus` enum: 5 values. Story 6.16 relabelled PAGAENDE
// from "Pågående" to "Delvis uppfylld" in the compliance-status context;
// cycle-status PAGAENDE retains the original "Pågående" label.
const COMPLIANCE_STATUS_MAP: Record<string, BadgeProps> = {
  EJ_PABORJAD: { tone: 'neutral', variant: 'soft', label: 'Ej påbörjad' },
  PAGAENDE: { tone: 'info', variant: 'soft', label: 'Delvis uppfylld' },
  UPPFYLLD: { tone: 'success', variant: 'soft', label: 'Uppfylld' },
  EJ_UPPFYLLD: { tone: 'danger', variant: 'soft', label: 'Ej uppfylld' },
  // Outline treatment distinguishes "intentionally not applicable" from
  // "not started" while sharing the neutral tone.
  EJ_TILLAMPLIG: {
    tone: 'neutral',
    variant: 'outline',
    label: 'Ej tillämplig',
  },
}

const CYCLE_STATUS_MAP: Record<string, BadgeProps> = {
  PLANERAD: { tone: 'neutral', variant: 'soft', label: 'Planerad' },
  PAGAENDE: { tone: 'info', variant: 'soft', label: 'Pågående' },
  AVSLUTAD: { tone: 'success', variant: 'soft', label: 'Avslutad' },
  // Legacy SEALED / ARKIVERAD retained as defensive fallbacks for any
  // pre-21.26-collapse historical row that survives in DB / join tables.
  // Solid signals "locked / final" for the rare SEALED case if it surfaces.
  SEALED: { tone: 'success', variant: 'solid', label: 'Fastställd' },
  ARKIVERAD: { tone: 'neutral', variant: 'outline', label: 'Arkiverad' },
}

const DOCUMENT_STATUS_MAP: Record<string, BadgeProps> = {
  DRAFT: { tone: 'neutral', variant: 'soft', label: 'Utkast' },
  IN_REVIEW: { tone: 'info', variant: 'soft', label: 'Under granskning' },
  APPROVED: { tone: 'success', variant: 'soft', label: 'Godkänd' },
  SUPERSEDED: { tone: 'neutral', variant: 'outline', label: 'Ersatt' },
  ARCHIVED: { tone: 'neutral', variant: 'outline', label: 'Arkiverad' },
}

// Prisma `FindingSeverity` enum is MAJOR | MINOR. Swedish display labels
// "Större" / "Mindre" come from `FINDING_SEVERITY_LABELS` in
// `components/features/compliance-audit/finding-copy.ts`.
const FINDING_SEVERITY_MAP: Record<string, BadgeProps> = {
  MAJOR: { tone: 'danger', variant: 'soft', label: 'Större' },
  MINOR: { tone: 'warning', variant: 'soft', label: 'Mindre' },
}

const FINDING_TYPE_MAP: Record<string, BadgeProps> = {
  AVVIKELSE: { tone: 'danger', variant: 'soft', label: 'Avvikelse' },
  OBSERVATION: { tone: 'warning', variant: 'soft', label: 'Observation' },
  FORBATTRING: {
    tone: 'info',
    variant: 'soft',
    label: 'Förbättringsförslag',
  },
}

const STATUS_DOMAIN_MAPS: Record<StatusDomain, Record<string, BadgeProps>> = {
  'compliance-status': COMPLIANCE_STATUS_MAP,
  'cycle-status': CYCLE_STATUS_MAP,
  'document-status': DOCUMENT_STATUS_MAP,
  'finding-severity': FINDING_SEVERITY_MAP,
  'finding-type': FINDING_TYPE_MAP,
}

/**
 * Resolve `{ tone, variant, label }` for a given status domain + enum value.
 *
 * Returns a neutral-soft fallback (with the raw value as label) for
 * unknown enum keys — defensive against legacy / future enum additions.
 * Logs a warning in development to surface gaps without breaking renders.
 */
export function getStatusBadgeProps(
  domain: StatusDomain,
  value: string
): BadgeProps {
  const map = STATUS_DOMAIN_MAPS[domain]
  const props = map[value]
  if (props) return props
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `[badge-tones] Unknown ${domain} value "${value}" — falling back to neutral.`
    )
  }
  return { tone: 'neutral', variant: 'soft', label: value }
}

/**
 * Priority enum spans two domains:
 *  - LawListItemPriority (DB): LOW | MEDIUM | HIGH (Laglistor)
 *  - TaskPriority (DB): LOW | MEDIUM | HIGH | CRITICAL (Uppgifter)
 *
 * Both share LOW / MEDIUM / HIGH cells; CRITICAL is Tasks-only and uses the
 * solid danger treatment to differentiate from the soft-danger HIGH.
 *
 * The DB enums stay English; only display labels are Swedish ("Medel"
 * replaces the legacy "Medium" leak the audit flagged on Uppgifter).
 */
const PRIORITY_MAP: Record<string, BadgeProps> = {
  CRITICAL: { tone: 'danger', variant: 'solid', label: 'Kritisk' },
  HIGH: { tone: 'danger', variant: 'soft', label: 'Hög' },
  MEDIUM: { tone: 'warning', variant: 'soft', label: 'Medel' },
  LOW: { tone: 'neutral', variant: 'soft', label: 'Låg' },
}

export type PriorityValue = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * Resolve `{ tone, variant, label }` for a Priority enum value. Single
 * mapping shared by Laglistor (LOW/MEDIUM/HIGH) and Uppgifter
 * (LOW/MEDIUM/HIGH/CRITICAL).
 */
export function getPriorityBadgeProps(value: PriorityValue): BadgeProps {
  return PRIORITY_MAP[value]!
}
