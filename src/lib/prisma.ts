import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma Client Configuration
 *
 * Supports two modes:
 * 1. Direct Connection (default): Uses @prisma/adapter-pg with connection pooling
 * 2. Prisma Accelerate: When DATABASE_URL starts with 'prisma://'
 *    - Provides edge caching, connection pooling, and query caching
 *    - Set DIRECT_URL for migrations
 *
 * Environment Variables:
 * - DATABASE_URL: Connection string (postgresql:// or prisma://)
 * - DIRECT_URL: Direct PostgreSQL URL (for migrations when using Accelerate)
 * - PRISMA_ACCELERATE_ENABLED: Set to 'true' to force Accelerate mode
 */

const connectionString = process.env.DATABASE_URL || 'postgresql://hta_user:hta_dev_password@127.0.0.1:5432/hta_calibration'

// Check if using Prisma Accelerate (prisma:// URL or explicit flag)
const isAccelerate = connectionString.startsWith('prisma://') ||
  process.env.PRISMA_ACCELERATE_ENABLED === 'true'

// Create Prisma Client based on connection type
function createPrismaClient(): PrismaClient {
  if (isAccelerate) {
    // Prisma Accelerate mode - no adapter needed
    // Accelerate handles connection pooling, caching at the edge
    console.log('[Prisma] Using Prisma Accelerate')
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }

  // Direct connection mode with pg adapter
  // Use 127.0.0.1 instead of localhost - Windows may resolve localhost to IPv6 (::1)
  // which fails when Cloud SQL Proxy only listens on IPv4
  console.log('[Prisma] Using direct PostgreSQL connection with pg adapter')

  const pool = new Pool({
    connectionString,
    // Connection pool settings for Cloud Run
    max: 10,                    // Maximum connections in pool
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Timeout after 10s if can't connect
  })

  // Type cast needed due to @types/pg version mismatch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Graceful shutdown - close database connections
 * Call this when the application is shutting down
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
}
