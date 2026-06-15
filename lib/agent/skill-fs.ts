/**
 * Story 19.6: filesystem-based skill scanner — BUILD + TEST ONLY.
 *
 * This module reads `lib/agent/skills/` from disk (dynamic `readdirSync` /
 * `readFileSync` paths). It is deliberately NOT imported by any `app/` or
 * `lib/` runtime code — only by:
 *   - scripts/generate-skills-manifest.ts  (build-time manifest generation)
 *   - tests/unit/agent/skill-loader.test.ts (fixture-driven unit tests)
 *
 * Keeping the dynamic-path filesystem access out of the runtime import graph is
 * what lets the Turbopack/nft bundlers trace /api/chat without widening to the
 * whole repo. The runtime loader (skill-loader.ts) reads the generated manifest
 * instead and never touches `fs`.
 *
 * A skill is a subdirectory of `baseDir` containing a `SKILL.md` (YAML
 * frontmatter + body) plus optional PROCEDURE.md / STYLE.md / CRITERIA.md and
 * a `types/` dir of per-type `.md` modules.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve, join } from 'path'
import matter from 'gray-matter'
import {
  skillFrontmatterSchema,
  type GeneratedSkill,
  type SkillContextType,
  type SkillMeta,
} from './skill-schema'

const DEFAULT_BASE_DIR = 'lib/agent/skills'

interface SkillRecord {
  meta: SkillMeta
  dir: string
}

interface CacheEntry {
  records: SkillRecord[]
  metas: readonly SkillMeta[]
}

// Read + validate once per resolved baseDir.
const cache = new Map<string, CacheEntry>()

/** Test hook: drop the per-baseDir cache so a fresh scan runs next call. */
export function clearSkillCache(): void {
  cache.clear()
}

/** Companion files appended (in order) to the assembled skill body. */
const COMPANIONS: ReadonlyArray<readonly [file: string, header: string]> = [
  ['PROCEDURE.md', 'Procedure'],
  ['STYLE.md', 'Style'],
  ['CRITERIA.md', 'Criteria'],
]

function loadRecords(baseDir?: string): CacheEntry {
  const base = resolve(process.cwd(), baseDir ?? DEFAULT_BASE_DIR)
  const cached = cache.get(base)
  if (cached) return cached

  const records: SkillRecord[] = []
  if (existsSync(base)) {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      // Ignore loose files (e.g. generate-law-list.ts) — skills are directories.
      if (!entry.isDirectory()) continue
      // Skip authoring templates / examples.
      if (entry.name.startsWith('_')) continue

      const dir = join(base, entry.name)
      const skillMd = join(dir, 'SKILL.md')
      // A subdirectory without a SKILL.md is not a skill.
      if (!existsSync(skillMd)) continue

      let frontmatter: unknown
      try {
        frontmatter = matter(readFileSync(skillMd, 'utf-8')).data
      } catch (err) {
        console.warn(`[skill-fs] Could not parse ${skillMd}:`, err)
        continue
      }

      const parsed = skillFrontmatterSchema.safeParse(frontmatter)
      if (!parsed.success) {
        console.warn(
          `[skill-fs] Invalid frontmatter in ${skillMd}: ${parsed.error.issues[0]?.message ?? 'schema error'} — skipped`
        )
        continue
      }
      if (parsed.data.name !== entry.name) {
        console.warn(
          `[skill-fs] Skill name "${parsed.data.name}" does not match directory "${entry.name}" — skipped`
        )
        continue
      }

      records.push({ meta: parsed.data, dir })
    }
  }

  // Deterministic order (drives getPrimarySkillForContext multi-match tie-break).
  records.sort((a, b) => a.meta.name.localeCompare(b.meta.name))

  const metas = Object.freeze(records.map((r) => Object.freeze({ ...r.meta })))
  const entry: CacheEntry = { records, metas }
  cache.set(base, entry)
  return entry
}

/** All valid skills' metadata (frozen, cached, sorted by name). */
export function listSkills(baseDir?: string): readonly SkillMeta[] {
  return loadRecords(baseDir).metas
}

/**
 * Assemble a skill's body: the SKILL.md body + each present companion
 * (PROCEDURE / STYLE / CRITERIA) under a `## ` header, then — Story 19.8 —
 * any `types/*.md` modules under `### Type: <stem>` sub-headers inside a
 * `## Type modules` section. `null` if unknown.
 */
export function loadSkill(name: string, baseDir?: string): string | null {
  const rec = loadRecords(baseDir).records.find((r) => r.meta.name === name)
  if (!rec) return null

  const parts: string[] = []
  const body = matter(
    readFileSync(join(rec.dir, 'SKILL.md'), 'utf-8')
  ).content.trim()
  if (body) parts.push(body)

  for (const [file, header] of COMPANIONS) {
    const p = join(rec.dir, file)
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf-8').trim()
    if (content) parts.push(`## ${header}\n\n${content}`)
  }

  // Story 19.8: per-type modules, sorted for deterministic assembly.
  const typesDir = join(rec.dir, 'types')
  if (existsSync(typesDir)) {
    const modules: string[] = []
    for (const f of readdirSync(typesDir).sort()) {
      if (!f.endsWith('.md')) continue
      const content = readFileSync(join(typesDir, f), 'utf-8').trim()
      if (content) modules.push(`### Type: ${f.slice(0, -3)}\n\n${content}`)
    }
    if (modules.length > 0) {
      parts.push(`## Type modules\n\n${modules.join('\n\n')}`)
    }
  }

  return parts.join('\n\n')
}

/** The skill's declared tool whitelist (`[]` for none / unknown skill). */
export function getSkillToolWhitelist(
  name: string,
  baseDir?: string
): string[] {
  const rec = loadRecords(baseDir).records.find((r) => r.meta.name === name)
  return rec ? [...rec.meta.tools] : []
}

/**
 * The skill that is primary for a chat context (its `contextTypes` includes it),
 * or `null`. On multiple matches, the first by sorted name (deterministic) + warn.
 */
export function getPrimarySkillForContext(
  contextType: SkillContextType | undefined,
  baseDir?: string
): string | null {
  if (!contextType) return null
  const matches = loadRecords(baseDir).records.filter((r) =>
    r.meta.contextTypes.includes(contextType)
  )
  if (matches.length === 0) return null
  if (matches.length > 1) {
    console.warn(
      `[skill-fs] Multiple skills claim contextType "${contextType}": ${matches
        .map((m) => m.meta.name)
        .join(', ')} — using "${matches[0]!.meta.name}"`
    )
  }
  return matches[0]!.meta.name
}

/**
 * Build-time helper: every valid skill as `{ meta, body }`, sorted by name.
 * Consumed by scripts/generate-skills-manifest.ts to emit skills.generated.ts.
 */
export function scanSkills(baseDir?: string): GeneratedSkill[] {
  return loadRecords(baseDir).records.map((r) => ({
    meta: r.meta,
    body: loadSkill(r.meta.name, baseDir)!,
  }))
}
