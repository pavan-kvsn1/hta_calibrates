import { prisma } from '@/lib/prisma'

// Notification types
export type NotificationType =
  // Engineer notifications
  | 'REVISION_REQUESTED'        // HoD requested revision
  | 'CERTIFICATE_APPROVED'      // HoD approved certificate
  | 'SENT_TO_CUSTOMER'          // Certificate sent to customer
  | 'CERTIFICATE_FINALIZED'     // Customer approved certificate
  // HoD notifications
  | 'SUBMITTED_FOR_REVIEW'      // Engineer submitted for review
  | 'ENGINEER_RESPONDED'        // Engineer responded to revision
  | 'CUSTOMER_REVISION_REQUEST' // Customer requested revision
  | 'CUSTOMER_APPROVED'         // Customer approved certificate
  // Customer notifications
  | 'CERTIFICATE_READY'         // Certificate sent for approval
  | 'HOD_REPLIED'               // HoD replied to feedback
  // Registration notifications
  | 'REGISTRATION_SUBMITTED'    // Customer submitted registration (to Admin)
  | 'REGISTRATION_APPROVED'     // Admin approved registration (to Customer)
  | 'REGISTRATION_REJECTED'     // Admin rejected registration (to Customer)

// Notification templates for generating title and message
const notificationTemplates: Record<NotificationType, { title: string; message: (data: Record<string, string>) => string }> = {
  REVISION_REQUESTED: {
    title: 'Revision Requested',
    message: (data) => `HoD requested revision on ${data.certificateNumber}`,
  },
  CERTIFICATE_APPROVED: {
    title: 'Certificate Approved',
    message: (data) => `Your certificate ${data.certificateNumber} has been approved`,
  },
  SENT_TO_CUSTOMER: {
    title: 'Sent to Customer',
    message: (data) => `Certificate ${data.certificateNumber} has been sent to customer`,
  },
  CERTIFICATE_FINALIZED: {
    title: 'Certificate Finalized',
    message: (data) => `Customer approved certificate ${data.certificateNumber}`,
  },
  SUBMITTED_FOR_REVIEW: {
    title: 'Certificate Submitted',
    message: (data) => `${data.engineerName || 'Engineer'} submitted ${data.certificateNumber} for review`,
  },
  ENGINEER_RESPONDED: {
    title: 'Engineer Responded',
    message: (data) => `${data.engineerName || 'Engineer'} responded to revision request on ${data.certificateNumber}`,
  },
  CUSTOMER_REVISION_REQUEST: {
    title: 'Customer Revision Request',
    message: (data) => `Customer requested revision on ${data.certificateNumber}`,
  },
  CUSTOMER_APPROVED: {
    title: 'Customer Approved',
    message: (data) => `Customer approved certificate ${data.certificateNumber}`,
  },
  CERTIFICATE_READY: {
    title: 'Certificate Ready for Review',
    message: (data) => `Certificate ${data.certificateNumber} is ready for your review`,
  },
  HOD_REPLIED: {
    title: 'Response to Your Feedback',
    message: (data) => `HTA has responded to your feedback on ${data.certificateNumber}`,
  },
  REGISTRATION_SUBMITTED: {
    title: 'New Registration Request',
    message: (data) => `${data.name} (${data.email}) registered for ${data.companyName}`,
  },
  REGISTRATION_APPROVED: {
    title: 'Registration Approved',
    message: (data) => `Your account for ${data.companyName} has been approved. You can now login.`,
  },
  REGISTRATION_REJECTED: {
    title: 'Registration Update',
    message: (data) => `Your registration was not approved. Reason: ${data.reason || 'Not specified'}`,
  },
}

interface CreateNotificationParams {
  userId?: string
  customerId?: string
  type: NotificationType
  certificateId?: string
  data?: Record<string, string>
  // Optional custom title/message overrides
  title?: string
  message?: string
}

/**
 * Create a notification for a user or customer
 */
