'use server'

/**
 * Track document visits for cache warming optimization
 * 
 * This lightweight tracking helps us identify the most popular documents
 * in public browsing (/rattskallor) to complement law list-based warming
 */

import { prisma } from '@/lib/prisma'

/**
 * Track a document visit (fire-and-forget, non-blocking)
 * Called when users view documents in public pages
 */
export async function trackDocumentVisit(documentId: string): Promise<void> {
  try {
    // Use upsert to increment counter or create new record
    // This is intentionally fire-and-forget to not slow down page loads
    await prisma.$executeRaw`
      INSERT INTO document_visits (document_id, visit_count, last_visited)
      VALUES (${documentId}, 1, NOW())
      ON CONFLICT (document_id) 
      DO UPDATE SET 
        visit_count = document_visits.visit_count + 1,
        last_visited = NOW(),
        updated_at = NOW()
    `
  } catch (error) {
    // Silently fail - tracking should never break the app
    console.warn('Failed to track visit:', error)
  }
}

/**
 * Get the most visited documents for cache warming
 * Combines law list popularity with public page visits
 */
export async function getMostPopularDocuments(limit: number = 200) {
  // Get popular documents from BOTH sources
  const [lawListDocs, visitedDocs] = await Promise.all([
    // Top documents in law lists (your users' actual work documents)
    prisma.lawListItem.groupBy({
      by: ['document_id'],
      _count: {
        document_id: true
      },
      orderBy: {
        _count: {
          document_id: 'desc'
        }
      },
      take: limit
    }),
    
    // Top visited documents in public pages
    prisma.$queryRaw<Array<{ document_id: string; visit_count: number }>>`
      SELECT document_id, visit_count 
      FROM document_visits 
      ORDER BY visit_count DESC 
      LIMIT ${limit}
    `
  ])
  
  // Combine and deduplicate, prioritizing by total popularity
  const documentScores = new Map<string, number>()
  
  // Weight law list inclusion higher (these are actively used documents)
  lawListDocs.forEach(item => {
    if (item.document_id) {
      documentScores.set(item.document_id, item._count.document_id * 2) // 2x weight
    }
  })
  
  // Add visit counts
  visitedDocs.forEach(item => {
    const current = documentScores.get(item.document_id) || 0
    documentScores.set(item.document_id, current + item.visit_count)
  })
  
  // Sort by combined score and return top N
  const sortedDocs = Array.from(documentScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([docId, score]) => ({
      document_id: docId,
      score,
      source: lawListDocs.some(d => d.document_id === docId) ? 
        (visitedDocs.some(d => d.document_id === docId) ? 'both' : 'law_lists') : 
        'public_visits'
    }))
  
  return sortedDocs
}

/**
 * Clean up old visit records (optional maintenance)
 * Can be run periodically to keep the table small
 */
export async function cleanupOldVisits(daysToKeep: number = 90) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  
  await prisma.$executeRaw`
    DELETE FROM document_visits 
    WHERE last_visited < ${cutoffDate}
    AND visit_count < 10  -- Keep frequently visited ones longer
  `
}