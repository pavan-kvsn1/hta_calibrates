import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { CertificateTable, CertificateListItem } from '@/components/dashboard/CertificateTable'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'

async function getCertificates(userId: string): Promise<CertificateListItem[]> {
  const certificates = await prisma.certificate.findMany({
    where: {
      createdById: userId,
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
  }))
}

async function getStats(userId: string) {
  const [draft, pending, approved, revision] = await Promise.all([
    prisma.certificate.count({
      where: { createdById: userId, status: 'DRAFT' },
    }),
    prisma.certificate.count({
      where: {
        createdById: userId,
        status: { in: ['PENDING_HOD_REVIEW', 'PENDING_CUSTOMER_APPROVAL'] },
      },
    }),
    prisma.certificate.count({
      where: { createdById: userId, status: 'APPROVED' },
    }),
    prisma.certificate.count({
      where: {
        createdById: userId,
        status: { in: ['REVISION_REQUIRED', 'CUSTOMER_REVISION_REQUIRED'] },
      },
    }),
  ])

  return { draft, pending, approved, revision }
}

export default async function EngineerDashboard() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Redirect HoD users to their dashboard
  if (session.user.role === 'HOD') {
    redirect('/hod/dashboard')
  }

  // Redirect Admin users to admin dashboard
  if (session.user.role === 'ADMIN') {
    redirect('/admin')
  }

  const [certificates, stats] = await Promise.all([
    getCertificates(session.user.id),
    getStats(session.user.id),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Engineer Dashboard" showAutoSave={false} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
                <p className="text-sm text-gray-500">Drafts</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
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
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.revision}</p>
                <p className="text-sm text-gray-500">Need Revision</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">My Certificates</h2>
          <Link href="/certificates/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Certificate
            </Button>
          </Link>
        </div>

        {/* Certificate Table */}
        <CertificateTable certificates={certificates} userRole="ENGINEER" />
      </main>
    </div>
  )
}
