/**
 * Story 19.6: Skill loader library.
 *
 * Pure, registry-agnostic loader for the file-based agent-skills convention.
 * A skill is a subdirectory of `lib/agent/skills/` containing a `SKILL.md`
 * (YAML frontmatter + body) plus optional PROCEDURE.md / STYLE.md / CRITERIA.md.
 *
 * This module does NOT touch the agent runtime (no prompt injection, no tool
 * registry, no route) — Story 19.7 consumes these functions to wire skills in.
 * Everything here is deploy-static and read-once per `baseDir`.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve, join } from 'path'
import matter from 'gray-matter'
import { z } from 'zod'

const DEFAULT_BASE_DIR = 'lib/agent/skills'

/** SKILL.md frontmatter schema. Exported so Story 19.7 can reuse it. */
export const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  contextTypes: z
    .array(z.enum(['global', 'task', 'law', 'change']))
    .default([]),
  tools: z.array(z.string()).default([]),
})

export type SkillContextType = 'global' | 'task' | 'law' | 'change'
export type SkillMeta = z.infer<typeof skillFrontmatterSchema>

interface SkillRecord {
  meta: SkillMeta
  dir: string
}

interface CacheEntry {
  records: SkillRecord[]
  metas: readonly SkillMeta[]
}

// Skills are deploy-static — read + validate once per resolved baseDir (mirrors
// the BASE_PROMPT readFileSync-once pattern in system-prompt.ts).
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
        console.warn(`[skill-loader] Could not parse ${skillMd}:`, err)
        continue
      }

      const parsed = skillFrontmatterSchema.safeParse(frontmatter)
      if (!parsed.success) {
        console.warn(
          `[skill-loader] Invalid frontmatter in ${skillMd}: ${parsed.error.issues[0]?.message ?? 'schema error'} — skipped`
        )
        continue
      }
      if (parsed.data.name !== entry.name) {
        console.warn(
          `[skill-loader] Skill name "${parsed.data.name}" does not match directory "${entry.name}" — skipped`
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
 * (PROCEDURE / STYLE / CRITERIA) under a `## ` header. `null` if unknown.
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
      `[skill-loader] Multiple skills claim contextType "${contextType}": ${matches
        .map((m) => m.meta.name)
        .join(', ')} — using "${matches[0]!.meta.name}"`
    )
  }
  return matches[0]!.meta.name
}
