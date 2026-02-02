import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { ReviewActions } from './ReviewActions'
import { ReviewContent } from './ReviewContent'
import { ArrowLeft, Shield, FileText } from 'lucide-react'
import Link from 'next/link'
import { CONCLUSION_STATEMENTS } from '@/components/pdf/pdf-utils'
import { cn } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

async function getCertificateDetails(id: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { name: true, email: true },
      },
      parameters: {
        include: {
          results: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      masterInstruments: true,
      feedbacks: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true },
          },
        },
      },
    },
  })

  return certificate
}

// Status color mapping for header
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
  PENDING_HOD_REVIEW: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  REVISION_REQUIRED: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  PENDING_CUSTOMER_APPROVAL: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  APPROVED: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  REJECTED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
}

export default async function HoDReviewPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const certificate = await getCertificateDetails(id)

  if (!certificate) {
    notFound()
  }

  const statusColors = STATUS_COLORS[certificate.status] || STATUS_COLORS.DRAFT

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Review Certificate" showAutoSave={false} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Link */}
        <Link
          href="/hod/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Certificate Header Card */}
        <div
          className={cn(
            'rounded-2xl border-2 p-6 mb-6 shadow-sm',
            statusColors.bg,
            statusColors.border
          )}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-xl bg-white shadow-sm', statusColors.border)}>
                <FileText className={cn('h-8 w-8', statusColors.text)} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {certificate.certificateNumber}
                  </h1>
                  <StatusBadge status={certificate.status} />
                </div>
                <p className="text-gray-500 text-sm">
                  Revision {certificate.currentRevision} • Created by{' '}
                  <span className="font-medium text-gray-700">{certificate.createdBy.name}</span>
                </p>
              </div>
            </div>

            {/* Quick Info Pills */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700">
                <Shield className="h-3.5 w-3.5" />
                {certificate.calibratedAt === 'LAB' ? 'Lab Calibration' : 'Site Calibration'}
              </span>
              {certificate.srfNumber && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700">
                  SRF: {certificate.srfNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Certificate Details - Left Column (2/3) */}
          <div className="lg:col-span-2">
            <ReviewContent
              certificate={certificate}
              conclusionStatements={CONCLUSION_STATEMENTS}
            />
          </div>

          {/* Review Actions Sidebar - Right Column (1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-[80px]">
              <ReviewActions
                certificateId={certificate.id}
                currentStatus={certificate.status}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
