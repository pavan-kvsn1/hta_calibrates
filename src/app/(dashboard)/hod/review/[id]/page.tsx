import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { ReviewActions } from './ReviewActions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: {
          parameters: {
            include: {
              results: true,
            },
          },
          masterInstruments: {
            include: {
              masterInstrument: true,
            },
          },
          reviewComments: {
            orderBy: { createdAt: 'desc' },
            include: {
              authorUser: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  })

  return certificate
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

  const latestVersion = certificate.versions[0]

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader title="Review Certificate" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          href="/hod/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Certificate Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {certificate.certificateNumber}
                  </h1>
                  <p className="text-gray-500">Version {certificate.currentVersion}</p>
                </div>
                <StatusBadge status={certificate.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Created By</p>
                  <p className="font-medium">{certificate.createdBy.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Customer</p>
                  <p className="font-medium">{latestVersion?.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date of Calibration</p>
                  <p className="font-medium">
                    {latestVersion?.dateOfCalibration
                      ? formatDate(latestVersion.dateOfCalibration)
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Calibration Due</p>
                  <p className="font-medium">
                    {latestVersion?.calibrationDueDate
                      ? formatDate(latestVersion.calibrationDueDate)
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* UUC Details */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Unit Under Calibration
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Description</p>
                  <p className="font-medium">{latestVersion?.uucDescription || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Make</p>
                  <p className="font-medium">{latestVersion?.uucMake || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Model</p>
                  <p className="font-medium">{latestVersion?.uucModel || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Serial Number</p>
                  <p className="font-medium">{latestVersion?.uucSerialNumber || '-'}</p>
                </div>
              </div>
            </div>

            {/* Calibration Results */}
            {latestVersion?.parameters && latestVersion.parameters.length > 0 && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Calibration Results
                </h2>
                {latestVersion.parameters.map((param) => (
                  <div key={param.id} className="mb-6 last:mb-0">
                    <h3 className="font-medium text-gray-800 mb-2">
                      {param.parameterName} ({param.parameterUnit})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Sl.No</th>
                            <th className="px-3 py-2 text-left">Standard</th>
                            <th className="px-3 py-2 text-left">UUC Reading</th>
                            <th className="px-3 py-2 text-left">Error</th>
                            <th className="px-3 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {param.results.map((result) => (
                            <tr key={result.id}>
                              <td className="px-3 py-2">{result.pointNumber}</td>
                              <td className="px-3 py-2">{result.standardReading}</td>
                              <td className="px-3 py-2">{result.beforeAdjustment}</td>
                              <td className="px-3 py-2">{result.errorObserved}</td>
                              <td className="px-3 py-2">
                                {result.isOutOfLimit ? (
                                  <span className="text-red-600 font-medium">Out of Limit</span>
                                ) : (
                                  <span className="text-green-600">Pass</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Previous Comments */}
            {latestVersion?.reviewComments && latestVersion.reviewComments.length > 0 && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Review Comments
                </h2>
                <div className="space-y-4">
                  {latestVersion.reviewComments.map((comment) => (
                    <div key={comment.id} className="border-l-4 border-gray-200 pl-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {comment.authorUser?.name || 'System'}
                        </span>
                        <span className="text-gray-500">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700 mt-1">{comment.commentText}</p>
                      <span className="text-xs text-gray-500">
                        Section: {comment.sectionReference}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Review Actions Sidebar */}
          <div className="lg:col-span-1">
            <ReviewActions
              certificateId={certificate.id}
              currentStatus={certificate.status}
              versionId={latestVersion?.id || ''}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
