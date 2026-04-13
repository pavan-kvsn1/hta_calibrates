// instrumentation.ts
// This file is used by Next.js to initialize monitoring (Sentry)
// It runs once when the server starts

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry initialization
    await import('../sentry.edge.config')
  }
}
