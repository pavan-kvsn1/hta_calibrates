// sentry.client.config.ts
// Configures Sentry for the browser (client-side errors)

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  // Your Sentry DSN - identifies your project
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment helps filter errors (production vs staging vs development)
  environment: process.env.NODE_ENV,

  // Only enable in production to avoid noise during development
  enabled: process.env.NODE_ENV === 'production',

  // ----- ERROR TRACKING -----

  // Sample rate for error events (1.0 = 100% of errors captured)
  sampleRate: 1.0,

  // ----- PERFORMANCE MONITORING (TRACING) -----

  // Sample rate for performance transactions (0.1 = 10% sampled)
  tracesSampleRate: 0.1,

  // Which URLs should include trace headers (for distributed tracing)
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/.*\.run\.app/, // Cloud Run URLs
    /^https:\/\/.*hta-calibration\.com/, // Custom domain
  ],

  // ----- FILTERING -----

  // Don't send these errors (they're usually noise)
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    // Network errors that aren't our fault
    'Network request failed',
    'Load failed',
    // User cancelled
    'AbortError',
  ],

  // ----- CONTEXT -----

  // Add extra context to every event
  initialScope: {
    tags: {
      app: 'hta-calibration',
    },
  },
})
