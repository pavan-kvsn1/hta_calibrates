/**
 * Vitest Configuration for Integration Tests
 *
 * Runs integration tests against PostgreSQL database.
 *
 * Prerequisites:
 * 1. Start PostgreSQL: docker compose -f docker-compose.test.yml up -d
 * 2. Generate Prisma client: npx prisma generate
 * 3. Push schema: npx prisma db push
 *
 * Usage: npm run test:integration
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
    },
    // Setup file for database initialization
    setupFiles: ['./tests/integration/setup/postgres-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
