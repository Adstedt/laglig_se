/**
 * Story 14.21: Anthropic Web Search — domain whitelist + tool factory
 *
 * The whitelist restricts web_search to authoritative Swedish legal sources.
 * Kept as a named constant for easy review and PR discussion.
 */

import { anthropic } from '@ai-sdk/anthropic'

// ---------------------------------------------------------------------------
// Domain whitelist
// ---------------------------------------------------------------------------

/** Authoritative Swedish legal domains for web search. */
export const SWEDISH_LEGAL_WEB_DOMAINS: readonly string[] = [
  // Primary sources (law text + official)
  'lagen.nu',
  'riksdagen.se',
  'regeringen.se',
  'domstol.se',
  'arbetsdomstolen.se',

  // Agencies (interpretation + guidance)
  'arbetsmiljoverket.se',
  'imy.se',
  'skatteverket.se',
  'bolagsverket.se',
  'konkurrensverket.se',
  'naturvardsverket.se',
  'energimyndigheten.se',
  'livsmedelsverket.se',
  'lakemedelsverket.se',

  // EU (directly applicable)
  'eur-lex.europa.eu',
  'edpb.europa.eu',

  // Kollektivavtal + labor
  'unionen.se',
  'saco.se',
  'lo.se',
  'ledarna.se',
  'svensktnaringsliv.se',
  'almega.se',

  // Industry associations
  'teknikforetagen.se',
  'byggforetagen.se',
  'livsmedelsforetagen.se',
  'visita.se',

  // Legal commentary (secondary — prompt frames as interpretation, not law)
  'mannheimerswartling.se',
  'vinge.se',
  'setterwalls.se',
  'delphi.se',
  'cirio.se',
  'lindahl.se',
  'advokatsamfundet.se',
  'foretagarna.se',
] as const

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

/**
 * Creates the Anthropic web search tool configured for Swedish legal research.
 * Only used on the Anthropic model path.
 */
export function createWebSearchTool() {
  return anthropic.tools.webSearch_20250305({
    allowedDomains: [...SWEDISH_LEGAL_WEB_DOMAINS],
    maxUses: 5,
    userLocation: {
      type: 'approximate',
      country: 'SE',
      timezone: 'Europe/Stockholm',
    },
  })
}
