import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: 'staff-credentials',
      name: 'Staff Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.isActive || !user.passwordHash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isAdmin: user.isAdmin,
          adminType: user.adminType as 'MASTER' | 'WORKER' | null,
        }
      },
    }),
    Credentials({
      id: 'customer-credentials',
      name: 'Customer Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const customer = await prisma.customerUser.findUnique({
          where: { email: credentials.email as string },
          include: {
            customerAccount: true,
          },
        })

        if (!customer || !customer.isActive) {
          return null
        }

        // If no password hash, account not yet activated
        if (!customer.passwordHash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          customer.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        // Get company name and account ID from customerAccount if available
        const companyName = customer.customerAccount?.companyName || customer.companyName || undefined
        const customerAccountId = customer.customerAccountId || undefined
        // Check if user is the primary POC
        const isPrimaryPoc = customer.customerAccount?.primaryPocId === customer.id

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          role: 'CUSTOMER',
          companyName,
          customerAccountId,
          isPrimaryPoc,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        if ('isAdmin' in user) {
          token.isAdmin = user.isAdmin
        }
        if ('adminType' in user) {
          token.adminType = user.adminType
        }
        if ('companyName' in user) {
          token.companyName = user.companyName
        }
        if ('customerAccountId' in user) {
          token.customerAccountId = user.customerAccountId
        }
        if ('isPrimaryPoc' in user) {
          token.isPrimaryPoc = user.isPrimaryPoc
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        if (token.isAdmin !== undefined) {
          session.user.isAdmin = token.isAdmin as boolean
        }
        if (token.adminType !== undefined) {
          session.user.adminType = token.adminType as 'MASTER' | 'WORKER' | null
        }
        if (token.companyName) {
          session.user.companyName = token.companyName as string
        }
        if (token.customerAccountId) {
          session.user.customerAccountId = token.customerAccountId as string
        }
        if (token.isPrimaryPoc !== undefined) {
          session.user.isPrimaryPoc = token.isPrimaryPoc as boolean
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
})

// Type extensions are in src/types/next-auth.d.ts

// Helper functions
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// Get current user from session
export async function getCurrentUser() {
  const session = await auth()
  return session?.user || null
}

// Check if user has required role
export function hasRole(user: { role: string } | null, allowedRoles: string[]): boolean {
  if (!user) return false
  return allowedRoles.includes(user.role)
}

// Check if user can access admin features
export function canAccessAdmin(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'ADMIN'
}

// ====================
// NEW: Admin Tier Helpers
// ====================

// Check if user is a Master Admin
export function isMasterAdmin(user: { role: string; adminType?: string | null } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'ADMIN' && user.adminType === 'MASTER'
}

// Check if user is a Worker Admin
export function isWorkerAdmin(user: { role: string; adminType?: string | null } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'ADMIN' && user.adminType === 'WORKER'
}

// Check if user is any type of Admin
export function isAdmin(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'ADMIN'
}

// ====================
// NEW: Reviewer Permission Helpers
// ====================

// Check if user can review a specific certificate
export function canReviewCertificate(
  user: { id: string; role: string } | null | undefined,
  certificate: { reviewerId?: string | null }
): boolean {
  if (!user) return false
  // Admins can review any certificate
  if (user.role === 'ADMIN') return true
  // Engineers can review certificates assigned to them
  return certificate.reviewerId === user.id
}

// Check if user is the assignee (creator) of a certificate
export function isAssignee(
  user: { id: string } | null | undefined,
  certificate: { createdById: string }
): boolean {
  if (!user) return false
  return user.id === certificate.createdById
}

// Check if user is the reviewer of a certificate
export function isReviewer(
  user: { id: string } | null | undefined,
  certificate: { reviewerId?: string | null }
): boolean {
  if (!user) return false
  return certificate.reviewerId === user.id
}

// Check if user can access a chat thread
export function canAccessChatThread(
  user: { id: string; role: string } | null | undefined,
  certificate: { createdById: string; reviewerId?: string | null },
  threadType: 'ASSIGNEE_REVIEWER' | 'REVIEWER_CUSTOMER'
): boolean {
  if (!user) return false

  // Admins can access all threads
  if (user.role === 'ADMIN') return true

  if (threadType === 'ASSIGNEE_REVIEWER') {
    // Assignee or Reviewer can access
    return user.id === certificate.createdById || user.id === certificate.reviewerId
  }

  if (threadType === 'REVIEWER_CUSTOMER') {
    // Only Reviewer can access (customer access handled separately)
    return user.id === certificate.reviewerId
  }

  return false
}
