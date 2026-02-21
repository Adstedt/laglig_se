import { Resend } from 'resend'
import React from 'react'
import { LagligEmailLayout } from '../emails/components/laglig-email-layout'

const TestNotificationEmail = () => (
  <LagligEmailLayout
    preview="Testnotifiering från Laglig.se"
    unsubscribeUrl="https://laglig.se/unsubscribe?token=test-placeholder"
  >
    <h2 style={{ color: '#1a1a2e', fontSize: '18px', margin: '0 0 16px' }}>
      Ny uppgift tilldelad
    </h2>
    <p style={{ color: '#525f7f', fontSize: '15px', lineHeight: '24px' }}>
      Du har blivit tilldelad en ny uppgift i arbetsytan{' '}
      <strong>Arbetsmiljö AB</strong>:
    </p>
    <div
      style={{
        backgroundColor: '#f6f9fc',
        borderRadius: '6px',
        padding: '16px',
        margin: '16px 0',
        borderLeft: '4px solid #2563eb',
      }}
    >
      <p
        style={{
          color: '#1a1a2e',
          fontSize: '15px',
          fontWeight: 600,
          margin: '0 0 4px',
        }}
      >
        Granska AFS 2023:2 — Uppdaterade föreskrifter
      </p>
      <p style={{ color: '#8898aa', fontSize: '13px', margin: 0 }}>
        Förfallodatum: 2026-03-01
      </p>
    </div>
    <a
      href="https://laglig.se"
      style={{
        display: 'inline-block',
        backgroundColor: '#2563eb',
        color: '#ffffff',
        padding: '10px 20px',
        borderRadius: '6px',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 600,
        marginTop: '8px',
      }}
    >
      Visa uppgift
    </a>
  </LagligEmailLayout>
)

async function main() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY not set')
    process.exit(1)
  }

  const resend = new Resend(apiKey)

  const { data, error } = await resend.emails.send({
    from: 'Laglig.se <notifieringar@laglig.se>',
    to: 'alexander.adstedt@kontorab.se',
    subject: 'Ny uppgift tilldelad — Arbetsmiljö AB',
    react: React.createElement(TestNotificationEmail),
  })

  if (error) {
    console.error('Failed to send:', error)
    process.exit(1)
  }

  console.log('Email sent successfully! ID:', data?.id)
}

main()
