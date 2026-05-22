/**
 * Story 17.9b — row-level cross-tenant isolation for WORKSPACE_DOCUMENT retrieval.
 *
 * The unit suite mocks `$queryRaw`, so it can only assert SQL *parameters* — it cannot
 * prove that a foreign workspace's WORKSPACE_DOCUMENT chunk is actually excluded. That
 * is the single highest-risk behaviour for the styrdokument-RAG feature (a data leak),
 * so it is proven here against the real dev DB.
 *
 * Approach (mirrors `user-file-retrieval-rls.test.ts`): seed one WORKSPACE_DOCUMENT
 * chunk in workspace A and one in workspace B, BOTH embedded with the query's own
 * vector (cosine similarity ≈ 1.0 each) so B is a maximally-relevant "temptation". A
 * retrieval scoped to A must still return ONLY A's chunk and NEVER B's — exclusion
 * comes from the `workspace_id` SQL clause, not from relevance ranking.
 *
 * Note: the agent-facing search tool for WORKSPACE_DOCUMENT is Story 17.10 (not built
 * yet), so this asserts isolation at the `retrieveContext` layer — the write side this
 * story produces. Runs against the real DB (no FK on content_chunks.workspace_id, so no
 * Workspace rows are needed). Gated on OPENAI_API_KEY. Run with `pnpm test:integration`.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { generateEmbedding, vectorToString } from '@/lib/chunks/embed-chunks'
import { retrieveContext } from '@/lib/agent/retrieval'

const TEST_PREFIX = 'test-17.9b-rls-'
const WS_A = `${TEST_PREFIX}ws-a`
const WS_B = `${TEST_PREFIX}ws-b`
const DOC_A = `${TEST_PREFIX}doc-a`
const DOC_B = `${TEST_PREFIX}doc-b`
const QUERY = 'dataskydd och kryptering av personuppgifter i vår policy'

async function cleanup() {
  await prisma.contentChunk.deleteMany({
    where: { source_id: { startsWith: TEST_PREFIX } },
  })
}

async function seedWorkspaceDocumentChunk(args: {
  id: string
  sourceId: string
  workspaceId: string
  title: string
  vecLiteral: string
}) {
  const header = `${args.title} (POLICY)`
  const content =
    'Vår dataskyddspolicy kräver kryptering av personuppgifter i vila och under överföring.'
  const metadata = JSON.stringify({
    title: args.title,
    document_type: 'POLICY',
    status: 'APPROVED',
  })
  await prisma.$executeRaw`
    INSERT INTO content_chunks
      (id, source_type, source_id, workspace_id, path, contextual_header,
       content, content_role, token_count, metadata, embedding, created_at, updated_at)
    VALUES
      (${args.id}, 'WORKSPACE_DOCUMENT'::"SourceType", ${args.sourceId}, ${args.workspaceId},
       'file.chunk1', ${header}, ${content}, 'MARKDOWN_CHUNK'::"ContentRole",
       20, ${metadata}::jsonb, ${args.vecLiteral}::vector, now(), now())
  `
}

// retrieveContext embeds the query via OpenAI — skip when the key is absent.
const runner = process.env.OPENAI_API_KEY ? describe : describe.skip

runner(
  'WORKSPACE_DOCUMENT retrieval — cross-tenant row isolation (Story 17.9b)',
  () => {
    beforeAll(async () => {
      await cleanup()

      // Embed the query once; use that exact vector for BOTH chunks so each is a
      // perfect (similarity ≈ 1.0) match — B is therefore a real temptation.
      const { embedding } = await generateEmbedding(QUERY, '', '')
      const vecLiteral = vectorToString(embedding)

      await seedWorkspaceDocumentChunk({
        id: `${TEST_PREFIX}chunk-a`,
        sourceId: DOC_A,
        workspaceId: WS_A,
        title: 'Dataskyddspolicy A',
        vecLiteral,
      })
      await seedWorkspaceDocumentChunk({
        id: `${TEST_PREFIX}chunk-b`,
        sourceId: DOC_B,
        workspaceId: WS_B,
        title: 'Dataskyddspolicy B',
        vecLiteral,
      })
    }, 30_000)

    afterAll(async () => {
      await cleanup()
    })

    test('retrieveContext scoped to A returns A and NEVER B', async () => {
      const res = await retrieveContext(QUERY, WS_A, {
        sourceTypes: ['WORKSPACE_DOCUMENT'],
        topK: 10,
      })
      const ids = res.results.map((r) => r.sourceId)
      expect(ids).toContain(DOC_A)
      expect(ids).not.toContain(DOC_B)
    }, 30_000)

    test('retrieveContext scoped to B returns B and NEVER A (reverse)', async () => {
      const res = await retrieveContext(QUERY, WS_B, {
        sourceTypes: ['WORKSPACE_DOCUMENT'],
        topK: 10,
      })
      const ids = res.results.map((r) => r.sourceId)
      expect(ids).toContain(DOC_B)
      expect(ids).not.toContain(DOC_A)
    }, 30_000)
  }
)
