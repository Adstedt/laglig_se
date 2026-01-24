import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline - Laglig.se',
  description: 'Du är för närvarande offline',
}

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
