import { NextRequest } from 'next/server'
import { handlers } from '@/lib/auth'
import { checkRateLimitForRequest } from '@/lib/security'

// GET requests (session checks, CSRF, etc.) don't need rate limiting
export const { GET } = handlers

// POST requests (login attempts) need rate limiting
export async function POST(request: NextRequest) {
  // Apply rate limiting to login attempts
  const rateLimitResponse = await checkRateLimitForRequest(request, 'LOGIN')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Proceed with the NextAuth handler
  return handlers.POST(request)
}
