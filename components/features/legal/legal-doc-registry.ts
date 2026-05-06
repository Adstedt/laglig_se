// Single source of truth for the public legal pages: maps URL slugs to the
// markdown file in docs/legal/ and supplies titles/subtitles consumed by the
// sidebar, page <Metadata>, sitemap, and document hero.

export type LegalDocSlug =
  | 'villkor'
  | 'integritetspolicy'
  | 'cookiepolicy'
  | 'personuppgiftsbitradesavtal'
  | 'underbitraden'

export type LegalDoc = {
  slug: LegalDocSlug
  file: string
  title: string
  subtitle: string
}

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    slug: 'villkor',
    file: 'anvandarvillkor.md',
    title: 'Användarvillkor',
    subtitle:
      'Avtal mellan Grro Technologies AB och dig som beställare/användare av Tjänsten.',
  },
  {
    slug: 'integritetspolicy',
    file: 'integritetspolicy.md',
    title: 'Integritetspolicy',
    subtitle:
      'Hur vi behandlar personuppgifter enligt GDPR och svensk dataskyddslagstiftning.',
  },
  {
    slug: 'cookiepolicy',
    file: 'cookiepolicy.md',
    title: 'Cookiepolicy',
    subtitle:
      'Vilka cookies och liknande tekniker vi använder, och hur du hanterar samtycke.',
  },
  {
    slug: 'personuppgiftsbitradesavtal',
    file: 'personuppgiftsbitradesavtal.md',
    title: 'Personuppgiftsbiträdesavtal',
    subtitle:
      'PuB-mall (Art. 28 GDPR) som utgör bilaga till Användarvillkoren när Kunden är personuppgiftsansvarig.',
  },
  {
    slug: 'underbitraden',
    file: 'underbitraden.md',
    title: 'Underbiträdesförteckning',
    subtitle:
      'Aktuell lista över underbiträden ("sub-processors") som behandlar personuppgifter för Laglig.ses räkning.',
  },
] as const

export function getLegalDoc(slug: LegalDocSlug): LegalDoc {
  const doc = LEGAL_DOCS.find((d) => d.slug === slug)
  if (!doc) throw new Error(`Unknown legal doc slug: ${slug}`)
  return doc
}
