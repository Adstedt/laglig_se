/**
 * activate_skill tool — Story 19.7a.
 *
 * Lets the agent load a skill's full instructions mid-conversation (a skill the
 * `<available_skills>` catalogue advertised but isn't the context-primary).
 * `'read'`-tier, no workspace/context — reads the deploy-static skill files via
 * the 19.6 loader.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { wrapToolResponse, wrapToolError } from './utils'
import { loadSkill } from '@/lib/agent/skill-loader'

const schema = z.object({
  name: z
    .string()
    .describe(
      'Namnet på färdigheten att aktivera (se listan i <available_skills>).'
    ),
})

type Input = z.infer<typeof schema>

export function createActivateSkillTool() {
  return tool({
    description: `Aktivera en färdighet (skill) för att läsa dess fullständiga instruktioner mitt i en konversation. Använd namnet exakt som det står i <available_skills>. Färdigheten som redan gäller för den aktiva kontexten är redan inläst — anropa detta för att hämta en ANNAN färdighet.`,
    inputSchema: zodSchema(schema),
    execute: async ({ name }: Input) => {
      const startTime = Date.now()
      const instructions = loadSkill(name)
      if (!instructions) {
        return wrapToolError(
          'activate_skill',
          `Okänd färdighet: "${name}".`,
          'Se listan i <available_skills> för tillgängliga färdigheter.',
          startTime
        )
      }
      return wrapToolResponse(
        'activate_skill',
        { name, instructions },
        startTime
      )
    },
  })
}
