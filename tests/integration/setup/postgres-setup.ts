/**
 * PostgreSQL Integration Test Setup
 *
 * This file initializes the PostgreSQL test database connection
 * and handles schema migration before tests run.
 *
 * Note: This setup uses a direct PostgreSQL connection, separate from
 * the SQLite-based app prisma instance.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'child_process'

// PostgreSQL connection string - set as environment variable for Prisma 7 compatibility
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test'

// Set DATABASE_URL environment variable for PrismaClient (Prisma 7 requirement)
process.env.DATABASE_URL = DATABASE_URL

let isSetupComplete = false

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  if (isSetupComplete) return

  console.log('\n🐘 Setting up PostgreSQL test database...')

  try {
    // Check if PostgreSQL is available
    // In Prisma 7, datasources in constructor is removed - use DATABASE_URL env var instead
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    // Test connection
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ PostgreSQL connection successful')

    // Push schema to database (creates tables if needed)
    console.log('📦 Pushing schema to PostgreSQL...')
    execSync(
      'npx prisma db push --schema=prisma/schema.postgres.prisma --skip-generate --accept-data-loss',
      {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL },
      }
    )
    console.log('✅ Schema pushed successfully')

    await prisma.$disconnect()
    isSetupComplete = true
  } catch (error) {
    console.error('\n❌ PostgreSQL setup failed!')
    console.error('Make sure PostgreSQL is running:')
    console.error('  docker compose -f docker-compose.test.yml up -d')
    console.error('\nError:', error)
    throw error
  }
})

/**
 * Clean database before each test
 */
beforeEach(async () => {
  // Import dynamically to get the right client
  // DATABASE_URL env var is already set at module load time
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    // Truncate all tables in dependency order (PostgreSQL supports TRUNCATE CASCADE)
    await prisma.$executeRaw`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        -- Disable triggers temporarily for faster truncation
        SET session_replication_role = replica;

        -- Truncate all tables except _prisma_migrations
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations') LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;

        -- Re-enable triggers
        SET session_replication_role = DEFAULT;
      END $$;
    `
  } catch {
    // Fallback: delete in reverse dependency order
    try {
      await prisma.$transaction([
        prisma.signingEvidence.deleteMany(),
        prisma.openSignDocument.deleteMany(),
        prisma.calibrationResult.deleteMany(),
        prisma.certificateMasterInstrument.deleteMany(),
        prisma.parameter.deleteMany(),
        prisma.signature.deleteMany(),
        prisma.reviewFeedback.deleteMany(),
        prisma.certificateRevision.deleteMany(),
        prisma.certificateEvent.deleteMany(),
        prisma.approvalToken.deleteMany(),
        prisma.notification.deleteMany(),
        prisma.certificate.deleteMany(),
        prisma.masterInstrument.deleteMany(),
        prisma.customerRegistration.deleteMany(),
        prisma.customerUser.deleteMany(),
        prisma.customerAccount.deleteMany(),
        prisma.allowedGoogleEmail.deleteMany(),
        prisma.auditLog.deleteMany(),
        prisma.user.deleteMany(),
      ])
    } catch (deleteError) {
      console.warn('Warning: Could not clean database:', deleteError)
    }
  }

  await prisma.$disconnect()
})

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('\n🧹 PostgreSQL test cleanup complete')
})

// Export helper for tests to get PostgreSQL client
// DATABASE_URL env var is already set at module load time
export async function getPostgresPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}
