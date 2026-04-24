/**
 * Story 21.9 — RFC 8785 (JCS) canonical-JSON wrapper.
 *
 * Thin wrapper around the `canonicalize` npm package (exact-pinned at 3.0.0
 * in package.json). The wrapper exists as a swap-surface — if we ever need
 * to replace the implementation (custom for performance, different RFC 8785
 * implementation for audit compliance, etc.) only this file changes. Every
 * caller in the seal pipeline goes through `canonicalizeSealInput`, not the
 * package directly.
 *
 * **Exact-version pin rationale:** the canonical-JSON output MUST be stable
 * across time — if `canonicalize` ever ships a non-RFC-compliant behaviour
 * change in a patch release, all existing sealed cycles would fail integrity
 * re-verification. Pin is intentional; update only with a golden-fixture
 * regression check (see `__fixtures__/canonical-seal-output.txt`).
 *
 * [Source: architecture/epic-21-lagefterlevnadskontroll.md §3.2, §6.2]
 */

import canonicalize from 'canonicalize'

/**
 * Produces a deterministic, RFC 8785-compliant canonical JSON string from
 * any serializable input. Throws if `canonicalize` returns undefined (the
 * root value was undefined — an invariant violation for seal inputs).
 */
export function canonicalizeSealInput(input: unknown): string {
  const result = canonicalize(input)
  if (result === undefined) {
    throw new Error(
      'canonicalizeSealInput: input serialized to undefined (root value must be a JSON object)'
    )
  }
  return result
}
