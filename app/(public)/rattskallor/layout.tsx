import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
}

interface RattskallolLayoutProps {
  children: React.ReactNode
}

export default function RattskallolLayout({
  children,
}: RattskallolLayoutProps) {
  return <>{children}</>
}
