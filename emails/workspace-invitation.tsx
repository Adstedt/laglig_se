import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface WorkspaceInvitationEmailProps {
  workspaceName: string
  inviterName: string
  roleLabel: string
  acceptUrl: string
  unsubscribeUrl: string
}

export function WorkspaceInvitationEmail({
  workspaceName = 'Arbetsplats',
  inviterName = 'En kollega',
  roleLabel = 'Medlem',
  acceptUrl = '',
  unsubscribeUrl = '',
}: WorkspaceInvitationEmailProps) {
  return (
    <LagligEmailLayout
      preview={`${inviterName} har bjudit in dig till ${workspaceName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Du har blivit inbjuden till {workspaceName}</Text>

      <Text style={paragraph}>
        <strong>{inviterName}</strong> har bjudit in dig som{' '}
        <strong>{roleLabel}</strong> till arbetsplatsen{' '}
        <strong>{workspaceName}</strong> på Laglig.se.
      </Text>

      <Section style={ctaRow}>
        <Button href={acceptUrl} style={ctaButton}>
          Acceptera inbjudan
        </Button>
      </Section>

      <Text style={paragraph}>
        Inbjudan gäller i 7 dagar. Efter det måste en administratör skicka en ny
        inbjudan.
      </Text>
    </LagligEmailLayout>
  )
}

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

const ctaRow: React.CSSProperties = {
  margin: '16px 0 20px',
}

const ctaButton: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
}

export default WorkspaceInvitationEmail
