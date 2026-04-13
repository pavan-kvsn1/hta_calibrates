// sentry.server.config.ts
// Configures Sentry for the server (API routes, SSR)

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',

  // Capture 100% of errors
  sampleRate: 1.0,

  // Sample 10% of transactions for performance
  tracesSampleRate: 0.1,

  // ----- SERVER-SPECIFIC OPTIONS -----

  // Capture unhandled promise rejections
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error'], // Also capture console.error
    }),
  ],
})
