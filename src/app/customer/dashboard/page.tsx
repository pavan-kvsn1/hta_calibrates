import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CustomerHeader } from '@/components/layout/CustomerHeader'
import { CustomerCertificateTable, CustomerCertificateItem } from '@/components/dashboard/CustomerCertificateTable'
import { Clock, MessageCircle, CheckCircle } from 'lucide-react'

async function getAllCertificates(customerEmail: string, companyName: string): Promise<CustomerCertificateItem[]> {
  const companyNameLower = companyName.toLowerCase()
  const allCertificates: CustomerCertificateItem[] = []

  // 1. Get PENDING_CUSTOMER_APPROVAL certificates (via token or company match)
  const [tokens, pendingCompanyMatch] = await Promise.all([
    prisma.approvalToken.findMany({
      where: {
        customer: { email: customerEmail },
        usedAt: null,
        expiresAt: { gt: new Date() },
        certificate: { status: 'PENDING_CUSTOMER_APPROVAL' },
      },
      include: { certificate: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.certificate.findMany({
      where: { status: 'PENDING_CUSTOMER_APPROVAL' },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  // Add token-based pending certificates
  const tokenCertIds = new Set<string>()
  tokens.forEach((token) => {
    tokenCertIds.add(token.certificate.id)
    allCertificates.push({
      id: token.certificate.id,
      certificateNumber: token.certificate.certificateNumber,
      status: 'pending_approval',
      uucDescription: token.certificate.uucDescription,
      dateOfCalibration: token.certificate.dateOfCalibration?.toISOString() || null,
      calibrationDueDate: token.certificate.calibrationDueDate?.toISOString() || null,
      sentAt: token.createdAt.toISOString(),
      tokenId: token.token,
      hasToken: true,
      hodResponse: null,
      hodName: null,
      respondedAt: null,
      approvedAt: null,
    })
  })

  // Add company-matched pending certificates (without tokens)
  pendingCompanyMatch
    .filter(cert => !tokenCertIds.has(cert.id) && cert.customerName?.toLowerCase() === companyNameLower)
    .forEach(cert => {
      allCertificates.push({
        id: cert.id,
        certificateNumber: cert.certificateNumber,
        status: 'pending_approval',
        uucDescription: cert.uucDescription,
        dateOfCalibration: cert.dateOfCalibration?.toISOString() || null,
        calibrationDueDate: cert.calibrationDueDate?.toISOString() || null,
        sentAt: cert.updatedAt.toISOString(),
        tokenId: null,
        hasToken: false,
        hodResponse: null,
        hodName: null,
        respondedAt: null,
        approvedAt: null,
      })
    })

  // 2. Get CUSTOMER_REVISION_REQUIRED certificates with HoD replies (awaiting response)
  const revisionCerts = await prisma.certificate.findMany({
    where: { status: 'CUSTOMER_REVISION_REQUIRED' },
    include: {
      events: {
        where: { eventType: 'HOD_REPLIED_TO_CUSTOMER' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { user: { select: { name: true } } },
      },
    },
  })

  revisionCerts
    .filter(cert => cert.customerName?.toLowerCase() === companyNameLower && cert.events.length > 0)
    .forEach(cert => {
      const hodEvent = cert.events[0]
      let eventData: { response?: string; resendCertificate?: boolean } = {}
      try {
        eventData = JSON.parse(hodEvent.eventData)
      } catch {
        eventData = {}
      }

      // Only include if HoD didn't resend (otherwise it would be in pending)
      if (!eventData.resendCertificate) {
        allCertificates.push({
          id: cert.id,
          certificateNumber: cert.certificateNumber,
          status: 'awaiting_response',
          uucDescription: cert.uucDescription,
          dateOfCalibration: cert.dateOfCalibration?.toISOString() || null,
          calibrationDueDate: cert.calibrationDueDate?.toISOString() || null,
          sentAt: null,
          tokenId: null,
          hasToken: false,
          hodResponse: eventData.response || 'HoD has responded to your feedback',
          hodName: hodEvent.user?.name || null,
          respondedAt: hodEvent.createdAt.toISOString(),
          approvedAt: null,
        })
      }
    })

  // 3. Get APPROVED certificates (signed by this customer)
  const signatures = await prisma.signature.findMany({
    where: {
      signerEmail: customerEmail,
      signerType: 'CUSTOMER',
      certificate: { status: 'APPROVED' },
    },
    include: { certificate: true },
    orderBy: { signedAt: 'desc' },
  })

  signatures.forEach((sig) => {
    allCertificates.push({
      id: sig.certificate.id,
      certificateNumber: sig.certificate.certificateNumber,
      status: 'approved',
      uucDescription: sig.certificate.uucDescription,
      dateOfCalibration: sig.certificate.dateOfCalibration?.toISOString() || null,
      calibrationDueDate: sig.certificate.calibrationDueDate?.toISOString() || null,
      sentAt: null,
      tokenId: null,
      hasToken: false,
      hodResponse: null,
      hodName: null,
      respondedAt: null,
      approvedAt: sig.signedAt.toISOString(),
    })
  })

  return allCertificates
}

async function getStats(certificates: CustomerCertificateItem[]) {
  return {
    pending: certificates.filter(c => c.status === 'pending_approval').length,
    awaiting: certificates.filter(c => c.status === 'awaiting_response').length,
    approved: certificates.filter(c => c.status === 'approved').length,
  }
}

export default async function CustomerDashboard() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'CUSTOMER') {
    redirect('/customer/login')
  }

  const customerEmail = session.user.email!

  // Get customer's company name for matching certificates
  const customer = await prisma.customerUser.findUnique({
    where: { email: customerEmail },
    select: { companyName: true },
  })
  const companyName = customer?.companyName || ''

  const certificates = await getAllCertificates(customerEmail, companyName)
  const stats = await getStats(certificates)

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader title="Dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pending Approval</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.awaiting}</p>
                <p className="text-sm text-gray-500">Awaiting Response</p>
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
        </div>

        {/* Section Header */}
        <h2 className="text-xl font-semibold text-gray-900 mb-6">My Certificates</h2>

        {/* Certificate Table with Filters */}
        <CustomerCertificateTable certificates={certificates} />
      </main>
    </div>
  )
}
