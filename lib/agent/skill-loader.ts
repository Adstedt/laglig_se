/**
 * Story 19.6: runtime skill loader (pure, manifest-based).
 *
 * Reads skills from the build-time manifest (lib/agent/skills.generated.ts,
 * produced by scripts/generate-skills-manifest.ts and wired into `prebuild`).
 * NO filesystem access: the previous runtime fs scan of lib/agent/skills/ used
 * dynamic `readdirSync`/`readFileSync` paths the Turbopack/nft bundlers could
 * not statically trace, which emitted a build warning and widened the /api/chat
 * trace to the whole repo (~16.5k files). The fs scan + body assembly now live
 * in lib/agent/skill-fs.ts (build/test only); this module just reads the
 * inlined result, so the runtime import graph is `fs`-free.
 *
 * Public API mirrors the former fs loader, minus the `baseDir` test hook
 * (callers in app/ + lib/ never passed one). Tests exercise the fs scanner
 * directly via skill-fs.ts.
 */

import { SKILLS_MANIFEST } from './skills.generated'
import type { SkillContextType, SkillMeta } from './skill-schema'

export { skillFrontmatterSchema } from './skill-schema'
export type { SkillContextType, SkillMeta } from './skill-schema'

// The manifest is generated sorted-by-name (drives the deterministic
// getPrimarySkillForContext tie-break). Freeze defensively.
const METAS: readonly SkillMeta[] = Object.freeze(
  SKILLS_MANIFEST.map((s) => Object.freeze({ ...s.meta }))
)
const BODIES: ReadonlyMap<string, string> = new Map(
  SKILLS_MANIFEST.map((s) => [s.meta.name, s.body])
)

/** No-op kept for API compatibility — the manifest is static. */
export function clearSkillCache(): void {}

/** All skills' metadata (frozen, sorted by name). */
export function listSkills(): readonly SkillMeta[] {
  return METAS
}

/** A skill's fully-assembled body, or `null` for an unknown skill. */
export function loadSkill(name: string): string | null {
  return BODIES.get(name) ?? null
}

/** The skill's declared tool whitelist (`[]` for none / unknown skill). */
export function getSkillToolWhitelist(name: string): string[] {
  const meta = METAS.find((s) => s.name === name)
  return meta ? [...meta.tools] : []
}

/**
 * The skill that is primary for a chat context (its `contextTypes` includes it),
 * or `null`. On multiple matches, the first by sorted name (deterministic) + warn.
 */
export function getPrimarySkillForContext(
  contextType: SkillContextType | undefined
): string | null {
  if (!contextType) return null
  const matches = METAS.filter((s) => s.contextTypes.includes(contextType))
  if (matches.length === 0) return null
  if (matches.length > 1) {
    console.warn(
      `[skill-loader] Multiple skills claim contextType "${contextType}": ${matches
        .map((m) => m.name)
        .join(', ')} — using "${matches[0]!.name}"`
    )
  }
  return matches[0]!.name
}
