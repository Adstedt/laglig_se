import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { TemplateContentStatus } from '@/components/admin/template-content-status'

describe('TemplateContentStatus', () => {
  it('renders empty state when total is 0', () => {
    render(
      <TemplateContentStatus
        counts={{ STUB: 0, AI_GENERATED: 0, HUMAN_REVIEWED: 0, APPROVED: 0 }}
      />
    )

    expect(screen.getByText('Inga objekt ännu')).toBeInTheDocument()
  })

  it('renders total count in header', () => {
    render(
      <TemplateContentStatus
        counts={{ STUB: 2, AI_GENERATED: 5, HUMAN_REVIEWED: 3, APPROVED: 0 }}
      />
    )

    expect(screen.getByText('Innehållsstatus (10 objekt)')).toBeInTheDocument()
  })

  it('renders count and percentage for each status', () => {
    render(
      <TemplateContentStatus
        counts={{ STUB: 1, AI_GENERATED: 2, HUMAN_REVIEWED: 3, APPROVED: 4 }}
      />
    )

    expect(screen.getByText('1 (10%)')).toBeInTheDocument()
    expect(screen.getByText('2 (20%)')).toBeInTheDocument()
    expect(screen.getByText('3 (30%)')).toBeInTheDocument()
    expect(screen.getByText('4 (40%)')).toBeInTheDocument()
  })

  it('renders status badges as legend', () => {
    render(
      <TemplateContentStatus
        counts={{ STUB: 1, AI_GENERATED: 0, HUMAN_REVIEWED: 0, APPROVED: 0 }}
      />
    )

    expect(screen.getByText('Stub')).toBeInTheDocument()
    expect(screen.getByText('AI-genererad')).toBeInTheDocument()
    expect(screen.getByText('Granskad')).toBeInTheDocument()
    expect(screen.getByText('Godkänd')).toBeInTheDocument()
  })
})
