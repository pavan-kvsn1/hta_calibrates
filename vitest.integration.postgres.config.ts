/**
 * Vitest Configuration for PostgreSQL Integration Tests
 *
 * This configuration runs integration tests against a real PostgreSQL database
 * to verify production parity and catch PostgreSQL-specific behaviors.
 *
 * Prerequisites:
 * 1. Start PostgreSQL: docker compose -f docker-compose.test.yml up -d
 * 2. Generate Prisma client: npx prisma generate --schema=prisma/schema.postgres.prisma
 * 3. Push schema: npx prisma db push --schema=prisma/schema.postgres.prisma
 *
 * Usage: npm run test:integration:postgres
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules'],
    testTimeout: 30000,
    // Run tests sequentially to avoid database conflicts
    sequence: {
      concurrent: false,
    },
    // Run test files sequentially
    fileParallelism: false,
    // Environment variables for PostgreSQL
    env: {
      DATABASE_URL: 'postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test',
      DB_PROVIDER: 'postgresql',
    },
    // Setup file for PostgreSQL-specific initialization
    setupFiles: ['./tests/integration/setup/postgres-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Use PostgreSQL Prisma client
      '@prisma/client': path.resolve(__dirname, './node_modules/.prisma/client-postgres'),
    },
  },
})
