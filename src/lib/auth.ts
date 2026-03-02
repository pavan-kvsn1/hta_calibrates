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

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          role: 'CUSTOMER',
          companyName,
          customerAccountId,
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
        if ('companyName' in user) {
          token.companyName = user.companyName
        }
        if ('customerAccountId' in user) {
          token.customerAccountId = user.customerAccountId
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
        if (token.companyName) {
          session.user.companyName = token.companyName as string
        }
        if (token.customerAccountId) {
          session.user.customerAccountId = token.customerAccountId as string
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
// Returns true if user is ADMIN role OR is HoD with isAdmin flag
export function canAccessAdmin(user: { role: string; isAdmin?: boolean } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'ADMIN' || (user.role === 'HOD' && user.isAdmin === true)
}

// Check if user can access HoD features
export function canAccessHod(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'HOD' || user.role === 'ADMIN'
}
