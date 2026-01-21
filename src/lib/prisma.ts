// Prisma client will be configured in Stage 2 when database integration is needed
// For Stage 1, the certificate form uses local state management with Zustand

// Placeholder export for future database integration
export const prisma = null

// Note: To use Prisma in production:
// 1. Install adapters: npm install @prisma/adapter-libsql @libsql/client
// 2. Run migrations: npx prisma migrate dev
// 3. Uncomment and configure the following:

/*
import { PrismaClient } from '@prisma/client'
import { PrismaSQLite } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const libsql = createClient({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
})

const adapter = new PrismaSQLite(libsql)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
*/
