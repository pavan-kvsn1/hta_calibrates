import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeJsonParse } from '@/lib/utils/safe-json'
import { cached, CacheKeys, CacheTTL } from '@/lib/cache'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerEmail = session.user.email!

    // Cache customer dashboard data for 30 seconds - data changes when certificates update
    const dashboardData = await cached(
      CacheKeys.customerDashboard(customerEmail),
      async () => {

    // Get customer's company name for matching certificates
    const customer = await prisma.customerUser.findUnique({
      where: { email: customerEmail },
      include: { customerAccount: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const companyName = customer.customerAccount?.companyName || customer.companyName || ''
    const companyNameLower = companyName.toLowerCase()

    // Check if user is the Primary POC
    const isPrimaryPoc = customer.customerAccount?.primaryPocId === customer.id

    // Count total users for the account (for Users tab badge)
    const userCount = customer.customerAccount ? await prisma.customerUser.count({
      where: { customerAccountId: customer.customerAccount.id }
    }) : 0

    // Fetch all data in parallel
    const [
      pendingTokens,
      pendingCompanyMatch,
      awaitingCerts,
      completedSignatures,
      authorizedCerts,
      masterInstruments,
    ] = await Promise.all([
      // 1. Pending Review: Certificates with active tokens
      prisma.approvalToken.findMany({
        where: {
          customer: { email: customerEmail },
          usedAt: null,
          expiresAt: { gt: new Date() },
          certificate: { status: 'PENDING_CUSTOMER_APPROVAL' },
        },
        include: {
          certificate: {
            include: {
              events: {
                where: { eventType: 'SENT_TO_CUSTOMER' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 2. Pending Review: Company-matched certificates without tokens
      prisma.certificate.findMany({
        where: { status: 'PENDING_CUSTOMER_APPROVAL' },
        orderBy: { updatedAt: 'desc' },
      }),

      // 3. Awaiting Response: Certificates in these statuses
      prisma.certificate.findMany({
        where: {
          status: { in: ['PENDING_REVIEW', 'CUSTOMER_REVISION_REQUIRED', 'REVISION_REQUIRED'] },
        },
        include: {
          events: {
            where: {
              eventType: { in: ['CUSTOMER_REVISION_REQUESTED', 'ADMIN_REPLIED_TO_CUSTOMER'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 2,
            include: { user: { select: { name: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // 4. Completed: Customer signatures on PENDING_ADMIN_AUTHORIZATION certs
      prisma.signature.findMany({
        where: {
          signerEmail: customerEmail,
          signerType: 'CUSTOMER',
          certificate: { status: 'PENDING_ADMIN_AUTHORIZATION' },
        },
        include: {
          certificate: {
            include: {
              signatures: {
                select: { signerType: true },
              },
            },
          },
        },
        orderBy: { signedAt: 'desc' },
      }),

      // 5. Authorized: Customer signatures on AUTHORIZED or legacy APPROVED certs
      prisma.signature.findMany({
        where: {
          signerEmail: customerEmail,
          signerType: 'CUSTOMER',
          certificate: { status: { in: ['AUTHORIZED', 'APPROVED'] } },
        },
        include: { certificate: true },
        orderBy: { signedAt: 'desc' },
      }),

      // 6. Traceability: Master instruments used in customer's certificates
      // Note: SQLite doesn't support case-insensitive matching, so we filter in JS
      prisma.certificateMasterInstrument.findMany({
        include: {
          certificate: {
            select: {
              id: true,
              certificateNumber: true,
              uucDescription: true,
              dateOfCalibration: true,
              customerName: true,
            },
          },
        },
      }),
    ])

    // Process Pending Review data
    const tokenCertIds = new Set(pendingTokens.map((t) => t.certificate.id))
    const pending = [
      // Token-based pending
      ...pendingTokens.map((token) => {
        let adminMessage: string | null = null
        if (token.certificate.events[0]) {
          const data = safeJsonParse<Record<string, string>>(token.certificate.events[0].eventData, {})
          adminMessage = data.message || null
        }
        return {
          id: token.certificate.id,
          certificateNumber: token.certificate.certificateNumber,
          uucDescription: token.certificate.uucDescription,
          uucMake: token.certificate.uucMake,
          uucModel: token.certificate.uucModel,
          sentAt: token.createdAt.toISOString(),
          expiresAt: token.expiresAt.toISOString(),
          tokenId: token.token,
          hasToken: true,
          adminMessage,
          srfNumber: token.certificate.srfNumber,
          dateOfCalibration: token.certificate.dateOfCalibration?.toISOString() || null,
        }
      }),
      // Company-matched pending (no token)
      ...pendingCompanyMatch
        .filter(
          (cert) =>
            !tokenCertIds.has(cert.id) &&
            cert.customerName?.toLowerCase() === companyNameLower
        )
        .map((cert) => ({
          id: cert.id,
          certificateNumber: cert.certificateNumber,
          uucDescription: cert.uucDescription,
          uucMake: cert.uucMake,
          uucModel: cert.uucModel,
          sentAt: cert.updatedAt.toISOString(),
          expiresAt: null,
          tokenId: null,
          hasToken: false,
          adminMessage: null,
          srfNumber: cert.srfNumber,
          dateOfCalibration: cert.dateOfCalibration?.toISOString() || null,
        })),
    ]

    // Process Awaiting Response data
    const awaiting = awaitingCerts
      .filter((cert) => cert.customerName?.toLowerCase() === companyNameLower)
      .map((cert) => {
        const customerEvent = cert.events.find((e) => e.eventType === 'CUSTOMER_REVISION_REQUESTED')
        const adminEvent = cert.events.find((e) => e.eventType === 'ADMIN_REPLIED_TO_CUSTOMER')

        let customerFeedback: string | null = null
        let feedbackDate: string | null = null
        let adminResponse: string | null = null
        let adminName: string | null = null
        let respondedAt: string | null = null

        if (customerEvent) {
          const data = safeJsonParse<Record<string, string>>(customerEvent.eventData, {})
          customerFeedback = data.notes || data.feedback || null
          feedbackDate = customerEvent.createdAt.toISOString()
        }

        if (adminEvent) {
          const data = safeJsonParse<Record<string, string>>(adminEvent.eventData, {})
          adminResponse = data.response || null
          adminName = adminEvent.user?.name || null
          respondedAt = adminEvent.createdAt.toISOString()
        }

        return {
          id: cert.id,
          certificateNumber: cert.certificateNumber,
          uucDescription: cert.uucDescription,
          uucMake: cert.uucMake,
          uucModel: cert.uucModel,
          updatedAt: cert.updatedAt.toISOString(),
          internalStatus: cert.status as 'PENDING_REVIEW' | 'CUSTOMER_REVISION_REQUIRED' | 'REVISION_REQUIRED',
          customerFeedback,
          feedbackDate,
          adminResponse,
          adminName,
          respondedAt,
        }
      })

    // Process Completed data
    const completed = completedSignatures.map((sig) => {
      const sigTypes = sig.certificate.signatures.map((s) => s.signerType)
      return {
        id: sig.certificate.id,
        certificateNumber: sig.certificate.certificateNumber,
        uucDescription: sig.certificate.uucDescription,
        uucMake: sig.certificate.uucMake,
        uucModel: sig.certificate.uucModel,
        signedAt: sig.signedAt.toISOString(),
        signerName: sig.signerName,
        hasEngineerSig: sigTypes.includes('ASSIGNEE'),
        hasReviewerSig: sigTypes.includes('REVIEWER'),
        hasCustomerSig: sigTypes.includes('CUSTOMER'),
        hasAdminSig: sigTypes.includes('ADMIN'),
      }
    })

    // Process Authorized data
    const authorized = authorizedCerts.map((sig) => ({
      id: sig.certificate.id,
      certificateNumber: sig.certificate.certificateNumber,
      uucDescription: sig.certificate.uucDescription,
      uucMake: sig.certificate.uucMake,
      uucModel: sig.certificate.uucModel,
      dateOfCalibration: sig.certificate.dateOfCalibration?.toISOString() || null,
      calibrationDueDate: sig.certificate.calibrationDueDate?.toISOString() || null,
      signedPdfPath: sig.certificate.signedPdfPath,
    }))

    // Process Traceability data - group by master instrument
    // Filter to only include instruments used in this customer's certificates
    const filteredMasterInstruments = masterInstruments.filter(
      (cmi) => cmi.certificate.customerName?.toLowerCase() === companyNameLower
    )

    const instrumentMap = new Map<string, {
      id: string
      description: string
      serialNumber: string | null
      category: string | null
      make: string | null
      model: string | null
      reportNo: string | null
      calibrationDueDate: string | null
      calibratedAt: string | null
      certificatesUsedIn: {
        id: string
        certificateNumber: string
        uucDescription: string | null
        dateOfCalibration: string | null
      }[]
    }>()

    for (const cmi of filteredMasterInstruments) {
      const key = cmi.masterInstrumentId
      if (!instrumentMap.has(key)) {
        instrumentMap.set(key, {
          id: key,
          description: cmi.description || 'Unknown Instrument',
          serialNumber: cmi.serialNumber,
          category: cmi.category,
          make: cmi.make,
          model: cmi.model,
          reportNo: cmi.reportNo,
          calibrationDueDate: cmi.calibrationDueDate,
          calibratedAt: cmi.calibratedAt,
          certificatesUsedIn: [],
        })
      }
      instrumentMap.get(key)!.certificatesUsedIn.push({
        id: cmi.certificate.id,
        certificateNumber: cmi.certificate.certificateNumber,
        uucDescription: cmi.certificate.uucDescription,
        dateOfCalibration: cmi.certificate.dateOfCalibration?.toISOString() || null,
      })
    }

    const traceability = Array.from(instrumentMap.values())

    // Calculate counts
    const counts = {
      pending: pending.length,
      awaiting: awaiting.length,
      completed: completed.length,
      authorized: authorized.length,
      traceability: traceability.length,
    }

    return {
      counts,
      pending,
      awaiting,
      completed,
      authorized,
      traceability,
      isPrimaryPoc,
      companyName,
      userCount,
    }
      },
      { ttl: CacheTTL.VERY_SHORT } // 30 seconds - customer data changes with certificate updates
    )

    return NextResponse.json(dashboardData)
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch customer dashboard data')
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
