import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Skip DB initialization during build phase
const isBuildPhase = process.env.SKIP_DB_INIT === 'true'

// Check if we're using SQLite (local dev) or PostgreSQL (production)
const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql://')

function createPrismaClient(): PrismaClient {
  if (isBuildPhase) {
    // Return a proxy that throws helpful errors if actually used during build
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === 'then') return undefined // For promise detection
        if (prop === '$connect' || prop === '$disconnect') {
          return () => Promise.resolve()
        }
        throw new Error(
          `Prisma client method "${String(prop)}" called during build phase. ` +
          `This should not happen - ensure SKIP_DB_INIT is not set at runtime.`
        )
      },
    })
  }

  if (isPostgres) {
    // PostgreSQL for production
    const { PrismaPg } = require('@prisma/adapter-pg')
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  } else {
    // SQLite for local development
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
    const adapter = new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || 'file:./dev.db',
    })
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
