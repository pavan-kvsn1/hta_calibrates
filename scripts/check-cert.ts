import { prisma } from '../src/lib/prisma'

async function main() {
  // Find the certificate
  const cert = await prisma.certificate.findFirst({
    where: { certificateNumber: 'HTA/C50457/02/26' },
    include: {
      approvalTokens: {
        include: { customer: true }
      },
      signatures: true
    }
  })

  if (!cert) {
    console.log('Certificate not found')
    return
  }

  console.log('=== Certificate Details ===')
  console.log('Certificate Number:', cert.certificateNumber)
  console.log('Status:', cert.status)
  console.log('Customer Name on Cert:', cert.customerName)
  console.log('')
  console.log('=== Approval Tokens ===')
  console.log('Total Tokens:', cert.approvalTokens.length)
  cert.approvalTokens.forEach(t => {
    console.log('  - Token for:', t.customer?.email)
    console.log('    Expires:', t.expiresAt)
    console.log('    Used:', t.usedAt ? 'Yes' : 'No')
    console.log('    Expired:', new Date() > t.expiresAt ? 'Yes' : 'No')
  })
  console.log('')
  console.log('=== Signatures ===')
  console.log('Total Signatures:', cert.signatures.length)
  cert.signatures.forEach(s => {
    console.log('  -', s.signerType, ':', s.signerEmail, 'at', s.signedAt)
  })

  // Check all customer users
  console.log('')
  console.log('=== All Customer Users ===')
  const customers = await prisma.customerUser.findMany({
    include: { customerAccount: true }
  })
  customers.forEach(c => {
    const companyName = c.customerAccount?.companyName || c.companyName || ''
    const matches = companyName.toLowerCase() === (cert.customerName || '').toLowerCase()
    console.log('Email:', c.email)
    console.log('  Company:', companyName)
    console.log('  Matches cert customer?', matches ? 'YES' : 'NO')
    console.log('')
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
