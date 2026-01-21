import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { CertificateTable, CertificateListItem } from '@/components/dashboard/CertificateTable'
import { Clock, CheckCircle, XCircle, FileText } from 'lucide-react'

async function getPendingCertificates(hodId: string): Promise<CertificateListItem[]> {
  // Get certificates from engineers assigned to this HoD
  const certificates = await prisma.certificate.findMany({
    where: {
      OR: [
        { status: 'PENDING_HOD_REVIEW' },
        {
          createdBy: {
            assignedHodId: hodId,
          },
        },
      ],
    },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: {
          customerName: true,
          uucDescription: true,
          dateOfCalibration: true,
        },
      },
      createdBy: {
        select: { name: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return certificates.map((cert) => {
    const latestVersion = cert.versions[0]
    return {
      id: cert.id,
      certificateNumber: cert.certificateNumber,
      status: cert.status,
      customerName: latestVersion?.customerName || '-',
      uucDescription: latestVersion?.uucDescription || '-',
      dateOfCalibration: latestVersion?.dateOfCalibration?.toISOString() || '',
      currentVersion: cert.currentVersion,
      createdAt: cert.createdAt.toISOString(),
    }
  })
}

async function getStats(hodId: string) {
  // Get certificates from engineers assigned to this HoD
  const [pendingReview, approved, revision, total] = await Promise.all([
    prisma.certificate.count({
      where: {
        status: 'PENDING_HOD_REVIEW',
        createdBy: { assignedHodId: hodId },
      },
    }),
    prisma.certificate.count({
      where: {
        status: { in: ['APPROVED', 'PENDING_CUSTOMER_APPROVAL'] },
        createdBy: { assignedHodId: hodId },
      },
    }),
    prisma.certificate.count({
      where: {
        status: 'REVISION_REQUIRED',
        createdBy: { assignedHodId: hodId },
      },
    }),
    prisma.certificate.count({
      where: {
        createdBy: { assignedHodId: hodId },
      },
    }),
  ])

  return { pendingReview, approved, revision, total }
}

export default async function HoDDashboard() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Only HoD and Admin can access this page
  if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const [certificates, stats] = await Promise.all([
    getPendingCertificates(session.user.id),
    getStats(session.user.id),
  ])

  // Filter to show only pending review by default
  const pendingCertificates = certificates.filter(
    (cert) => cert.status === 'PENDING_HOD_REVIEW'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader title="HoD Dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4 border-l-4 border-l-yellow-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingReview}</p>
                <p className="text-sm text-gray-500">Pending Review</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <XCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.revision}</p>
                <p className="text-sm text-gray-500">Revision Required</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Certificates</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Review Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Pending Review ({pendingCertificates.length})
          </h2>
          <CertificateTable
            certificates={pendingCertificates}
            userRole="HOD"
          />
        </div>

        {/* All Certificates Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            All Team Certificates
          </h2>
          <CertificateTable certificates={certificates} userRole="HOD" />
        </div>
      </main>
    </div>
  )
}
