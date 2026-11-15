import type { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      tenantId: string
      role: string
    } & DefaultSession['user']
  }
  interface User extends DefaultUser {
    userId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    tenantId?: string
    role?: string
    denied?: string
  }
}
