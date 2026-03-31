# 04 - Authentication & Authorization

## Overview

| Component | Technology |
|-----------|------------|
| Auth Library | NextAuth v5 (Auth.js) beta |
| Session Strategy | JWT (stateless) |
| Password Hashing | bcryptjs (cost factor 12) |
| User Types | Staff (User) + Customers (CustomerUser) |

---

## NextAuth Configuration

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,  // Required behind load balancer
  useSecureCookies: false,  // HTTP in development

  cookies: {
    csrfToken: {
      name: 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    callbackUrl: {
      name: 'authjs.callback-url',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    },
    sessionToken: {
      name: 'authjs.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    },
  },

  providers: [
    Credentials({
      id: 'staff-credentials',
      name: 'Staff Login',
      // ... see below
    }),
    Credentials({
      id: 'customer-credentials',
      name: 'Customer Login',
      // ... see below
    }),
  ],

  callbacks: {
    jwt({ token, user }) { /* ... */ },
    session({ session, token }) { /* ... */ },
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
```

---

## Credential Providers

### Staff Login

```typescript
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
      adminType: user.adminType,
    }
  },
})
```

### Customer Login

```typescript
Credentials({
  id: 'customer-credentials',
  name: 'Customer Login',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    const customer = await prisma.customerUser.findUnique({
      where: { email: credentials.email as string },
      include: { customerAccount: true },
    })

    if (!customer || !customer.isActive || !customer.passwordHash) {
      return null
    }

    const isPasswordValid = await bcrypt.compare(
      credentials.password as string,
      customer.passwordHash
    )

    if (!isPasswordValid) {
      return null
    }

    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      role: 'CUSTOMER',
      companyName: customer.customerAccount?.companyName,
      customerAccountId: customer.customerAccountId,
      isPrimaryPoc: customer.customerAccount?.primaryPocId === customer.id,
    }
  },
})
```

---

## JWT Callbacks

The JWT callback enriches the token with user data:

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id
      token.role = user.role
      if ('isAdmin' in user) token.isAdmin = user.isAdmin
      if ('adminType' in user) token.adminType = user.adminType
      if ('companyName' in user) token.companyName = user.companyName
      if ('customerAccountId' in user) token.customerAccountId = user.customerAccountId
      if ('isPrimaryPoc' in user) token.isPrimaryPoc = user.isPrimaryPoc
    }
    return token
  },

  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.isAdmin = token.isAdmin as boolean
      session.user.adminType = token.adminType as 'MASTER' | 'WORKER' | null
      session.user.companyName = token.companyName as string
      session.user.customerAccountId = token.customerAccountId as string
      session.user.isPrimaryPoc = token.isPrimaryPoc as boolean
    }
    return session
  },
}
```

---

## Role Hierarchy

```
ADMIN (MASTER)
├── Full system control
├── Manage all users
├── View all certificates
└── Approve/reject registrations

ADMIN (WORKER)  [Future use]
├── Review certificates
├── Manage assigned engineers
└── Limited admin features

ENGINEER
├── Create certificates
├── Edit own certificates
├── Submit for review
└── View assigned instruments

CUSTOMER
├── View company certificates
├── Approve/reject certificates
├── Download signed PDFs
└── (POC) Request new users
```

---

## Authorization Helpers

```typescript
// src/lib/auth.ts

// Check if user is Master Admin
export function isMasterAdmin(user: { role: string; adminType?: string | null }) {
  return user?.role === 'ADMIN' && user?.adminType === 'MASTER'
}

// Check if user is any Admin
export function isAdmin(user: { role: string }) {
  return user?.role === 'ADMIN'
}

// Check if user can review a certificate
export function canReviewCertificate(
  user: { id: string; role: string },
  certificate: { reviewerId?: string }
) {
  if (user.role === 'ADMIN') return true
  return certificate.reviewerId === user.id
}

// Check if user can access a chat thread
export function canAccessChatThread(
  user: { id: string; role: string },
  certificate: { createdById: string; reviewerId?: string },
  threadType: 'ASSIGNEE_REVIEWER' | 'REVIEWER_CUSTOMER'
) {
  if (user.role === 'ADMIN') return true
  if (threadType === 'ASSIGNEE_REVIEWER') {
    return user.id === certificate.createdById || user.id === certificate.reviewerId
  }
  if (threadType === 'REVIEWER_CUSTOMER') {
    return user.id === certificate.reviewerId || user.role === 'CUSTOMER'
  }
  return false
}
```

