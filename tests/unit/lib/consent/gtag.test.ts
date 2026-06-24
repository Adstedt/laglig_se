import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyConsent, categoriesToConsentParams } from '@/lib/consent/gtag'

describe('categoriesToConsentParams', () => {
  it('maps marketing → ad signals and analytics → analytics_storage', () => {
    const params = categoriesToConsentParams({
      analytics: true,
      marketing: true,
    })
    expect(params.analytics_storage).toBe('granted')
    expect(params.ad_storage).toBe('granted')
    expect(params.ad_user_data).toBe('granted')
    // ad_personalization follows marketing — grants remarketing audiences.
    expect(params.ad_personalization).toBe('granted')
  })

  it('denies ad + analytics storage when categories are off', () => {
    const params = categoriesToConsentParams({
      analytics: false,
      marketing: false,
    })
    expect(params.analytics_storage).toBe('denied')
    expect(params.ad_storage).toBe('denied')
    expect(params.ad_user_data).toBe('denied')
    expect(params.ad_personalization).toBe('denied')
  })
})

describe('applyConsent', () => {
  const gtag = vi.fn()

  beforeEach(() => {
    gtag.mockReset()
    // The global stub installed by <ConsentModeBootstrap /> in <head>.
    ;(window as unknown as { gtag?: typeof gtag }).gtag = gtag
  })

  afterEach(() => {
    delete (window as unknown as { gtag?: typeof gtag }).gtag
  })

  // Regression guard: the consent update MUST go through the global gtag stub
  // (which does `dataLayer.push(arguments)`). A prior bug pushed a plain array
  // to dataLayer, which gtag.js silently ignores — leaving consent default-denied
  // and breaking all GA4/Ads measurement.
  it('issues the consent update via the global gtag stub (not a raw array push)', () => {
    applyConsent({ analytics: true, marketing: true })

    expect(gtag).toHaveBeenCalledTimes(1)
    const [command, action, params] = gtag.mock.calls[0]
    expect(command).toBe('consent')
    expect(action).toBe('update')
    expect(params).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
    })
  })
})
