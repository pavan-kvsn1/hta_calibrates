import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 85,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
