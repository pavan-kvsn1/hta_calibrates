import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/customer/login', '/api/auth', '/certificates/new']

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
    '/hod/:path*',
    '/customer/dashboard/:path*',
    '/certificates/:path*',
  ],
}
