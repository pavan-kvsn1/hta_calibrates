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

  // CDN asset prefix (set CDN_URL env var in production)
  // When set, static assets will be served from the CDN
  assetPrefix: process.env.CDN_URL || undefined,

  // Apply security headers and cache headers to all routes
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Cache Next.js static assets (immutable - hash in filename)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache static files in public directory
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Cache fonts
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache favicon and manifest
        source: '/(favicon.ico|site.webmanifest|robots.txt)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },

  // Image optimization configuration
  images: {
    // Enable remote patterns for CDN-served images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.storage.googleapis.com',
        pathname: '/**',
      },
    ],
    // Optimize image formats
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Image sizes for next/image component
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
