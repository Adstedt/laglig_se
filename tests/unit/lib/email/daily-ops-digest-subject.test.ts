/**
 * Tests for the ops-digest subject builder — specifically the RAG coverage
 * alert. Chunks without context_prefix/embedding are invisible to vector
 * search; the subject line must flag a persistent gap (44,733 chunks once sat
 * dark for months because the count only appeared in the email body).
 */

import { describe, it, expect } from 'vitest'

import {
  buildDigestSubject,
  type DigestData,
  type ChunkHealthStatus,
} from '@/lib/email/daily-ops-digest'

function makeChunkHealth(
  overrides: Partial<ChunkHealthStatus> = {}
): ChunkHealthStatus {
  return {
    totalChunks: 233_000,
    withPrefix: 233_000,
    withoutPrefix: 0,
    withEmbedding: 233_000,
    withoutEmbedding: 0,
    chunksCreated24h: 0,
    docsNeedingChunks: 0,
    stuckDocs: [],
    ...overrides,
  }
}

function makeDigestData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    ingestion: null,
    gaps: null,
    jobHealth: [],
    backlog: null,
    pipeline: null,
    chunkHealth: makeChunkHealth(),
    ...overrides,
  }
}

describe('buildDigestSubject — RAG coverage alert', () => {
  it('is green when coverage is full', () => {
    const subject = buildDigestSubject(makeDigestData())
    expect(subject).toContain('✅')
    expect(subject).not.toContain('osökbara')
  })

  it('tolerates a small transient gap (in-flight ingest)', () => {
    const subject = buildDigestSubject(
      makeDigestData({
        chunkHealth: makeChunkHealth({
          withoutPrefix: 30,
          withoutEmbedding: 30,
        }),
      })
    )
    expect(subject).toContain('✅')
  })

  it('alerts in the subject when unembedded chunks exceed the threshold', () => {
    const subject = buildDigestSubject(
      makeDigestData({
        chunkHealth: makeChunkHealth({ withoutEmbedding: 44_733 }),
      })
    )
    expect(subject).toContain('⚠️')
    expect(subject).toContain('osökbara i RAG')
    expect(subject).toContain('44')
  })

  it('alerts on missing prefixes even when embeddings exist', () => {
    const subject = buildDigestSubject(
      makeDigestData({
        chunkHealth: makeChunkHealth({ withoutPrefix: 1_800 }),
      })
    )
    expect(subject).toContain('⚠️')
    expect(subject).toContain('osökbara i RAG')
  })

  it('does not alert when chunk health data is unavailable', () => {
    const subject = buildDigestSubject(makeDigestData({ chunkHealth: null }))
    expect(subject).toContain('✅')
  })
})
