import path from 'node:path'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 Configuration
 *
 * Connection URLs are now configured here instead of schema.prisma.
 * This file is used by Prisma CLI commands (migrate, db push, etc.)
 *
 * The PrismaClient runtime connection is handled separately in src/lib/prisma.ts
 */

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),

  // Migration configuration - uses DIRECT_URL if available (for Prisma Accelerate setups)
  // Otherwise falls back to DATABASE_URL
  migrate: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL ||
      'postgresql://hta_user:hta_dev_password@127.0.0.1:5432/hta_calibration',
  },
})
