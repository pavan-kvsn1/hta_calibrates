import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import {
  validateRefreshToken,
  rotateRefreshToken,
  createRefreshToken,
  revokeRefreshToken,
  REFRESH_TOKEN_CONFIG,
} from '@/lib/refresh-token'

const isProduction = process.env.NODE_ENV === 'production'

// Cookie name for refresh token
const REFRESH_TOKEN_COOKIE = isProduction
  ? '__Secure-authjs.refresh-token'
  : 'authjs.refresh-token'

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token
 */
export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      )
    }

    // Validate the refresh token
    const validatedToken = await validateRefreshToken(refreshToken)

    if (!validatedToken) {
      // Clear the invalid refresh token cookie
      const response = NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
      response.cookies.delete(REFRESH_TOKEN_COOKIE)
      return response
    }

    // Get user data based on token type
    let userData: Record<string, unknown> | null = null

    if (validatedToken.userType === 'STAFF' && validatedToken.userId) {
      const user = await prisma.user.findUnique({
        where: { id: validatedToken.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isAdmin: true,
          adminType: true,
          isActive: true,
        },
      })

      if (!user || !user.isActive) {
        await revokeRefreshToken(refreshToken, 'ADMIN_REVOKE')
        const response = NextResponse.json(
          { error: 'User account is deactivated' },
          { status: 401 }
        )
        response.cookies.delete(REFRESH_TOKEN_COOKIE)
        return response
      }

      userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
        adminType: user.adminType,
      }
    } else if (validatedToken.userType === 'CUSTOMER' && validatedToken.customerId) {
      const customer = await prisma.customerUser.findUnique({
        where: { id: validatedToken.customerId },
        include: { customerAccount: true },
      })

      if (!customer || !customer.isActive) {
        await revokeRefreshToken(refreshToken, 'ADMIN_REVOKE')
        const response = NextResponse.json(
          { error: 'Customer account is deactivated' },
          { status: 401 }
        )
        response.cookies.delete(REFRESH_TOKEN_COOKIE)
        return response
      }

      userData = {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        role: 'CUSTOMER',
        companyName: customer.customerAccount?.companyName || customer.companyName,
        customerAccountId: customer.customerAccountId,
        isPrimaryPoc: customer.customerAccount?.primaryPocId === customer.id,
      }
    }

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    // Get request info for new token
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined

    // Rotate the refresh token (old one becomes invalid, new one created)
    const newRefreshToken = await rotateRefreshToken(refreshToken, {
      userId: validatedToken.userId,
      customerId: validatedToken.customerId,
      userType: validatedToken.userType,
      userAgent,
      ipAddress,
    })

    if (!newRefreshToken) {
      return NextResponse.json(
        { error: 'Failed to rotate refresh token' },
        { status: 500 }
      )
    }

    // Create new access token (JWT)
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret) {
      throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is not set')
    }

    // Salt is derived from the cookie name for NextAuth v5
    const sessionCookieName = isProduction
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token'

    const accessToken = await encode({
      token: {
        ...userData,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (REFRESH_TOKEN_CONFIG.accessTokenExpiresInMs / 1000),
      },
      secret,
      salt: sessionCookieName,
      maxAge: REFRESH_TOKEN_CONFIG.accessTokenExpiresInMs / 1000,
    })

    // Create response with new tokens
    const response = NextResponse.json({
      success: true,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_CONFIG.accessTokenExpiresInMs).toISOString(),
    })

    // Set the new session token cookie (using sessionCookieName from above)
    response.cookies.set(sessionCookieName, accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_CONFIG.accessTokenExpiresInMs / 1000,
    })

    // Set the new refresh token cookie
    response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_CONFIG.expiresInMs / 1000,
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/refresh
 * Logout - revoke the refresh token
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value

    if (refreshToken) {
      await revokeRefreshToken(refreshToken, 'LOGOUT')
    }

    const response = NextResponse.json({ success: true })

    // Clear all auth cookies
    response.cookies.delete(REFRESH_TOKEN_COOKIE)
    response.cookies.delete(
      isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token'
    )
    response.cookies.delete(
      isProduction ? '__Host-authjs.csrf-token' : 'authjs.csrf-token'
    )

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
