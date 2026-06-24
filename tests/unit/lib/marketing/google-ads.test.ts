import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * `GOOGLE_ADS_ID` and the conversion labels are module-level consts read from
 * env at import time, so each test stubs env, resets the module registry, and
 * dynamically imports a fresh copy.
 */
async function loadModule() {
  vi.resetModules()
  return import('@/lib/marketing/google-ads')
}

describe('trackAdsConversion', () => {
  const gtag = vi.fn()

  beforeEach(() => {
    gtag.mockReset()
    vi.unstubAllEnvs()
    // jsdom provides window; attach a gtag stub by default.
    ;(window as unknown as { gtag?: typeof gtag }).gtag = gtag
  })

  afterEach(() => {
    delete (window as unknown as { gtag?: typeof gtag }).gtag
    vi.unstubAllEnvs()
  })

  it('fires the conversion with the correct send_to when id + label are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456789')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'abcDEF123')
    const { trackAdsConversion } = await loadModule()

    trackAdsConversion('signup')

    expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: 'AW-123456789/abcDEF123',
    })
  })

  it('includes value, currency, and transaction_id when provided', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456789')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'abcDEF123')
    const { trackAdsConversion } = await loadModule()

    trackAdsConversion('signup', {
      value: 499,
      currency: 'SEK',
      transactionId: 'user_42',
    })

    expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: 'AW-123456789/abcDEF123',
      value: 499,
      currency: 'SEK',
      transaction_id: 'user_42',
    })
  })

  it('no-ops when the ads account id is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', '')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'abcDEF123')
    const { trackAdsConversion } = await loadModule()

    trackAdsConversion('signup')

    expect(gtag).not.toHaveBeenCalled()
  })

  it('no-ops when the conversion label is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456789')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', '')
    const { trackAdsConversion } = await loadModule()

    trackAdsConversion('signup')

    expect(gtag).not.toHaveBeenCalled()
  })

  it('no-ops when gtag has not loaded (no marketing consent)', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456789')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'abcDEF123')
    delete (window as unknown as { gtag?: typeof gtag }).gtag
    const { trackAdsConversion } = await loadModule()

    expect(() => trackAdsConversion('signup')).not.toThrow()
  })
})

describe('trackAdsRemarketingEvent', () => {
  const gtag = vi.fn()

  beforeEach(() => {
    gtag.mockReset()
    vi.unstubAllEnvs()
    ;(window as unknown as { gtag?: typeof gtag }).gtag = gtag
  })

  afterEach(() => {
    delete (window as unknown as { gtag?: typeof gtag }).gtag
    vi.unstubAllEnvs()
  })

  it('fires the named event with send_to and params when the id is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456789')
    const { trackAdsRemarketingEvent } = await loadModule()

    trackAdsRemarketingEvent('org_preview_completed', {
      industry: 'Bygg',
      areaCount: 7,
    })

    expect(gtag).toHaveBeenCalledWith('event', 'org_preview_completed', {
      send_to: 'AW-123456789',
      industry: 'Bygg',
      areaCount: 7,
    })
  })

  it('no-ops when the ads account id is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', '')
    const { trackAdsRemarketingEvent } = await loadModule()

    trackAdsRemarketingEvent('org_preview_completed')

    expect(gtag).not.toHaveBeenCalled()
  })

  it('no-ops when gtag has not loaded (no marketing consent)', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456789')
    delete (window as unknown as { gtag?: typeof gtag }).gtag
    const { trackAdsRemarketingEvent } = await loadModule()

    expect(() =>
      trackAdsRemarketingEvent('org_preview_completed')
    ).not.toThrow()
  })
})
