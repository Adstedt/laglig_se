/**
 * Story 17.9c (TEST-001) — row-level cross-tenant isolation for USER_FILE retrieval.
 *
 * The unit suite mocks `$queryRaw`, so it can only assert SQL *parameters* — it cannot
 * prove that a foreign workspace's USER_FILE chunk is actually excluded from results.
 * This is the single highest-risk behaviour in the file-RAG feature (a data leak), so
 * it is proven here against the real dev DB.
 *
 * Approach: seed one USER_FILE chunk in workspace A and one in workspace B, BOTH
 * embedded with the query's own vector (cosine similarity ≈ 1.0 for each) so B is a
 * maximally-relevant "temptation". A retrieval scoped to A must still return ONLY A's
 * chunk and NEVER B's — exclusion comes from the `workspace_id` SQL clause, not from
 * relevance ranking.
 *
 * Runs against the real DB (no FK on content_chunks.workspace_id, so no Workspace rows
 * are needed). Gated on OPENAI_API_KEY because `retrieveContext` embeds the query.
 * Run with: `pnpm test:integration`. Pattern mirrors `law-list-import-rls.test.ts`.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { generateEmbedding, vectorToString } from '@/lib/chunks/embed-chunks'
import { retrieveContext } from '@/lib/agent/retrieval'
import { createSearchWorkspaceFilesTool } from '@/lib/agent/tools/search-workspace-files'

const TEST_PREFIX = 'test-17.9c-rls-'
const WS_A = `${TEST_PREFIX}ws-a`
const WS_B = `${TEST_PREFIX}ws-b`
const FILE_A = `${TEST_PREFIX}file-a`
const FILE_B = `${TEST_PREFIX}file-b`
const QUERY = 'dataskydd och kryptering av personuppgifter i vår policy'

type ToolWithExecute = {
  execute: (_args: { query: string; limit?: number }) => Promise<{
    data?: Array<{ fileId: string }>
    error?: boolean
  }>
}

async function cleanup() {
  await prisma.contentChunk.deleteMany({
    where: { source_id: { startsWith: TEST_PREFIX } },
  })
}

async function seedUserFileChunk(args: {
  id: string
  sourceId: string
  workspaceId: string
  filename: string
  vecLiteral: string
}) {
  const header = `${args.filename} (POLICY)`
  const content =
    'Vår dataskyddspolicy kräver kryptering av personuppgifter i vila och under överföring.'
  const metadata = JSON.stringify({
    filename: args.filename,
    category: 'POLICY',
  })
  await prisma.$executeRaw`
    INSERT INTO content_chunks
      (id, source_type, source_id, workspace_id, path, contextual_header,
       content, content_role, token_count, metadata, embedding, created_at, updated_at)
    VALUES
      (${args.id}, 'USER_FILE'::"SourceType", ${args.sourceId}, ${args.workspaceId},
       'file.chunk1', ${header}, ${content}, 'MARKDOWN_CHUNK'::"ContentRole",
       20, ${metadata}::jsonb, ${args.vecLiteral}::vector, now(), now())
  `
}

// retrieveContext embeds the query via OpenAI — skip when the key is absent.
const runner = process.env.OPENAI_API_KEY ? describe : describe.skip

runner('USER_FILE retrieval — cross-tenant row isolation (Story 17.9c)', () => {
  beforeAll(async () => {
    await cleanup()

    // Embed the query once; use that exact vector for BOTH chunks so each is a
    // perfect (similarity ≈ 1.0) match — B is therefore a real temptation.
    const { embedding } = await generateEmbedding(QUERY, '', '')
    const vecLiteral = vectorToString(embedding)

    await seedUserFileChunk({
      id: `${TEST_PREFIX}chunk-a`,
      sourceId: FILE_A,
      workspaceId: WS_A,
      filename: 'policy-a.pdf',
      vecLiteral,
    })
    await seedUserFileChunk({
      id: `${TEST_PREFIX}chunk-b`,
      sourceId: FILE_B,
      workspaceId: WS_B,
      filename: 'policy-b.pdf',
      vecLiteral,
    })
  }, 30_000)

  afterAll(async () => {
    await cleanup()
  })

  test('retrieveContext scoped to A returns A and NEVER B', async () => {
    const res = await retrieveContext(QUERY, WS_A, {
      sourceTypes: ['USER_FILE'],
      topK: 10,
    })
    const ids = res.results.map((r) => r.sourceId)
    expect(ids).toContain(FILE_A)
    expect(ids).not.toContain(FILE_B)
  }, 30_000)

  test('retrieveContext scoped to B returns B and NEVER A (reverse)', async () => {
    const res = await retrieveContext(QUERY, WS_B, {
      sourceTypes: ['USER_FILE'],
      topK: 10,
    })
    const ids = res.results.map((r) => r.sourceId)
    expect(ids).toContain(FILE_B)
    expect(ids).not.toContain(FILE_A)
  }, 30_000)

  test('the search_workspace_files tool scoped to A never surfaces B', async () => {
    const tool = createSearchWorkspaceFilesTool(
      WS_A
    ) as unknown as ToolWithExecute
    const out = await tool.execute({ query: QUERY, limit: 10 })
    const ids = (out.data ?? []).map((d) => d.fileId)
    expect(ids).toContain(FILE_A)
    expect(ids).not.toContain(FILE_B)
  }, 30_000)
})
