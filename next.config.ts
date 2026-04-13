import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Security headers for all responses
// CSP uses unsafe-inline/unsafe-eval as required by Next.js
// Can be tightened with nonces in future if needed
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',  // Allow iframes from same origin (for PDF viewer)
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",  // Allow iframes from same origin (for PDF viewer)
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  // This creates a minimal production build that includes only necessary files
  output: 'standalone',

  // Apply security headers to all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,

  // Upload source maps for better stack traces (requires SENTRY_AUTH_TOKEN)
  // org: 'your-sentry-org',
  // project: 'hta-calibration',

  // Hide source maps from users (security)
  hideSourceMaps: true,

  // Disable Sentry in development
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',
}

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