export async function createNotification({
  userId,
  customerId,
  type,
  certificateId,
  data = {},
  title,
  message,
}: CreateNotificationParams) {
  if (!userId && !customerId) {
    throw new Error('Either userId or customerId must be provided')
  }

  const template = notificationTemplates[type]
  const finalTitle = title || template.title
  const finalMessage = message || template.message(data)

  return prisma.notification.create({
    data: {
      userId,
      customerId,
      type,
      title: finalTitle,
      message: finalMessage,
      certificateId,
      data: Object.keys(data).length > 0 ? JSON.stringify(data) : null,
    },
  })
}

/**
 * Get notifications for a user or customer
 */
export async function getNotifications({
  userId,
  customerId,
  limit = 10,
  offset = 0,
  unreadOnly = false,
}: {
  userId?: string
  customerId?: string
  limit?: number
  offset?: number
  unreadOnly?: boolean
}) {
  if (!userId && !customerId) {
    throw new Error('Either userId or customerId must be provided')
  }

  const where = {
    ...(userId ? { userId } : { customerId }),
    ...(unreadOnly ? { read: false } : {}),
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
            status: true,
          },
        },
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        ...(userId ? { userId } : { customerId }),
        read: false,
      },
    }),
  ])

  return {
    notifications,
    total,
    unreadCount,
  }
}

/**
 * Get unread notification count for a user or customer
 */
