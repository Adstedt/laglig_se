import { Navbar } from '@/components/shared/navigation/navbar'
import { Footer } from '@/components/shared/navigation/footer'

interface PublicLayoutProps {
  children: React.ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}
