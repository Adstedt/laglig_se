import { Hr, Link, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DigestChange {
  lawTitle: string
  changeType: string // "Ändrad" | "Upphävd" | "Nytt avgörande"
  changeRef: string | null // "SFS 2026:145"
  effectiveDate: string | null
  summering: string | null
  kommentar: string | null
  sectionChanges: Array<{ label: string; type: string }>
  lawUrl: string
  pdfUrl: string | null
}

export interface AmendmentDigestEmailProps {
  userName: string | null
  workspaceName: string
  changes: DigestChange[]
  unsubscribeUrl: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AmendmentDigestEmail({
  userName = 'du',
  workspaceName = 'din arbetsyta',
  changes = [],
  unsubscribeUrl = '',
}: AmendmentDigestEmailProps) {
  return (
    <LagligEmailLayout
      preview={`${changes.length} lagändring${changes.length !== 1 ? 'ar' : ''} som påverkar lagar du bevakar`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Lagändringar upptäckta</Text>

      <Text style={paragraph}>
        Hej {userName ?? 'du'}! Det finns{' '}
        <strong>
          {changes.length} ändring{changes.length !== 1 ? 'ar' : ''}
        </strong>{' '}
        som påverkar lagar i bevakningslistan för{' '}
        <strong>{workspaceName}</strong>.
      </Text>

      {changes.map((change, i) => (
        <React.Fragment key={i}>
          <Section style={card}>
            {/* Title */}
            <Text style={cardTitle}>{change.lawTitle}</Text>

            {/* Badge + ref */}
            <Text style={cardMeta}>
              <span style={changeBadge}>{change.changeType}</span>
              {change.changeRef && ` genom ${change.changeRef}`}
            </Text>

            {/* Effective date */}
            {change.effectiveDate && (
              <Text style={cardDate}>
                Ikraftträdande: {change.effectiveDate}
              </Text>
            )}

            {/* Summering */}
            {change.summering && (
              <Section style={contentBlock}>
                <Text style={contentLabel}>Summering</Text>
                <Text style={contentText}>{change.summering}</Text>
              </Section>
            )}

            {/* Kommentar */}
            {change.kommentar && (
              <Section style={contentBlock}>
                <Text style={contentLabel}>Kommentar</Text>
                <Text style={contentText}>{change.kommentar}</Text>
              </Section>
            )}

            {/* Section changes */}
            {change.sectionChanges.length > 0 && (
              <Section style={sectionChangesBlock}>
                <Text style={contentLabel}>Berörda paragrafer</Text>
                {change.sectionChanges.map((sc, j) => (
                  <Text key={j} style={sectionChangeItem}>
                    {sc.label}
                  </Text>
                ))}
              </Section>
            )}

            {/* Links */}
            <Section style={linksRow}>
              <Link href={change.lawUrl} style={linkStyle}>
                Visa på Laglig.se
              </Link>
              {change.pdfUrl && (
                <>
                  {' · '}
                  <Link href={change.pdfUrl} style={linkStyle}>
                    Riksdagen PDF
                  </Link>
                </>
              )}
            </Section>
          </Section>

          {i < changes.length - 1 && <Hr style={cardDivider} />}
        </React.Fragment>
      ))}
    </LagligEmailLayout>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const heading: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#1a1a2e',
  margin: '0 0 16px',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#525f7f',
  margin: '0 0 20px',
}

const card: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '6px',
  padding: '16px',
  margin: '0 0 4px',
  borderLeft: '4px solid #2563eb',
}

const cardTitle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#1a1a2e',
  margin: '0 0 4px',
}

const cardMeta: React.CSSProperties = {
  fontSize: '13px',
  color: '#525f7f',
  margin: '0 0 4px',
}

const changeBadge: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
}

const cardDate: React.CSSProperties = {
  fontSize: '13px',
  color: '#8898aa',
  margin: '0 0 8px',
}

const contentBlock: React.CSSProperties = {
  margin: '8px 0 0',
}

const contentLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#8898aa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px',
}

const contentText: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '20px',
  color: '#525f7f',
  margin: '0',
}

const sectionChangesBlock: React.CSSProperties = {
  margin: '8px 0 0',
}

const sectionChangeItem: React.CSSProperties = {
  fontSize: '13px',
  color: '#525f7f',
  margin: '0',
  paddingLeft: '8px',
}

const linksRow: React.CSSProperties = {
  margin: '12px 0 0',
}

const linkStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#2563eb',
  textDecoration: 'underline',
}

const cardDivider: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '12px 0',
}

export default AmendmentDigestEmail
