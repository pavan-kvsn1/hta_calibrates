import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/customer/login', '/customer/register', '/api/auth', '/api/customer/register']

// Token-based customer review routes (no login required, token validates access)
const tokenBasedRoutes = ['/customer/review/']

/**
 * CORS Configuration
 *
 * Currently same-origin (CORS effectively no-op).
 * When API is separated to different origin, update CORS_ALLOWED_ORIGINS env var.
 */
function getCorsAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean)
  if (envOrigins?.length) return envOrigins

  // Fallback to current origin
  return [
    process.env.FRONTEND_URL,
    process.env.NEXTAUTH_URL,
  ].filter(Boolean) as string[]
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false

  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return true
    }
  }

  const allowedOrigins = getCorsAllowedOrigins()
  return allowedOrigins.includes(origin)
}

function applyCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Service-Token, X-CSRF-Token')
    response.headers.set('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset')
    response.headers.set('Access-Control-Max-Age', '86400')
  }
  return response
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const origin = req.headers.get('origin')

  // Handle CORS preflight for API routes
  if (pathname.startsWith('/api/') && req.method === 'OPTIONS') {
    if (!isOriginAllowed(origin)) {
      return new NextResponse(null, { status: 403 })
    }
    const response = new NextResponse(null, { status: 204 })
    return applyCorsHeaders(response, origin)
  }

  // Apply CORS headers to API responses
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    return applyCorsHeaders(response, origin)
  }

  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith('/api/auth')
  )

  // Allow public routes without any auth check
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if it's a token-based route (customer review pages)
  // These are accessible without login - the token itself provides authentication
  const isTokenBasedRoute = tokenBasedRoutes.some((route) => pathname.startsWith(route))
  if (isTokenBasedRoute) {
    return NextResponse.next()
  }

  // Check for session token cookie (NextAuth sets this)
  const sessionToken = req.cookies.get('authjs.session-token') ||
                       req.cookies.get('__Secure-authjs.session-token')

  // If no session token, redirect to login
  if (!sessionToken) {
    const loginUrl = pathname.startsWith('/customer')
      ? '/customer/login'
      : '/login'
    return NextResponse.redirect(
      new URL(`${loginUrl}?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
    )
  }

  // Allow the request - role checks are done in page components
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match API routes for CORS
    '/api/:path*',
    // Match dashboard routes that need protection
    '/dashboard/:path*',
    '/review/:path*',     // Reviewer dashboard and review pages
    '/customer/:path*',
    '/admin/:path*',
  ],
}
