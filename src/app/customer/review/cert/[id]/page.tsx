import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CustomerReviewClient } from '../../[token]/CustomerReviewClient'

interface Props {
  params: Promise<{ id: string }>
}

interface RevisionHistoryItem {
  id: string
  type: 'customer_request' | 'hod_response' | 'sent_to_customer'
  message: string
  createdAt: string
  userName?: string
  companyName?: string
}

async function getRevisionHistory(certificateId: string): Promise<RevisionHistoryItem[]> {
  const events = await prisma.certificateEvent.findMany({
    where: {
      certificateId,
      eventType: {
        in: [
          'SENT_TO_CUSTOMER',
          'CUSTOMER_REVISION_REQUESTED',
          'HOD_REPLIED_TO_CUSTOMER',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true },
      },
    },
  })

  return events.map(event => {
    let eventData: Record<string, string> = {}
    try {
      eventData = JSON.parse(event.eventData)
    } catch {
      eventData = {}
    }

    let type: RevisionHistoryItem['type'] = 'sent_to_customer'
    let message = ''

    if (event.eventType === 'CUSTOMER_REVISION_REQUESTED') {
      type = 'customer_request'
      message = eventData.notes || 'Revision requested'
    } else if (event.eventType === 'HOD_REPLIED_TO_CUSTOMER') {
      type = 'hod_response'
      message = eventData.response || 'HoD responded to your feedback'
    } else if (event.eventType === 'SENT_TO_CUSTOMER') {
      type = 'sent_to_customer'
      // If this is a resend with response to feedback, show that
      message = eventData.responseToFeedback || eventData.message || 'Certificate sent for review'
    }

    return {
      id: event.id,
      type,
      message,
      createdAt: event.createdAt.toISOString(),
      userName: event.eventType === 'CUSTOMER_REVISION_REQUESTED'
        ? eventData.customerName
        : event.user?.name,
      companyName: eventData.customerCompany,
    }
  })
}

export default async function CustomerCertReviewPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  // Must be logged in as customer
  if (!session?.user || session.user.role !== 'CUSTOMER') {
    redirect('/customer/login')
  }

  const customerEmail = session.user.email!

  // Get customer info
  const customer = await prisma.customerUser.findUnique({
    where: { email: customerEmail },
    include: { customerAccount: true },
  })

  if (!customer) {
    redirect('/customer/login')
  }

  // Get certificate
  const certificate = await prisma.certificate.findUnique({
    where: { id },
  })

  if (!certificate) {
    notFound()
  }

  // Get company name from customerAccount (preferred) or fallback to legacy companyName field
  const customerCompanyName = customer.customerAccount?.companyName || customer.companyName || ''

  // Verify access: certificate's customerName must match customer's companyName
  // Allow access for various customer-relevant statuses
  const allowedStatuses = [
    'PENDING_CUSTOMER_APPROVAL',
    'CUSTOMER_REVISION_REQUIRED',
    'REVISION_REQUIRED',
    'APPROVED',
    'PENDING_ADMIN_AUTHORIZATION',
    'PENDING_ADMIN_APPROVAL',
    'AUTHORIZED',
  ]
  const hasAccess =
    allowedStatuses.includes(certificate.status) &&
    !!customerCompanyName &&
    certificate.customerName?.toLowerCase() === customerCompanyName.toLowerCase()

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to review this certificate.
          </p>
          <div className="space-y-3">
            <a
              href="/customer/dashboard"
              className="block w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Go to Dashboard
            </a>
            <p className="text-sm text-gray-500">
              Need help?{' '}
              <a href="mailto:calibration@htainstruments.com" className="text-green-600 hover:underline">
                Contact HTA
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Transform data for client component
  const certificateData = {
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    status: certificate.status,
    customerName: certificate.customerName,
    customerAddress: certificate.customerAddress,
    uucDescription: certificate.uucDescription,
    uucMake: certificate.uucMake,
    uucModel: certificate.uucModel,
    uucSerialNumber: certificate.uucSerialNumber,
    dateOfCalibration: certificate.dateOfCalibration?.toISOString() || null,
    calibrationDueDate: certificate.calibrationDueDate?.toISOString() || null,
    currentRevision: certificate.currentRevision,
  }

  const customerData = {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    companyName: customerCompanyName,
  }

  // Fetch revision history for this certificate
  const revisionHistory = await getRevisionHistory(certificate.id)

  // For cert-based review, we use the certificate ID as a pseudo-token
  // The API endpoints will need to handle this
  return (
    <CustomerReviewClient
      token={`cert:${certificate.id}`}
      certificate={certificateData}
      customer={customerData}
      expiresAt={null}
      revisionHistory={revisionHistory}
    />
  )
}
