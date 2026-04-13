/**
 * Integration Test Fixtures
 *
 * Factory functions for creating test data in the database.
 * Each factory creates realistic data with sensible defaults
 * that can be overridden as needed.
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

// Default password hash for test users (password: 'test123')
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('test123', 10)

/**
 * Create a test user
 */
export async function createTestUser(
  prisma: PrismaClient,
  overrides: Partial<{
    email: string
    name: string
    role: string
    isAdmin: boolean
    isActive: boolean
    passwordHash: string
    assignedAdminId: string | null
  }> = {}
) {
  const defaults = {
    email: `user-${randomUUID()}@test.com`,
    name: 'Test User',
    role: 'ENGINEER',
    isAdmin: false,
    isActive: true, // Test users are assumed to be activated
    passwordHash: DEFAULT_PASSWORD_HASH,
    assignedAdminId: null,
  }

  return prisma.user.create({
    data: { ...defaults, ...overrides },
  })
}

/**
 * Create an engineer with an assigned Admin/Reviewer
 */
export async function createEngineerWithAdmin(prisma: PrismaClient) {
  const admin = await createTestUser(prisma, {
    name: 'Test Admin',
    role: 'ADMIN',
    isAdmin: true,
  })

  const engineer = await createTestUser(prisma, {
    name: 'Test Engineer',
    role: 'ENGINEER',
    assignedAdminId: admin.id,
  })

  return { engineer, admin }
}

/**
 * @deprecated Use createEngineerWithAdmin instead
 */
export const createEngineerWithHod = createEngineerWithAdmin

/**
 * Create a customer account
 */
export async function createCustomerAccount(
  prisma: PrismaClient,
  overrides: Partial<{
    companyName: string
    address: string
    contactEmail: string
    assignedAdminId: string | null
  }> = {}
) {
  const defaults = {
    companyName: `Test Company ${randomUUID().slice(0, 8)}`,
    address: '123 Test Street, Test City',
    contactEmail: 'contact@testcompany.com',
    assignedAdminId: null,
  }

  return prisma.customerAccount.create({
    data: { ...defaults, ...overrides },
  })
}

/**
 * Create a customer user
 */
export async function createCustomerUser(
  prisma: PrismaClient,
  customerAccountId: string,
  overrides: Partial<{
    email: string
    name: string
    passwordHash: string
  }> = {}
) {
  const defaults = {
    email: `customer-${randomUUID()}@test.com`,
    name: 'Test Customer',
    passwordHash: DEFAULT_PASSWORD_HASH,
  }

  return prisma.customerUser.create({
    data: {
      ...defaults,
      ...overrides,
      customerAccountId,
    },
  })
}

/**
 * Create a certificate with minimal required data
 */
export async function createTestCertificate(
  prisma: PrismaClient,
  createdById: string,
  overrides: Partial<{
    certificateNumber: string
    status: string
    customerName: string
    customerAddress: string
    uucDescription: string
    uucMake: string
    uucModel: string
    uucSerialNumber: string
  }> = {}
) {
  const certNumber = overrides.certificateNumber || `HTA/CAL/${Date.now()}/${randomUUID().slice(0, 4)}`

  const defaults = {
    certificateNumber: certNumber,
    status: 'DRAFT',
    customerName: 'Test Customer Pvt Ltd',
    customerAddress: '123 Test Street',
    uucDescription: 'Digital Multimeter',
    uucMake: 'Fluke',
    uucModel: '87V',
    uucSerialNumber: `SN-${randomUUID().slice(0, 8)}`,
    calibratedAt: 'LAB',
    currentRevision: 1,
  }

  return prisma.certificate.create({
    data: {
      ...defaults,
      ...overrides,
      createdById,
      lastModifiedById: createdById,
    },
  })
}

/**
 * Create a certificate with full workflow history
 */