export async function getUnreadCount({
  userId,
  customerId,
}: {
  userId?: string
  customerId?: string
}) {
  if (!userId && !customerId) {
    throw new Error('Either userId or customerId must be provided')
  }

  return prisma.notification.count({
    where: {
      ...(userId ? { userId } : { customerId }),
      read: false,
    },
  })
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead({
  notificationIds,
  userId,
  customerId,
  markAll = false,
}: {
  notificationIds?: string[]
  userId?: string
  customerId?: string
  markAll?: boolean
}) {
  if (!userId && !customerId) {
    throw new Error('Either userId or customerId must be provided')
  }

  const where = {
    ...(userId ? { userId } : { customerId }),
    read: false,
    ...(markAll ? {} : { id: { in: notificationIds || [] } }),
  }

  return prisma.notification.updateMany({
    where,
    data: {
      read: true,
      readAt: new Date(),
    },
  })
}

/**
 * Create notification for HoD when engineer submits for review
 */
export async function notifyHoDOnSubmit({
  certificateId,
  certificateNumber,
  engineerId,
  engineerName,
}: {
  certificateId: string
  certificateNumber: string
  engineerId: string
  engineerName: string
}) {
  // Find the engineer's assigned HoD
  const engineer = await prisma.user.findUnique({
    where: { id: engineerId },
    select: { assignedHodId: true },
  })

  if (!engineer?.assignedHodId) {
    // If no assigned HoD, notify all HoDs
    const hods = await prisma.user.findMany({
      where: { role: 'HOD', isActive: true },
      select: { id: true },
    })

    await Promise.all(
      hods.map((hod) =>
        createNotification({
          userId: hod.id,
          type: 'SUBMITTED_FOR_REVIEW',
          certificateId,
          data: { certificateNumber, engineerName },
        })
      )
    )
  } else {
    await createNotification({
      userId: engineer.assignedHodId,
      type: 'SUBMITTED_FOR_REVIEW',
      certificateId,
      data: { certificateNumber, engineerName },
    })
  }
}

/**
 * Create notification for engineer when HoD approves/requests revision
 */
export async function notifyEngineerOnReview({
  certificateId,
  certificateNumber,
  engineerId,
  approved,
}: {
  certificateId: string
  certificateNumber: string
  engineerId: string
  approved: boolean
}) {
  await createNotification({
    userId: engineerId,
    type: approved ? 'CERTIFICATE_APPROVED' : 'REVISION_REQUESTED',
    certificateId,
    data: { certificateNumber },
  })
}

/**
 * Create notification for HoD when engineer responds to revision
 */
export async function notifyHoDOnEngineerResponse({
  certificateId,
  certificateNumber,
  engineerId,
  engineerName,
  hodId,
}: {
  certificateId: string
  certificateNumber: string
  engineerId: string
  engineerName: string
  hodId?: string
}) {
  if (hodId) {
    await createNotification({
      userId: hodId,
      type: 'ENGINEER_RESPONDED',
      certificateId,
      data: { certificateNumber, engineerName },
    })
  } else {
    // Notify all HoDs if no specific HoD
    const hods = await prisma.user.findMany({
      where: { role: 'HOD', isActive: true },
      select: { id: true },
    })

    await Promise.all(
      hods.map((hod) =>
        createNotification({
          userId: hod.id,
          type: 'ENGINEER_RESPONDED',
          certificateId,
          data: { certificateNumber, engineerName },
        })
      )
    )
  }
}

/**
 * Create notifications when certificate is sent to customer
 */
export async function notifyOnSentToCustomer({
  certificateId,
  certificateNumber,
  engineerId,
  customerId,
}: {
  certificateId: string
  certificateNumber: string
  engineerId: string
  customerId?: string
}) {
  // Notify engineer
  await createNotification({
    userId: engineerId,
    type: 'SENT_TO_CUSTOMER',
    certificateId,
    data: { certificateNumber },
  })

  // Notify customer if we have their ID
  if (customerId) {
    await createNotification({
      customerId,
      type: 'CERTIFICATE_READY',
      certificateId,
      data: { certificateNumber },
    })
  }
}

/**
 * Create notification for HoD when customer requests revision
 */
export async function notifyHoDOnCustomerRevision({
  certificateId,
  certificateNumber,
}: {
  certificateId: string
  certificateNumber: string
}) {
  // Notify all HoDs
  const hods = await prisma.user.findMany({
    where: { role: 'HOD', isActive: true },
    select: { id: true },
  })

  await Promise.all(
    hods.map((hod) =>
      createNotification({
        userId: hod.id,
        type: 'CUSTOMER_REVISION_REQUEST',
        certificateId,
        data: { certificateNumber },
      })
    )
  )
}

/**
 * Create notification for customer when HoD replies to feedback
 */
export async function notifyCustomerOnHoDReply({
  certificateId,
  certificateNumber,
  customerId,
}: {
  certificateId: string
  certificateNumber: string
  customerId: string
}) {
  await createNotification({
    customerId,
    type: 'HOD_REPLIED',
    certificateId,
    data: { certificateNumber },
  })
}

/**
 * Create notifications when customer approves certificate
 */
export async function notifyOnCustomerApproval({
  certificateId,
  certificateNumber,
  engineerId,
}: {
  certificateId: string
  certificateNumber: string
  engineerId: string
}) {
  // Notify all HoDs
  const hods = await prisma.user.findMany({
    where: { role: 'HOD', isActive: true },
    select: { id: true },
  })

  await Promise.all([
    // Notify HoDs
    ...hods.map((hod) =>
      createNotification({
        userId: hod.id,
        type: 'CUSTOMER_APPROVED',
        certificateId,
        data: { certificateNumber },
      })
    ),
    // Notify engineer
    createNotification({
      userId: engineerId,
      type: 'CERTIFICATE_FINALIZED',
      certificateId,
      data: { certificateNumber },
    }),
  ])
}

/**
 * Create notification for admins when a new registration is submitted
 */
export async function notifyAdminsOnRegistration({
  registrationId,
  name,
  email,
  companyName,
}: {
  registrationId: string
  name: string
  email: string
  companyName: string
}) {
  // Notify all admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: 'REGISTRATION_SUBMITTED',
        data: { name, email, companyName, registrationId },
      })
    )
  )
}

/**
 * Create notification for customer when registration is approved
 */
export async function notifyCustomerOnRegistrationApproved({
  customerId,
  companyName,
}: {
  customerId: string
  companyName: string
}) {
  await createNotification({
    customerId,
    type: 'REGISTRATION_APPROVED',
    data: { companyName },
  })
}

/**
 * Create notification for customer when registration is rejected
 * Note: This creates a notification but the customer can't log in to see it
 * In practice, this would be sent via email instead
 */
export async function notifyCustomerOnRegistrationRejected({
  email,
  companyName,
  reason,
}: {
  email: string
  companyName: string
  reason: string
}) {
  // Since rejected customers can't log in, we would typically send an email
  // For now, we'll log this for potential email integration
  console.log(`Registration rejected for ${email} at ${companyName}. Reason: ${reason}`)
  // TODO: Send rejection email to customer
}
