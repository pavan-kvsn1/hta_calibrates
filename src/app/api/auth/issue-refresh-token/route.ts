import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createRefreshToken, REFRESH_TOKEN_CONFIG } from '@/lib/refresh-token'
import { authLogger as logger } from '@/lib/logger'

const isProduction = process.env.NODE_ENV === 'production'

// Cookie name for refresh token
const REFRESH_TOKEN_COOKIE = isProduction
  ? '__Secure-authjs.refresh-token'
  : 'authjs.refresh-token'

/**
 * POST /api/auth/issue-refresh-token
 * Issue a refresh token for the currently authenticated user
 * Should be called immediately after successful login
 */
export async function POST(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get request info for token
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined

    // Determine user type
    const isCustomer = session.user.role === 'CUSTOMER'

    // Create refresh token
    const refreshTokenResult = await createRefreshToken({
      userId: isCustomer ? undefined : session.user.id,
      customerId: isCustomer ? session.user.id : undefined,
      userType: isCustomer ? 'CUSTOMER' : 'STAFF',
      userAgent,
      ipAddress,
    })

    // Create response
    const response = NextResponse.json({
      success: true,
      expiresAt: refreshTokenResult.expiresAt.toISOString(),
    })

    // Set the refresh token cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshTokenResult.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_CONFIG.expiresInMs / 1000,
    })

    return response
  } catch (error) {
    logger.error({ err: error }, 'Issue refresh token error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
