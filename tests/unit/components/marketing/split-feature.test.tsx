import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SplitFeature } from '@/components/marketing/sections/split-feature'

const media = {
  type: 'screenshot' as const,
  src: '/images/marketing/funktioner/kontroller/cycle.webp',
  alt: 'Kontrollcykel i Laglig',
}

describe('<SplitFeature> (QA-26.1-3)', () => {
  it('renders media, eyebrow, title and copy', () => {
    render(
      <SplitFeature
        eyebrow="Kontroller"
        title="Cykler per område"
        media={media}
      >
        <p>Beskrivande text.</p>
      </SplitFeature>
    )
    expect(
      screen.getByRole('heading', { name: 'Cykler per område' })
    ).toBeTruthy()
    expect(screen.getByText('Kontroller')).toBeTruthy()
    expect(screen.getByAltText('Kontrollcykel i Laglig')).toBeTruthy()
    expect(screen.getByText('Beskrivande text.')).toBeTruthy()
  })

  it('alternates sides: mediaSide="right" flips column order via lg:order classes', () => {
    const { container: left } = render(
      <SplitFeature title="Vänster" media={media}>
        <p>copy</p>
      </SplitFeature>
    )
    const { container: right } = render(
      <SplitFeature title="Höger" media={media} mediaSide="right">
        <p>copy</p>
      </SplitFeature>
    )
    expect(left.querySelector('.lg\\:order-2')).toBeNull()
    const flippedMediaCol = right.querySelector('.lg\\:order-2')
    expect(flippedMediaCol).not.toBeNull()
    expect(flippedMediaCol?.querySelector('img')).not.toBeNull()
    expect(right.querySelector('.lg\\:order-1')).not.toBeNull()
  })

  it('renders a photo without the browser chrome frame', () => {
    const { container } = render(
      <SplitFeature
        title="Foto"
        media={{
          type: 'photo',
          src: '/images/marketing/people/team.webp',
          alt: 'Team',
        }}
      >
        <p>copy</p>
      </SplitFeature>
    )
    // ScreenshotFrame renders a <figure>; plain photos must not
    expect(container.querySelector('figure')).toBeNull()
    expect(screen.getByAltText('Team')).toBeTruthy()
  })
})
