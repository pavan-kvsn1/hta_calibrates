import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Redirect non-customers to appropriate login
  if (!session?.user) {
    redirect('/customer/login')
  }

  if (session.user.role !== 'CUSTOMER') {
    // Staff users should go to staff dashboard
    redirect('/dashboard')
  }

  return <>{children}</>
}
