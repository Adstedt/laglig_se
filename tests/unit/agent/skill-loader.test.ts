/**
 * Unit tests for the Story 19.6 skill loader library.
 * Pure functions over a fixtures dir (passed as baseDir) — covers the scan/skip/
 * warn rules, frontmatter parsing/validation, body assembly, whitelist, the
 * context→skill mapping, and the per-baseDir cache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listSkills,
  loadSkill,
  getSkillToolWhitelist,
  getPrimarySkillForContext,
  clearSkillCache,
} from '@/lib/agent/skill-loader'

const FX = 'tests/fixtures/skills'

let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  clearSkillCache()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => warnSpy.mockRestore())

describe('listSkills', () => {
  it('returns only valid skill dirs, sorted — skips _-prefix / loose files / no-SKILL.md / malformed / name-mismatch', () => {
    const names = listSkills(FX).map((s) => s.name)
    expect(names).toEqual(['no-context', 'valid-change'])
    expect(names).not.toContain('_skip')
    expect(names).not.toContain('wrong-name') // the "nameless" dir's frontmatter name
    expect(names).not.toContain('malformed')
    // malformed (bad frontmatter) + nameless (name≠dir) each warn
    expect(warnSpy).toHaveBeenCalled()
  })

  it('parses frontmatter fields', () => {
    const vc = listSkills(FX).find((s) => s.name === 'valid-change')!
    expect(vc.description).toContain('change context')
    expect(vc.contextTypes).toEqual(['change'])
    expect(vc.tools).toEqual(['get_change_details', 'search_laws'])
  })

  it('caches per baseDir (same frozen array on re-call)', () => {
    const a = listSkills(FX)
    const b = listSkills(FX)
    expect(a).toBe(b)
    expect(Object.isFrozen(a)).toBe(true)
  })

  it('returns [] for a non-existent baseDir', () => {
    expect(listSkills('tests/fixtures/does-not-exist')).toEqual([])
  })
})

describe('getPrimarySkillForContext', () => {
  it('returns the skill whose contextTypes includes the context', () => {
    expect(getPrimarySkillForContext('change', FX)).toBe('valid-change')
  })

  it('returns null when none match or context is undefined', () => {
    expect(getPrimarySkillForContext('global', FX)).toBeNull()
    expect(getPrimarySkillForContext('task', FX)).toBeNull()
    expect(getPrimarySkillForContext(undefined, FX)).toBeNull()
  })
})

describe('getSkillToolWhitelist', () => {
  it('returns the tools array; [] for empty or unknown', () => {
    expect(getSkillToolWhitelist('valid-change', FX)).toEqual([
      'get_change_details',
      'search_laws',
    ])
    expect(getSkillToolWhitelist('no-context', FX)).toEqual([])
    expect(getSkillToolWhitelist('does-not-exist', FX)).toEqual([])
  })
})

describe('loadSkill', () => {
  it('assembles the SKILL body + present companions under headers', () => {
    const body = loadSkill('valid-change', FX)!
    expect(body).toContain('Valid-change skill body')
    expect(body).toContain('## Procedure')
    expect(body).toContain('1. Read the change.')
    expect(body).toContain('## Style')
    expect(body).toContain('Skriv på svenska')
    expect(body).not.toContain('## Criteria') // no CRITERIA.md in this fixture
  })

  it('omits absent companions (no-context has only SKILL.md)', () => {
    expect(loadSkill('no-context', FX)).toBe('No-context skill body.')
  })

  it('returns null for unknown or skipped skills', () => {
    expect(loadSkill('does-not-exist', FX)).toBeNull()
    expect(loadSkill('_skip', FX)).toBeNull()
  })
})

describe('loadSkill — types/ modules (Story 19.8)', () => {
  it('appends types/*.md (sorted, .md only) under "## Type modules" as "### Type: <stem>"', () => {
    const body = loadSkill('valid-change', FX)!
    expect(body).toContain('## Type modules')
    expect(body).toContain('### Type: alpha')
    expect(body).toContain('Alpha module body.')
    expect(body).toContain('### Type: beta_type')
    expect(body).toContain('Beta module STRUCTURE/STYLE/CRITERIA content.')
    // Sorted: alpha before beta_type.
    expect(body.indexOf('### Type: alpha')).toBeLessThan(
      body.indexOf('### Type: beta_type')
    )
    // Non-md files in types/ are ignored.
    expect(body).not.toContain('notes.txt')
    expect(body).not.toContain('must be ignored')
    // Type modules come AFTER the companions.
    expect(body.indexOf('## Style')).toBeLessThan(
      body.indexOf('## Type modules')
    )
  })

  it('is a no-op for skills without a types/ dir', () => {
    expect(loadSkill('no-context', FX)).toBe('No-context skill body.')
  })

  it('survives a cache clear (re-scan picks the modules up again)', () => {
    const a = loadSkill('valid-change', FX)!
    clearSkillCache()
    const b = loadSkill('valid-change', FX)!
    expect(b).toBe(a)
  })

  it('real skill: draft_styrdokument exposes all 8 WorkspaceDocumentType modules', () => {
    const body = loadSkill('draft_styrdokument')!
    for (const stem of [
      'policy',
      'risk_assessment',
      'action_plan',
      'procedure',
      'instruction',
      'checklist',
      'report',
      'other',
    ]) {
      expect(body).toContain(`### Type: ${stem}`)
    }
  })
})
