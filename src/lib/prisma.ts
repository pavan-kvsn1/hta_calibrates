import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create PostgreSQL adapter for Prisma 7
// Must use Pool object, not just connectionString - PrismaPg requires Pool
// Type cast needed due to @types/pg version mismatch between pg and @prisma/adapter-pg
// Use 127.0.0.1 instead of localhost - Windows may resolve localhost to IPv6 (::1)
// which fails when Cloud SQL Proxy only listens on IPv4
const connectionString = process.env.DATABASE_URL || 'postgresql://hta_user:hta_dev_password@127.0.0.1:5432/hta_calibration'
const pool = new Pool({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
