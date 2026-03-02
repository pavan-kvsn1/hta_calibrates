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
    testTimeout: 30000, // 30 seconds for database operations
    // Run tests sequentially to avoid database conflicts
    sequence: {
      concurrent: false,
    },
    // Run test files sequentially
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
