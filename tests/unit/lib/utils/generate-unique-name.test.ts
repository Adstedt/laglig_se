import { describe, it, expect } from 'vitest'
import { generateUniqueName } from '@/lib/utils/generate-unique-name'

describe('generateUniqueName', () => {
  it('returns base name when no duplicates exist', () => {
    expect(generateUniqueName('Arbetsmiljö', [])).toBe('Arbetsmiljö')
  })

  it('returns base name when existing names are different', () => {
    expect(generateUniqueName('Arbetsmiljö', ['GDPR', 'Ekonomi'])).toBe(
      'Arbetsmiljö'
    )
  })

  it('appends " (2)" when base name exists', () => {
    expect(generateUniqueName('Arbetsmiljö', ['Arbetsmiljö'])).toBe(
      'Arbetsmiljö (2)'
    )
  })

  it('appends " (3)" when base and " (2)" exist', () => {
    expect(
      generateUniqueName('Arbetsmiljö', ['Arbetsmiljö', 'Arbetsmiljö (2)'])
    ).toBe('Arbetsmiljö (3)')
  })

  it('finds next available suffix with gaps', () => {
    expect(
      generateUniqueName('Arbetsmiljö', [
        'Arbetsmiljö',
        'Arbetsmiljö (2)',
        'Arbetsmiljö (3)',
      ])
    ).toBe('Arbetsmiljö (4)')
  })
})
