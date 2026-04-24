/**
 * Story 21.9 — tests for the canonical-JSON wrapper.
 *
 * Golden-fixture test is blocking-CI per architecture §9.2 / §11.2: any
 * change to the canonical-JSON output for the fixture input would break
 * integrity re-verification of existing sealed cycles, so must be a
 * deliberate fixture update in the same PR.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canonicalizeSealInput } from '@/lib/compliance-audit/canonicalize'

const FIXTURES_DIR = join(
  process.cwd(),
  'lib',
  'compliance-audit',
  '__fixtures__'
)

describe('canonicalizeSealInput', () => {
  it('sorts object keys alphabetically (RFC 8785)', () => {
    const input = { b: 1, a: 2, c: 3 }
    const output = canonicalizeSealInput(input)
    expect(output).toBe('{"a":2,"b":1,"c":3}')
  })

  it('preserves array order (RFC 8785 — arrays are ordered)', () => {
    const input = { items: [3, 1, 2] }
    const output = canonicalizeSealInput(input)
    expect(output).toBe('{"items":[3,1,2]}')
  })

  it('produces byte-identical output for the seal-input golden fixture', () => {
    const input = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'canonical-seal-input.json'), 'utf8')
    )
    const expected = readFileSync(
      join(FIXTURES_DIR, 'canonical-seal-output.txt'),
      'utf8'
    )
    const actual = canonicalizeSealInput(input)
    expect(actual).toBe(expected)
  })

  it('throws when the root value serializes to undefined', () => {
    expect(() => canonicalizeSealInput(undefined)).toThrow(
      /root value must be a JSON object/
    )
  })
})
