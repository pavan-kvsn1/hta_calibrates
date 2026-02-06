import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { CustomerReviewClient } from './CustomerReviewClient'

interface TokenData {
  id: string
  token: string
  expiresAt: Date
  usedAt: Date | null
  certificate: {
    id: string
    certificateNumber: string
    status: string
    customerName: string | null
    customerAddress: string | null
    uucDescription: string | null
    uucMake: string | null
    uucModel: string | null
    uucSerialNumber: string | null
    dateOfCalibration: Date | null
    calibrationDueDate: Date | null
    currentRevision: number
  }
  customer: {
    id: string
    name: string
    email: string
    companyName: string
  }
}

interface RevisionHistoryItem {
  id: string
  type: 'customer_request' | 'hod_response' | 'sent_to_customer'
  message: string
  createdAt: string
  userName?: string
  companyName?: string
}

async function validateToken(token: string): Promise<{
  valid: boolean
  error?: 'EXPIRED' | 'INVALID' | 'USED' | 'REVOKED'
  data?: TokenData
}> {
  const tokenRecord = await prisma.approvalToken.findUnique({
    where: { token },
    include: {
      certificate: true,
      customer: true,
    },
  })

  if (!tokenRecord) {
    return { valid: false, error: 'INVALID' }
  }

  if (tokenRecord.usedAt) {
    return { valid: false, error: 'USED' }
  }

  if (new Date() > tokenRecord.expiresAt) {
    return { valid: false, error: 'EXPIRED' }
  }

  // Check if certificate is still in the right status
  if (tokenRecord.certificate.status !== 'PENDING_CUSTOMER_APPROVAL') {
    return { valid: false, error: 'USED' }
  }

  return {
    valid: true,
    data: tokenRecord as TokenData,
  }
}

async function getRevisionHistory(certificateId: string): Promise<RevisionHistoryItem[]> {
  const events = await prisma.certificateEvent.findMany({
    where: {
      certificateId,
      eventType: {
        in: [
          'SENT_TO_CUSTOMER',
          'CUSTOMER_REVISION_REQUESTED',
          'CUSTOMER_REVISION_FORWARDED',
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

function TokenErrorPage({ error }: { error: 'EXPIRED' | 'INVALID' | 'USED' | 'REVOKED' }) {
  const errorMessages = {
    EXPIRED: {
      title: 'Link Expired',
      message: 'This review link has expired. Please contact HTA for a new link.',
    },
    INVALID: {
      title: 'Invalid Link',
      message: 'This review link is invalid. Please check the link or contact HTA.',
    },
    USED: {
      title: 'Already Reviewed',
      message: 'This certificate has already been reviewed. Check your dashboard for the status.',
    },
    REVOKED: {
      title: 'Access Revoked',
      message: 'Access to this certificate has been revoked. Please contact HTA for assistance.',
    },
  }

  const { title, message } = errorMessages[error]

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
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="space-y-3">
          <a
            href="/customer/login"
            className="block w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Go to Customer Portal
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

export default async function CustomerReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await validateToken(token)

  if (!result.valid || !result.data) {
    return <TokenErrorPage error={result.error!} />
  }

  const { data } = result

  // Update view count (fire and forget)
  prisma.approvalToken.update({
    where: { id: data.id },
    data: {
      // We'll add viewedAt and viewCount fields later if needed
    },
  }).catch(() => {})

  // Fetch revision history for this certificate
  const revisionHistory = await getRevisionHistory(data.certificate.id)

  // Transform dates to strings for client component
  const certificateData = {
    id: data.certificate.id,
    certificateNumber: data.certificate.certificateNumber,
    status: data.certificate.status,
    customerName: data.certificate.customerName,
    customerAddress: data.certificate.customerAddress,
    uucDescription: data.certificate.uucDescription,
    uucMake: data.certificate.uucMake,
    uucModel: data.certificate.uucModel,
    uucSerialNumber: data.certificate.uucSerialNumber,
    dateOfCalibration: data.certificate.dateOfCalibration?.toISOString() || null,
    calibrationDueDate: data.certificate.calibrationDueDate?.toISOString() || null,
    currentRevision: data.certificate.currentRevision,
  }

  const customerData = {
    id: data.customer.id,
    name: data.customer.name,
    email: data.customer.email,
    companyName: data.customer.companyName,
  }

  return (
    <CustomerReviewClient
      token={token}
      certificate={certificateData}
      customer={customerData}
      expiresAt={data.expiresAt.toISOString()}
      revisionHistory={revisionHistory}
    />
  )
}
