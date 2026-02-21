import { describe, it, expect } from 'vitest'
import { render } from '@react-email/components'
import React from 'react'
import { LagligEmailLayout } from '@/emails/components/laglig-email-layout'

describe('LagligEmailLayout', () => {
  it('renders without errors', async () => {
    const html = await render(
      <LagligEmailLayout>
        <p>Test content</p>
      </LagligEmailLayout>
    )

    expect(html).toBeTruthy()
    expect(typeof html).toBe('string')
  })

  it('contains the header with Laglig.se branding', async () => {
    const html = await render(
      <LagligEmailLayout>
        <p>Body</p>
      </LagligEmailLayout>
    )

    expect(html).toContain('Laglig.se')
    expect(html).toContain('logo-final.png')
  })

  it('renders children content in the body', async () => {
    const html = await render(
      <LagligEmailLayout>
        <p>Custom notification content here</p>
      </LagligEmailLayout>
    )

    expect(html).toContain('Custom notification content here')
  })

  it('contains footer with company info', async () => {
    const html = await render(
      <LagligEmailLayout>
        <p>Body</p>
      </LagligEmailLayout>
    )

    expect(html).toContain('Din juridiska plattform')
    expect(html).toContain('Stockholm')
  })

  it('includes unsubscribe link when unsubscribeUrl is provided', async () => {
    const html = await render(
      <LagligEmailLayout unsubscribeUrl="https://laglig.se/unsubscribe?token=abc123">
        <p>Body</p>
      </LagligEmailLayout>
    )

    expect(html).toContain('Avregistrera dig')
    expect(html).toContain('https://laglig.se/unsubscribe?token=abc123')
  })

  it('omits unsubscribe link when no unsubscribeUrl is provided', async () => {
    const html = await render(
      <LagligEmailLayout>
        <p>Body</p>
      </LagligEmailLayout>
    )

    expect(html).not.toContain('Avregistrera dig')
  })

  it('includes preview text when provided', async () => {
    const html = await render(
      <LagligEmailLayout preview="Du har en ny notifiering">
        <p>Body</p>
      </LagligEmailLayout>
    )

    expect(html).toContain('Du har en ny notifiering')
  })

  it('sets lang="sv" on html element', async () => {
    const html = await render(
      <LagligEmailLayout>
        <p>Body</p>
      </LagligEmailLayout>
    )

    expect(html).toContain('lang="sv"')
  })
})
