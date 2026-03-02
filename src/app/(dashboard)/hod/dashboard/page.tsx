import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { CertificateTable, CertificateListItem } from '@/components/dashboard/CertificateTable'
import { Clock, CheckCircle, XCircle, FileText, MessageSquare } from 'lucide-react'

async function getTeamCertificates(hodId: string): Promise<CertificateListItem[]> {
  // Get certificates from engineers assigned to this HoD (excluding drafts)
  const certificates = await prisma.certificate.findMany({
    where: {
      createdBy: {
        assignedHodId: hodId,
      },
      // Exclude drafts - HoD should only see submitted certificates
      status: {
        not: 'DRAFT',
      },
    },
    include: {
      createdBy: {
        select: { name: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return certificates.map((cert) => ({
    id: cert.id,
    certificateNumber: cert.certificateNumber,
    status: cert.status,
    customerName: cert.customerName || '-',
    uucDescription: cert.uucDescription || '-',
    dateOfCalibration: cert.dateOfCalibration?.toISOString() || '',
    currentVersion: cert.currentRevision,
    createdAt: cert.createdAt.toISOString(),
    createdBy: cert.createdBy.name,
  }))
}

async function getStats(hodId: string) {
  // Get certificates from engineers assigned to this HoD (excluding drafts)
  const [pendingReview, approved, revision, customerRevision, total] = await Promise.all([
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
        status: 'CUSTOMER_REVISION_REQUIRED',
        createdBy: { assignedHodId: hodId },
      },
    }),
    prisma.certificate.count({
      where: {
        createdBy: { assignedHodId: hodId },
        // Exclude drafts from total count
        status: { not: 'DRAFT' },
      },
    }),
  ])

  return { pendingReview, approved, revision, customerRevision, total }
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
    getTeamCertificates(session.user.id),
    getStats(session.user.id),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="HoD Dashboard" showAutoSave={false} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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

          <div className="bg-white rounded-lg border p-4 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.customerRevision}</p>
                <p className="text-sm text-gray-500">Customer Revision</p>
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
