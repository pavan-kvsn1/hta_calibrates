import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Render at runtime, not build time (needs database)
export const dynamic = 'force-dynamic'

export default async function NewCertificatePage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Only ENGINEER and ADMIN can create certificates
  if (session.user.role !== 'ENGINEER' && session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  // Generate a temporary certificate number (user will update in form)
  const timestamp = Date.now()
  const tempNumber = `DRAFT-${timestamp}`

  // Create a new draft certificate
  const certificate = await prisma.certificate.create({
    data: {
      certificateNumber: tempNumber,
      status: 'DRAFT',
      currentRevision: 1,
      calibratedAt: 'HTA Calibration Laboratory',
      createdById: session.user.id,
      lastModifiedById: session.user.id,
    },
  })

  // Redirect to the edit page
  redirect(`/dashboard/certificates/${certificate.id}/edit`)
}
