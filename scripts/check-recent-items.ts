import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkRecentItems() {
  const prisma = new PrismaClient()
  
  try {
    // Get most recent law list items
    const recentItems = await prisma.lawListItem.findMany({
      take: 5,
      orderBy: { added_at: 'desc' },
      include: {
        law_list: {
          select: {
            name: true,
            workspace_id: true,
            workspace: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        },
        document: {
          select: {
            title: true,
            document_number: true
          }
        }
      }
    })
    
    console.log('🔍 Most recent law list items:\n')
    recentItems.forEach((item, i) => {
      console.log(`${i + 1}. ${item.document.title}`)
      console.log(`   Document: ${item.document.document_number}`)
      console.log(`   List: ${item.law_list.name}`)
      console.log(`   Workspace: ${item.law_list.workspace.name} (${item.law_list.workspace.slug})`)
      console.log(`   Workspace ID: ${item.law_list.workspace_id}`)
      console.log(`   Added: ${item.added_at}`)
      console.log(`   Item ID: ${item.id}\n`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkRecentItems()
