import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      isAdmin?: boolean
      companyName?: string
      customerAccountId?: string
    }
  }

  interface User extends DefaultUser {
    id: string
    role: string
    isAdmin?: boolean
    companyName?: string
    customerAccountId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string
    role?: string
    isAdmin?: boolean
    companyName?: string
    customerAccountId?: string
  }
}
