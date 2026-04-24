/**
 * Story 21.9 — tests for seal-hash.ts.
 *
 * Golden-fixture test pins the blocking-CI determinism contract: any
 * accidental change to the canonical-JSON or hash output for the fixture
 * input would break integrity re-verification for existing sealed cycles.
 * Intentional updates require regenerating the three fixture files in the
 * same PR.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeSealHash } from '@/lib/compliance-audit/seal-hash'
import type { SealManifestInput } from '@/lib/compliance-audit/seal-manifest-builder'

const FIXTURES_DIR = join(
  process.cwd(),
  'lib',
  'compliance-audit',
  '__fixtures__'
)

function loadFixtureManifest(): SealManifestInput {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'canonical-seal-input.json'), 'utf8')
  ) as SealManifestInput
}

describe('computeSealHash', () => {
  it('produces the expected hash for the golden fixture', () => {
    const manifest = loadFixtureManifest()
    const expectedHash = readFileSync(
      join(FIXTURES_DIR, 'canonical-seal-hash.txt'),
      'utf8'
    ).trim()
    const { hash } = computeSealHash(manifest)
    expect(hash).toBe(expectedHash)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic (IV2 — pure-function contract)', () => {
    const manifest = loadFixtureManifest()
    const first = computeSealHash(manifest)
    const second = computeSealHash(manifest)
    expect(first.hash).toBe(second.hash)
    expect(first.canonicalJson).toBe(second.canonicalJson)
    // This property is ALL IV2 guarantees — real dual-sealCycle invocations
    // produce different manifests (different sealedAt) and therefore
    // different hashes, which is intended, not a violation.
  })

  it('produces a different hash when the manifest is modified', () => {
    const manifest = loadFixtureManifest()
    const baseline = computeSealHash(manifest).hash
    const tampered = { ...manifest, name: manifest.name + ' (tampered)' }
    expect(computeSealHash(tampered).hash).not.toBe(baseline)
  })

  it('detects tampering with overrideReason', () => {
    const manifest = loadFixtureManifest()
    const baseline = computeSealHash(manifest).hash
    const tampered = {
      ...manifest,
      overrideReason: manifest.overrideReason
        ? manifest.overrideReason + ' (edited)'
        : 'some reason',
    }
    expect(computeSealHash(tampered).hash).not.toBe(baseline)
  })

  it('returns both the canonical JSON and the hash for persistence', () => {
    const manifest = loadFixtureManifest()
    const result = computeSealHash(manifest)
    expect(typeof result.canonicalJson).toBe('string')
    expect(result.canonicalJson.length).toBeGreaterThan(0)
    expect(typeof result.hash).toBe('string')
  })
})