---

## Using Auth in Components

### Server Components

```typescript
// app/(dashboard)/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  if (session.user.role === 'CUSTOMER') {
    redirect('/customer/dashboard')
  }

  return <Dashboard user={session.user} />
}
```

### Client Components

```typescript
'use client'
import { useSession } from 'next-auth/react'

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') return <Skeleton />
  if (!session) return <LoginButton />

  return (
    <div>
      <span>{session.user.name}</span>
      <span className="text-sm text-gray-500">{session.user.role}</span>
    </div>
  )
}
```

### API Routes

```typescript
// app/api/certificates/route.ts
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ... proceed
}
```

---

## Login Flow

### Client-Side Login

```typescript
'use client'
import { signIn, getCsrfToken } from 'next-auth/react'

export function LoginForm() {
  const [csrfToken, setCsrfToken] = useState<string>()

  useEffect(() => {
    getCsrfToken().then(setCsrfToken)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = await signIn('staff-credentials', {
      email,
      password,
      redirect: false,
      csrfToken,
    })

    if (result?.error) {
      setError('Invalid credentials')
    } else {
      router.push('/dashboard')
    }
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

---

## Common Failure Modes

### 1. MissingCSRF Error

**Symptom**: Login fails with "MissingCSRF" error

**Causes**:
- CSRF token not fetched before sign in
- Cookie name mismatch (`next-auth.*` vs `authjs.*`)
- NEXTAUTH_URL mismatch

**Fix**:
```typescript
// Fetch CSRF token
const csrfToken = await getCsrfToken()
signIn('credentials', { ...data, csrfToken })

// Ensure cookie names match in auth config
cookies: {
  csrfToken: { name: 'authjs.csrf-token', ... },
}
```

### 2. UntrustedHost Error

**Symptom**: "UntrustedHost" error in production

**Cause**: Next.js running behind proxy/load balancer

**Fix**:
```typescript
// auth.ts
export const { ... } = NextAuth({
  trustHost: true,
})

// Or via environment variable
AUTH_TRUST_HOST=true
```

### 3. Session is Null

**Symptom**: `auth()` returns null even after login

**Causes**:
- Cookie not set (check browser dev tools)
- Domain mismatch
- NEXTAUTH_URL incorrect

**Debug**:
```typescript
const session = await auth()
console.log('Session:', session)
console.log('Cookies:', cookies().getAll())
```

### 4. Redirect Loop

**Symptom**: Infinite redirect between login and dashboard

**Cause**: Middleware misconfiguration

**Fix**: Check middleware matcher excludes auth pages:
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|login|api/auth).*)'],
}
```

---

## Security Best Practices

1. **Password Requirements**: Enforce minimum length, complexity
2. **Rate Limiting**: Implement on login endpoint
3. **Account Lockout**: Lock after N failed attempts
4. **Session Rotation**: Rotate session ID after login
5. **Secure Cookies**: Use `secure: true` in production (HTTPS)
6. **CSRF Protection**: Always use NextAuth built-in protection

---

## Type Extensions

```typescript
// src/types/next-auth.d.ts
import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    role: string
    isAdmin?: boolean
    adminType?: 'MASTER' | 'WORKER' | null
    companyName?: string
    customerAccountId?: string
    isPrimaryPoc?: boolean
  }

  interface Session {
    user: User
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
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

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth configuration |
| `src/types/next-auth.d.ts` | Type extensions |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth API routes |
| `src/app/(auth)/login/page.tsx` | Staff login page |
| `src/app/(auth)/customer/login/page.tsx` | Customer login page |
| `src/middleware.ts` | Route protection |

---

## Next Steps

- [05 - Event Architecture](../05-event-architecture/) - Certificate workflow
- [02 - Backend](../02-backend/) - API authorization
