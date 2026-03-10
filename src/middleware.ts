import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/customer/login', '/customer/register', '/api/auth', '/api/customer/register']

// Token-based customer review routes (no login required, token validates access)
const tokenBasedRoutes = ['/customer/review/']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

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
    // Match dashboard routes that need protection
    '/dashboard/:path*',
    '/review/:path*',     // Reviewer dashboard and review pages
    '/customer/:path*',
    '/admin/:path*',
  ],
}
