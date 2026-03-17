import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')

// Create appropriate adapter for Prisma 7 based on database type
function createAdapter() {
  if (isPostgres) {
    // PostgreSQL for CI, staging, and production
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool: any = globalForPrisma.pgPool ?? new Pool({ connectionString: databaseUrl })
    if (!globalForPrisma.pgPool) globalForPrisma.pgPool = pool
    return new PrismaPg(pool)
  } else {
    // SQLite for local development
    return new PrismaBetterSqlite3({ url: databaseUrl })
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
