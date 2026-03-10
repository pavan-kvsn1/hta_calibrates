/**
 * Email Worker
 *
 * Handles background processing of email jobs:
 * - email:send - Send a single email
 * - email:batch - Send multiple emails
 *
 * Currently logs to console (development mode).
 * Replace with actual email provider (SendGrid, etc.) for production.
 */

import { Job, JobWorker } from '../types'

// Email templates (placeholder - would typically load from files or CMS)
const emailTemplates: Record<string, { subject: string; body: (data: Record<string, unknown>) => string }> = {
  'certificate-submitted': {
    subject: 'Certificate Submitted for Review',
    body: (data) => `
      A new certificate has been submitted for your review.

      Certificate: ${data.certificateNumber}
      Submitted by: ${data.assigneeName}

      Please log in to review.
    `,
  },
  'certificate-approved': {
    subject: 'Certificate Approved',
    body: (data) => `
      Your certificate has been approved.

      Certificate: ${data.certificateNumber}

      The certificate will now be sent to the customer for approval.
    `,
  },
  'revision-requested': {
    subject: 'Revision Requested',
    body: (data) => `
      A revision has been requested for your certificate.

      Certificate: ${data.certificateNumber}

      Please log in to view the feedback and make the requested changes.
    `,
  },
  'customer-review': {
    subject: 'Certificate Ready for Your Review',
    body: (data) => `
      A calibration certificate is ready for your review.

      Certificate: ${data.certificateNumber}

      Click the link below to review and approve:
      ${data.reviewUrl}

      This link will expire in 7 days.
    `,
  },
  'new-chat-message': {
    subject: 'New Message on Certificate',
    body: (data) => `
      You have a new message regarding certificate ${data.certificateNumber}.

      From: ${data.senderName}

      Please log in to view and respond.
    `,
  },
  'customer-activation': {
    subject: 'Activate Your HTA Calibration Portal Account',
    body: (data) => `
      Hello ${data.userName},

      Your account has been created for ${data.companyName} on the HTA Calibration Portal.

      To activate your account and set your password, please click the link below:
      ${data.activationUrl}

      This link will expire in 7 days.

      If you did not expect this email, please contact your company administrator or HTA Instrumentation.

      Best regards,
      HTA Instrumentation (P) Ltd.
    `,
  },
  'request-approved': {
    subject: 'Your Request Has Been Approved',
    body: (data) => `
      Hello,

      Your ${data.requestType === 'USER_ADDITION' ? 'user addition' : 'POC change'} request has been approved.

      ${data.requestType === 'USER_ADDITION'
        ? `New user ${data.userName} (${data.userEmail}) has been added to your account. They will receive an activation email.`
        : `${data.newPocName} is now the Primary Point of Contact for ${data.companyName}.`}

      Company: ${data.companyName}
      Approved by: ${data.approvedBy}
      Approved on: ${data.approvedDate}

      Best regards,
      HTA Instrumentation (P) Ltd.
    `,
  },
  'request-rejected': {
    subject: 'Your Request Has Been Rejected',
    body: (data) => `
      Hello,

      Unfortunately, your ${data.requestType === 'USER_ADDITION' ? 'user addition' : 'POC change'} request has been rejected.

      Company: ${data.companyName}
      Reason: ${data.rejectionReason}
      Reviewed by: ${data.reviewedBy}
      Reviewed on: ${data.reviewedDate}

      If you have questions, please contact HTA Instrumentation.

      Best regards,
      HTA Instrumentation (P) Ltd.
    `,
  },
}

/**
 * Process single email
 */
export const emailSendWorker: JobWorker<'email:send'> = async (job) => {
  const { to, subject, template, templateData, text, html } = job.payload

  let finalSubject = subject
  let finalBody = text || ''

  // Apply template if specified
  if (template && emailTemplates[template]) {
    const tpl = emailTemplates[template]
    finalSubject = subject || tpl.subject
    finalBody = tpl.body(templateData || {})
  }

  // In development, log to console
  if (process.env.NODE_ENV !== 'production' || process.env.EMAIL_PROVIDER === 'console') {
    console.log('\n' + '='.repeat(60))
    console.log('📧 EMAIL (Development Mode)')
    console.log('='.repeat(60))
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`)
    console.log(`Subject: ${finalSubject}`)
    console.log(`Template: ${template || 'none'}`)
    console.log('\n--- Body ---')
    console.log(finalBody || html?.substring(0, 500))
    console.log('='.repeat(60) + '\n')
    return
  }

  // Production: Use configured email provider
  // This is where you'd integrate SendGrid, SES, etc.
  // For now, throw if we reach here without implementation
  throw new Error('Production email sending not configured. Set EMAIL_PROVIDER=sendgrid and configure SENDGRID_API_KEY')
}

/**
 * Process batch emails
 */
export const emailBatchWorker: JobWorker<'email:batch'> = async (job) => {
  const { emails } = job.payload

  if (emails.length === 0) {
    return
  }

  // Process each email (could be parallelized with Promise.all for production)
  for (const email of emails) {
    const { to, subject, template, templateData } = email

    let finalSubject = subject
    let finalBody = ''

    if (template && emailTemplates[template]) {
      const tpl = emailTemplates[template]
      finalSubject = subject || tpl.subject
      finalBody = tpl.body(templateData || {})
    }

    // Log in development
    if (process.env.NODE_ENV !== 'production' || process.env.EMAIL_PROVIDER === 'console') {
      console.log(`[EmailWorker] Would send to ${to}: ${finalSubject}`)
    }
  }

  console.log(`[EmailWorker] Processed ${emails.length} emails in batch`)
}

// Export workers map
export const emailWorkers = {
  'email:send': emailSendWorker,
  'email:batch': emailBatchWorker,
}
