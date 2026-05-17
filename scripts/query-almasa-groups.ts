/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

import { prisma } from '../lib/prisma'

const ALMASA_WORKSPACE_ID = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1'

async function main() {
  const groups = await prisma.$queryRaw`
    SELECT g.name, COUNT(i.id)::integer as item_count
    FROM law_list_groups g
    LEFT JOIN law_list_items i ON i.group_id = g.id
    WHERE g.law_list_id IN (
      SELECT id FROM law_lists WHERE workspace_id = ${ALMASA_WORKSPACE_ID}
    )
    GROUP BY g.name
    ORDER BY item_count DESC, g.name;
  `

  console.log('Almåsa Groups:')
  console.log(JSON.stringify(groups, null, 2))

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
