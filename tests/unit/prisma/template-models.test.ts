/**
 * Story 12.2: Unit Tests for Template Data Model
 *
 * Verifies that Prisma client exports the new model types and enum values
 * for LawListTemplate, TemplateSection, and TemplateItem.
 */

import { describe, it, expect } from 'vitest'
import {
  Prisma,
  TemplateStatus,
  TemplateItemContentStatus,
} from '@prisma/client'

describe('Story 12.2: Template Data Model', () => {
  describe('TemplateStatus enum', () => {
    it('has exactly 4 values', () => {
      const values = Object.values(TemplateStatus)
      expect(values).toHaveLength(4)
    })

    it('contains DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED', () => {
      expect(TemplateStatus.DRAFT).toBe('DRAFT')
      expect(TemplateStatus.IN_REVIEW).toBe('IN_REVIEW')
      expect(TemplateStatus.PUBLISHED).toBe('PUBLISHED')
      expect(TemplateStatus.ARCHIVED).toBe('ARCHIVED')
    })
  })

  describe('TemplateItemContentStatus enum', () => {
    it('has exactly 4 values', () => {
      const values = Object.values(TemplateItemContentStatus)
      expect(values).toHaveLength(4)
    })

    it('contains STUB, AI_GENERATED, HUMAN_REVIEWED, APPROVED', () => {
      expect(TemplateItemContentStatus.STUB).toBe('STUB')
      expect(TemplateItemContentStatus.AI_GENERATED).toBe('AI_GENERATED')
      expect(TemplateItemContentStatus.HUMAN_REVIEWED).toBe('HUMAN_REVIEWED')
      expect(TemplateItemContentStatus.APPROVED).toBe('APPROVED')
    })
  })

  describe('LawListTemplate model types', () => {
    it('exposes LawListTemplateCreateInput type', () => {
      // Type-level verification: this would fail to compile if the model doesn't exist
      const input: Prisma.LawListTemplateCreateInput = {
        name: 'Test Template',
        slug: 'test-template',
        domain: 'arbetsmiljo',
        created_by: 'user-id',
        creator: { connect: { id: 'user-id' } },
      }
      expect(input.name).toBe('Test Template')
      expect(input.slug).toBe('test-template')
      expect(input.domain).toBe('arbetsmiljo')
    })

    it('exposes LawListTemplateScalarFieldEnum with expected fields', () => {
      const fields = Prisma.LawListTemplateScalarFieldEnum
      expect(fields.id).toBe('id')
      expect(fields.name).toBe('name')
      expect(fields.slug).toBe('slug')
      expect(fields.description).toBe('description')
      expect(fields.domain).toBe('domain')
      expect(fields.target_audience).toBe('target_audience')
      expect(fields.status).toBe('status')
      expect(fields.version).toBe('version')
      expect(fields.document_count).toBe('document_count')
      expect(fields.section_count).toBe('section_count')
      expect(fields.primary_regulatory_bodies).toBe('primary_regulatory_bodies')
      expect(fields.parent_template_id).toBe('parent_template_id')
      expect(fields.is_variant).toBe('is_variant')
      expect(fields.variant_filter_field).toBe('variant_filter_field')
      expect(fields.metadata).toBe('metadata')
      expect(fields.created_by).toBe('created_by')
      expect(fields.published_at).toBe('published_at')
      expect(fields.created_at).toBe('created_at')
      expect(fields.updated_at).toBe('updated_at')
    })
  })

  describe('TemplateSection model types', () => {
    it('exposes TemplateSectionCreateInput type', () => {
      const input: Prisma.TemplateSectionCreateInput = {
        section_number: '01',
        name: 'Grundläggande regler',
        template: { connect: { id: 'template-id' } },
      }
      expect(input.section_number).toBe('01')
      expect(input.name).toBe('Grundläggande regler')
    })

    it('exposes TemplateSectionScalarFieldEnum with expected fields', () => {
      const fields = Prisma.TemplateSectionScalarFieldEnum
      expect(fields.id).toBe('id')
      expect(fields.template_id).toBe('template_id')
      expect(fields.section_number).toBe('section_number')
      expect(fields.name).toBe('name')
      expect(fields.description).toBe('description')
      expect(fields.position).toBe('position')
      expect(fields.item_count).toBe('item_count')
      expect(fields.created_at).toBe('created_at')
      expect(fields.updated_at).toBe('updated_at')
    })
  })

  describe('TemplateItem model types', () => {
    it('exposes TemplateItemCreateInput type', () => {
      const input: Prisma.TemplateItemCreateInput = {
        index: '0100',
        template: { connect: { id: 'template-id' } },
        section: { connect: { id: 'section-id' } },
        document: { connect: { id: 'document-id' } },
      }
      expect(input.index).toBe('0100')
    })

    it('exposes TemplateItemScalarFieldEnum with expected fields', () => {
      const fields = Prisma.TemplateItemScalarFieldEnum
      expect(fields.id).toBe('id')
      expect(fields.template_id).toBe('template_id')
      expect(fields.section_id).toBe('section_id')
      expect(fields.document_id).toBe('document_id')
      expect(fields.index).toBe('index')
      expect(fields.position).toBe('position')
      expect(fields.compliance_summary).toBe('compliance_summary')
      expect(fields.expert_commentary).toBe('expert_commentary')
      expect(fields.source_type).toBe('source_type')
      expect(fields.regulatory_body).toBe('regulatory_body')
      expect(fields.last_amendment).toBe('last_amendment')
      expect(fields.replaces_old_reference).toBe('replaces_old_reference')
      expect(fields.is_service_company_relevant).toBe(
        'is_service_company_relevant'
      )
      expect(fields.variant_section_override).toBe('variant_section_override')
      expect(fields.cross_list_references).toBe('cross_list_references')
      expect(fields.content_status).toBe('content_status')
      expect(fields.generated_by).toBe('generated_by')
      expect(fields.reviewed_by).toBe('reviewed_by')
      expect(fields.reviewed_at).toBe('reviewed_at')
      expect(fields.created_at).toBe('created_at')
      expect(fields.updated_at).toBe('updated_at')
    })
  })
})
