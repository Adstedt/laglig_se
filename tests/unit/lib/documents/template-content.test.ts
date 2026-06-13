import { describe, it, expect } from 'vitest'
import {
  TEMPLATES,
  TEMPLATE_IDS,
  ARBETSMILJOPOLICY,
  RISKBEDOMNING,
  HANDLINGSPLAN,
  RUTIN,
  CHECKLISTA,
} from '@/lib/documents/template-content'

describe('template-content', () => {
  // Story 19.8: 5 → 11 (≥1 template per WorkspaceDocumentType + GDPR minimums).
  it('exports exactly 11 templates', () => {
    expect(TEMPLATES).toHaveLength(11)
  })

  it('exports all template IDs', () => {
    expect(Object.keys(TEMPLATE_IDS)).toHaveLength(11)
  })

  it('each template has a unique deterministic ID', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(11)
  })

  // Story 19.8 (AC 7): every WorkspaceDocumentType has at least one template.
  it('covers every WorkspaceDocumentType with ≥1 template', () => {
    const types = [
      'POLICY',
      'RISK_ASSESSMENT',
      'ACTION_PLAN',
      'PROCEDURE',
      'INSTRUCTION',
      'CHECKLIST',
      'REPORT',
      'OTHER',
    ]
    for (const t of types) {
      expect(
        TEMPLATES.filter((x) => x.documentType === t).length
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('each template has required fields', () => {
    for (const template of TEMPLATES) {
      expect(template.id).toBeTruthy()
      expect(template.name).toBeTruthy()
      expect(template.description).toBeTruthy()
      expect(template.documentType).toBeTruthy()
      expect(template.sortOrder).toBeGreaterThan(0)
      expect(template.content).toBeDefined()
    }
  })

  it('each template content has top-level doc node', () => {
    for (const template of TEMPLATES) {
      expect(template.content.type).toBe('doc')
      expect(Array.isArray(template.content.content)).toBe(true)
      expect(template.content.content.length).toBeGreaterThan(0)
    }
  })

  // 19.8 QA fix: templates must NOT start with an H1 that duplicates the
  // document title — the editor renders the title field as the page heading,
  // so a body H1 repeating the type name showed the heading twice (worst case
  // Checklista: title + H1 "Checklista" + H2 "Checklista"). Templates now open
  // directly with their first H2 section heading.
  it('each template starts with an H2 section heading (no title-duplicating H1)', () => {
    for (const template of TEMPLATES) {
      const firstNode = template.content.content[0] as Record<string, unknown>
      expect(firstNode.type).toBe('heading')
      expect((firstNode.attrs as Record<string, unknown>).level).toBe(2)
      // No H1 anywhere in the body — the title field owns that level.
      const h1s = (
        template.content.content as Array<Record<string, unknown>>
      ).filter(
        (n) =>
          n.type === 'heading' &&
          (n.attrs as Record<string, unknown>).level === 1
      )
      expect(h1s).toHaveLength(0)
    }
  })

  it('templates contain italic placeholder text', () => {
    for (const template of TEMPLATES) {
      const nodes = template.content.content as Array<Record<string, unknown>>
      const paragraphs = nodes.filter((n) => n.type === 'paragraph')
      expect(paragraphs.length).toBeGreaterThan(0)

      // At least one paragraph should have italic marks
      const hasItalic = paragraphs.some((p) => {
        const content = p.content as Array<Record<string, unknown>> | undefined
        return content?.some((c) => {
          const marks = c.marks as Array<{ type: string }> | undefined
          return marks?.some((m) => m.type === 'italic')
        })
      })
      expect(hasItalic).toBe(true)
    }
  })

  it('Arbetsmiljöpolicy has correct document type', () => {
    expect(ARBETSMILJOPOLICY.documentType).toBe('POLICY')
  })

  it('Riskbedömning has a table with 5 columns', () => {
    const nodes = RISKBEDOMNING.content.content as Array<
      Record<string, unknown>
    >
    const tables = nodes.filter((n) => n.type === 'table')
    expect(tables.length).toBeGreaterThan(0)

    const firstTable = tables[0]!
    const headerRow = (firstTable.content as Array<Record<string, unknown>>)[0]!
    const headers = headerRow.content as Array<Record<string, unknown>>
    expect(headers).toHaveLength(5)
  })

  it('Handlingsplan has a table with 4 columns', () => {
    const nodes = HANDLINGSPLAN.content.content as Array<
      Record<string, unknown>
    >
    const tables = nodes.filter((n) => n.type === 'table')
    expect(tables.length).toBeGreaterThan(0)

    const firstTable = tables[0]!
    const headerRow = (firstTable.content as Array<Record<string, unknown>>)[0]!
    const headers = headerRow.content as Array<Record<string, unknown>>
    expect(headers).toHaveLength(4)
  })

  it('Checklista has a table with 3 columns', () => {
    const nodes = CHECKLISTA.content.content as Array<Record<string, unknown>>
    const tables = nodes.filter((n) => n.type === 'table')
    expect(tables.length).toBeGreaterThan(0)

    const firstTable = tables[0]!
    const headerRow = (firstTable.content as Array<Record<string, unknown>>)[0]!
    const headers = headerRow.content as Array<Record<string, unknown>>
    expect(headers).toHaveLength(3)
  })

  it('Rutin has correct sections', () => {
    const nodes = RUTIN.content.content as Array<Record<string, unknown>>
    const headings = nodes
      .filter((n) => n.type === 'heading')
      .map((n) => {
        const content = n.content as Array<{ text?: string }> | undefined
        return content?.[0]?.text ?? ''
      })

    expect(headings).toContain('Syfte')
    expect(headings).toContain('Omfattning')
    expect(headings).toContain('Ansvar')
    expect(headings).toContain('Genomförande')
    expect(headings).toContain('Dokumentation')
  })

  it('templates have consecutive sort orders 1-11', () => {
    const sortOrders = TEMPLATES.map((t) => t.sortOrder).sort((a, b) => a - b)
    expect(sortOrders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })
})