export async function createCertificateWithHistory(
  prisma: PrismaClient,
  engineer: { id: string },
  admin: { id: string },
  status: string = 'PENDING_REVIEW'
) {
  const certificate = await createTestCertificate(prisma, engineer.id, { status })

  // Create initial event
  await prisma.certificateEvent.create({
    data: {
      certificateId: certificate.id,
      sequenceNumber: 1,
      revision: 1,
      eventType: 'CERTIFICATE_CREATED',
      eventData: JSON.stringify({ certificateNumber: certificate.certificateNumber }),
      userId: engineer.id,
      userRole: 'ENGINEER',
    },
  })

  // If submitted for review, add submission event
  if (status !== 'DRAFT') {
    await prisma.certificateEvent.create({
      data: {
        certificateId: certificate.id,
        sequenceNumber: 2,
        revision: 1,
        eventType: 'SUBMITTED_FOR_REVIEW',
        eventData: JSON.stringify({ submittedTo: admin.id }),
        userId: engineer.id,
        userRole: 'ENGINEER',
      },
    })
  }

  return certificate
}

/**
 * Create a parameter for a certificate
 */
export async function createTestParameter(
  prisma: PrismaClient,
  certificateId: string,
  overrides: Partial<{
    parameterName: string
    parameterUnit: string
    rangeMin: string
    rangeMax: string
  }> = {}
) {
  const defaults = {
    parameterName: 'Voltage',
    parameterUnit: 'V',
    rangeMin: '0',
    rangeMax: '1000',
    sortOrder: 0,
  }

  return prisma.parameter.create({
    data: {
      ...defaults,
      ...overrides,
      certificateId,
    },
  })
}

/**
 * Create calibration results for a parameter
 */
export async function createCalibrationResults(
  prisma: PrismaClient,
  parameterId: string,
  count: number = 5
) {
  const results = []

  for (let i = 1; i <= count; i++) {
    const result = await prisma.calibrationResult.create({
      data: {
        parameterId,
        pointNumber: i,
        standardReading: (i * 100).toString(),
        beforeAdjustment: (i * 100 + 0.5).toString(),
        errorObserved: 0.5,
        isOutOfLimit: false,
      },
    })
    results.push(result)
  }

  return results
}

/**
 * Create a notification
 */
export async function createTestNotification(
  prisma: PrismaClient,
  userId: string,
  certificateId: string | null = null,
  overrides: Partial<{
    type: string
    title: string
    message: string
    read: boolean
  }> = {}
) {
  const defaults = {
    type: 'CERTIFICATE_APPROVED',
    title: 'Certificate Approved',
    message: 'Your certificate has been approved.',
    read: false,
  }

  return prisma.notification.create({
    data: {
      ...defaults,
      ...overrides,
      userId,
      certificateId,
    },
  })
}

/**
 * Create a master instrument
 */
export async function createMasterInstrument(
  prisma: PrismaClient,
  createdById: string,
  overrides: Partial<{
    category: string
    description: string
    make: string
    model: string
    assetNumber: string
    serialNumber: string
  }> = {}
) {
  const instrumentId = randomUUID()

  const defaults = {
    instrumentId,
    category: 'Electro-Technical',
    description: 'Digital Multimeter',
    make: 'Fluke',
    model: '87V',
    assetNumber: `AST-${randomUUID().slice(0, 6)}`,
    serialNumber: `SN-${randomUUID().slice(0, 8)}`,
    version: 1,
    isLatest: true,
  }

  return prisma.masterInstrument.create({
    data: {
      ...defaults,
      ...overrides,
      createdById,
    },
  })
}

/**
 * Create a complete test scenario with all related entities
 */
export async function createFullTestScenario(prisma: PrismaClient) {
  // Create users
  const { engineer, admin } = await createEngineerWithAdmin(prisma)

  // Create customer
  const customerAccount = await createCustomerAccount(prisma, {
    assignedAdminId: admin.id,
  })
  const customerUser = await createCustomerUser(prisma, customerAccount.id)

  // Create certificate with parameters
  const certificate = await createCertificateWithHistory(prisma, engineer, admin, 'PENDING_REVIEW')
  const parameter = await createTestParameter(prisma, certificate.id)
  const results = await createCalibrationResults(prisma, parameter.id)

  // Create instrument
  const instrument = await createMasterInstrument(prisma, engineer.id)

  return {
    engineer,
    admin,
    customerAccount,
    customerUser,
    certificate,
    parameter,
    results,
    instrument,
  }
}
