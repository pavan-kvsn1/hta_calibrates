/**
 * Integration Test Database Setup
 *
 * Provides utilities for setting up and tearing down a test database
 * for integration tests that require real database interactions.
 *
 * Note: Integration tests require a properly configured PostgreSQL database.
 * They will be skipped if the database cannot be initialized.
 */

import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | null = null
let setupError: Error | null = null

/**
 * Initialize the test database
 * Uses the postgres-setup module for PostgreSQL connection.
 * Tests should use cleanTestDatabase() between tests to ensure isolation.
 */
export async function setupTestDatabase(): Promise<PrismaClient> {
  try {
    // Use the PostgreSQL-specific setup
    const postgresModule = await import('./postgres-setup')
    prisma = await postgresModule.getPostgresPrisma()

    // Verify connection works
    await prisma.$queryRaw`SELECT 1`

    return prisma
  } catch (error) {
    setupError = error instanceof Error ? error : new Error(String(error))
    throw new Error(
      `Failed to initialize test database. Integration tests require a configured PostgreSQL database. Error: ${setupError.message}`
    )
  }
}

/**
 * Get the current test Prisma client
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.')
  }
  return prisma
}

/**
 * Clean up all data from the test database
 * Useful for resetting between tests
 */
export async function cleanTestDatabase(): Promise<void> {
  if (!prisma) return

  // Use a transaction to ensure all deletes complete atomically
  // Delete in reverse order of dependencies (leaves first, roots last)
  try {
    await prisma.$transaction(async (tx) => {
      // Child tables first (no dependencies)
      await tx.signingEvidence.deleteMany()
      await tx.openSignDocument.deleteMany()
      await tx.calibrationResult.deleteMany()
      await tx.certificateMasterInstrument.deleteMany()
      await tx.parameter.deleteMany()
      await tx.signature.deleteMany()
      await tx.reviewFeedback.deleteMany()
      await tx.certificateRevision.deleteMany()
      await tx.certificateEvent.deleteMany()
      await tx.approvalToken.deleteMany()
      await tx.notification.deleteMany()

      // Chat tables
      await tx.chatMessage.deleteMany()
      await tx.chatThread.deleteMany()

      // Internal requests (depends on certificate and user)
      await tx.internalRequest.deleteMany()

      // Certificate depends on user
      await tx.certificate.deleteMany()

      // Master instrument depends on user
      await tx.masterInstrument.deleteMany()

      // Customer tables (delete in order of dependencies)
      await tx.customerRequest.deleteMany()
      await tx.customerRegistration.deleteMany()
      await tx.customerUser.deleteMany()
      await tx.customerAccount.deleteMany()

      // Independent tables
      await tx.allowedGoogleEmail.deleteMany()
      await tx.auditLog.deleteMany()

      // User last (many things depend on it)
      await tx.user.deleteMany()
    })
  } catch (error) {
    console.error('Error cleaning test database:', error)
    // If transaction fails, individual deletes may also fail
    // This indicates a real issue with the database state
  }
}

/**
 * Tear down the test database
 * Note: We don't disconnect since we're using the app's shared prisma instance
 */
export async function teardownTestDatabase(): Promise<void> {
  // Clean up test data but don't disconnect the shared client
  await cleanTestDatabase()
  prisma = null
}

/**
 * Run a function within a transaction that gets rolled back
 * Useful for tests that shouldn't persist changes
 */
export async function withRollback<T>(
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  const client = getTestPrisma()

  try {
    // Use interactive transaction
    const result = await client.$transaction(async (tx) => {
      const value = await fn(tx)
      // Throw to rollback
      throw { __rollback: true, value }
    })
    return result
  } catch (e: unknown) {
    if (e && typeof e === 'object' && '__rollback' in e) {
      return (e as { value: T }).value
    }
    throw e
  }
}
