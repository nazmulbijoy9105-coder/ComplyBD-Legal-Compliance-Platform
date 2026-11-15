import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// NextAuth v4 route handler — /api/auth/* (signin, session, signout,
// OAuth callbacks). Login happens from the in-app dialog; no custom
// pages are added (the user-visible surface stays the / route).
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
