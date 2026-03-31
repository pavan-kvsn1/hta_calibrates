# NextAuth v5 Configuration

## Overview

HTA Calibration uses **NextAuth v5** (Auth.js) with JWT sessions and multiple credential providers.

---

## Configuration File

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,  // 24 hours
  },

  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: 'authjs.csrf-token',
    },
    callbackUrl: {
      name: 'authjs.callback-url',
    },
  },

  trustHost: true,  // Required behind load balancer

  providers: [
    // Staff credentials
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

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!passwordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isAdmin: user.isAdmin,
          adminType: user.adminType,
        }
      },
    }),

    // Customer credentials
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

        const customerUser = await prisma.customerUser.findUnique({
          where: { email: credentials.email as string },
          include: { customerAccount: true },
        })

        if (!customerUser || !customerUser.isActive || !customerUser.passwordHash) {
          return null
        }

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          customerUser.passwordHash
        )

        if (!passwordValid) {
          return null
        }

        return {
          id: customerUser.id,
          email: customerUser.email,
          name: customerUser.name,
          role: 'CUSTOMER',
          companyName: customerUser.customerAccount.companyName,
          customerAccountId: customerUser.customerAccountId,
          isPrimaryPoc: customerUser.isPrimaryPoc,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.isAdmin = user.isAdmin
        token.adminType = user.adminType
        token.companyName = user.companyName
        token.customerAccountId = user.customerAccountId
        token.isPrimaryPoc = user.isPrimaryPoc
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.isAdmin = token.isAdmin as boolean | undefined
        session.user.adminType = token.adminType as string | undefined
        session.user.companyName = token.companyName as string | undefined
        session.user.customerAccountId = token.customerAccountId as string | undefined
        session.user.isPrimaryPoc = token.isPrimaryPoc as boolean | undefined
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
})
```

---

## Session Type Extension

```typescript
// src/types/next-auth.d.ts
import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT as DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      isAdmin?: boolean
      adminType?: 'MASTER' | 'WORKER' | null
      companyName?: string
      customerAccountId?: string
      isPrimaryPoc?: boolean
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: string
    isAdmin?: boolean
    adminType?: 'MASTER' | 'WORKER' | null
    companyName?: string
    customerAccountId?: string
    isPrimaryPoc?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    isAdmin?: boolean
    adminType?: 'MASTER' | 'WORKER' | null
    companyName?: string
    customerAccountId?: string
    isPrimaryPoc?: boolean
  }
}
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User submits credentials                                        │
│        │                                                         │
│        ▼                                                         │
│  ┌─────────────────────────────────────────┐                    │
│  │  signIn('staff-credentials', {...})     │                    │
│  │  or                                      │                    │
│  │  signIn('customer-credentials', {...})  │                    │
│  └───────────────────┬─────────────────────┘                    │
│                      │                                           │
│                      ▼                                           │
│  ┌─────────────────────────────────────────┐                    │
│  │  Credentials Provider authorize()       │                    │
│  │  ├── Find user in database              │                    │
│  │  ├── Verify password with bcrypt        │                    │
│  │  └── Return user object or null         │                    │
│  └───────────────────┬─────────────────────┘                    │
│                      │                                           │
│          ┌───────────┴───────────┐                              │
│          │                       │                              │
│          ▼                       ▼                              │
│       SUCCESS                  FAILURE                          │
│          │                       │                              │
│          ▼                       ▼                              │
│  ┌───────────────┐      ┌───────────────┐                      │
│  │ jwt() callback│      │ Return error  │                      │
│  │ Add user to   │      │ Stay on login │                      │
│  │ JWT token     │      │ page          │                      │
│  └───────┬───────┘      └───────────────┘                      │
│          │                                                       │
│          ▼                                                       │
│  ┌───────────────────────────────┐                              │
│  │ Set session cookie            │                              │
│  │ authjs.session-token (dev)   │                              │
│  │ __Secure-authjs... (prod)    │                              │
│  └───────────────┬───────────────┘                              │
│                  │                                               │
│                  ▼                                               │
│  ┌───────────────────────────────┐                              │
│  │ Redirect to callback URL      │                              │
│  │ /dashboard or /customer/...   │                              │
│  └───────────────────────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Using auth() in Server Components

```typescript
// In Server Component or API route
import { auth } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Role: {session.user.role}</p>
    </div>
  )
}
```

---

## Using Session in Client Components

```typescript
'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <Loading />
  }

  if (!session) {
    return (
      <button onClick={() => signIn()}>
        Sign In
      </button>
    )
  }

  return (
    <div>
      <span>{session.user.name}</span>
      <button onClick={() => signOut({ callbackUrl: '/login' })}>
        Sign Out
      </button>
    </div>
  )
}
```

---

## Session Provider Setup

```typescript
// src/components/providers/session-provider.tsx
'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider
      refetchInterval={5 * 60}     // Refetch every 5 minutes
      refetchOnWindowFocus={true}   // Refetch when window gains focus
    >
      {children}
    </NextAuthSessionProvider>
  )
}

// src/app/layout.tsx
import { SessionProvider } from '@/components/providers/session-provider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

---

## Password Hashing

```typescript
// src/lib/auth.ts (or separate file)
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)  // 12 rounds
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// Usage in user creation
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    passwordHash: await hashPassword('password123'),
    // ...
  },
})
```

---

## Login Page Implementation

```typescript
// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn, getCsrfToken } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Get CSRF token (required for credentials auth)
      const csrfToken = await getCsrfToken()

      const result = await signIn('staff-credentials', {
        email,
        password,
        csrfToken,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">Staff Login</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-primary text-white rounded disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
```

---

## Common Issues

### CSRF Token Missing

**Symptom:** Login fails silently

**Fix:** Always fetch CSRF token before signIn:
```typescript
const csrfToken = await getCsrfToken()
await signIn('credentials', { ...data, csrfToken })
```

### Session Cookie Not Set

**Symptom:** User logged in but session is null on next request

**Possible causes:**
1. Cookie blocked by browser
2. SameSite attribute issue
3. Secure flag on HTTP

**Debug:**
```typescript
console.log('Cookies:', document.cookie)
```

### JWT Token Expired

**Symptom:** User suddenly logged out

**Fix:** SessionProvider with refetch:
```typescript
<SessionProvider refetchInterval={5 * 60}>
```
