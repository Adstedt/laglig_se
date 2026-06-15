/**
 * Story 19.6: shared skill schema + types.
 *
 * Extracted from skill-loader.ts so it can be imported by BOTH the pure,
 * manifest-based runtime loader (skill-loader.ts) and the filesystem-based
 * scanner used at build/test time (skill-fs.ts) WITHOUT pulling `fs` into the
 * runtime bundle. No filesystem access here.
 */

import { z } from 'zod'

/** SKILL.md frontmatter schema. */
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

/** One entry in the build-time manifest (lib/agent/skills.generated.ts). */
export interface GeneratedSkill {
  meta: SkillMeta
  /** Fully assembled body: SKILL.md body + companions + types/*.md modules. */
  body: string
}
