// ─────────────────────────────────────────────────────────────
// NextAuth v4 configuration — real authentication for SaaS mode.
//
//   * Credentials sign-in against provisioned users (scrypt hashes).
//   * SSO via OIDC — Google / Azure AD / Okta activate automatically
//     when their env vars exist; unprovisioned emails are REJECTED
//     at sign-in (no just-in-time signup: an administrator invites).
//   * The session token carries tenantId + role so every API route
//     resolves identity (and therefore the need-to-know clearance)
//     from the signed session, not from a client-controlled cookie.
//   * Deactivated users / suspended tenants fail the per-request
//     re-check in resolveIdentity() — the kill switch works even on
//     live sessions.
// ─────────────────────────────────────────────────────────────
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { verifyPassword } from '@/lib/password'
import { db } from '@/lib/db'
import { isRoleId, type RoleId } from '@/lib/access-control'

const DEMO_FALLBACK_ROLE: RoleId = 'COMPLIANCE_OFFICER'

export function activeSsoProviders(): string[] {
  const sso: string[] = []
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) sso.push('google')
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET) sso.push('azure-ad')
  if (process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER) sso.push('okta')
  return sso
}

async function authorizeCredentials(email: string, password: string): Promise<{ id: string } | null> {
  const user = await db.user.findUnique({ where: { email }, include: { tenant: true } })
  // Uniform failure — never reveal whether the email exists.
  if (!user || !user.active || user.tenant.status !== 'ACTIVE') return null
  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) return null
  return { id: user.id }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 12 * 3600 }, // 12h — a working day, then re-auth
  providers: [
    CredentialsProvider({
      name: 'Email & password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await authorizeCredentials(credentials.email.trim().toLowerCase(), credentials.password)
        if (!user) return null
        const row = await db.user.findUnique({ where: { id: user.id } })
        return row ? { id: row.id, name: row.name, email: row.email } : null
      },
    }),
    // SSO providers activate only when configured (env vars present) —
    // the demo deployment runs credentials-only; enterprise deployments
    // set the env vars and the sign-in dialog gains those buttons.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, allowDangerousEmailAccountLinking: false })]
      : []),
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [AzureADProvider({ clientId: process.env.AZURE_AD_CLIENT_ID, clientSecret: process.env.AZURE_AD_CLIENT_SECRET, tenantId: process.env.AZURE_AD_TENANT_ID ?? 'common', allowDangerousEmailAccountLinking: false })]
      : []),
    ...(process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER
      ? [
          // Generic OIDC for Okta — same JIT policy as above.
          {
            id: 'okta',
            name: 'Okta SSO',
            type: 'oauth' as const,
            version: '2.0' as const,
            wellKnown: `${process.env.OKTA_ISSUER}/.well-known/openid-configuration`,
            clientId: process.env.OKTA_CLIENT_ID,
            clientSecret: process.env.OKTA_CLIENT_SECRET,
            authorization: { params: { scope: 'openid email profile' } },
            profile(profile: { email?: string; name?: string; sub?: string }) {
              return { id: profile.sub ?? '', name: profile.name ?? null, email: profile.email ?? null, image: null }
            },
          },
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const row = await db.user.findUnique({ where: { id: user.id }, include: { tenant: true } })
        if (!row || !row.active || row.tenant.status !== 'ACTIVE') {
          // Sign-in raced a deactivation — deny the token.
          return { ...token, denied: 'INACTIVE' }
        }
        token.userId = row.id
        token.tenantId = row.tenantId
        token.tenantName = row.tenant.name
        token.role = (isRoleId(row.role) ? row.role : DEMO_FALLBACK_ROLE) as string
        token.denied = undefined as unknown as undefined
      } else if (token.tenantId && !token.tenantName) {
        // Tokens issued before tenantName was carried — backfill once so the
        // UI can label the workspace without a re-login.
        const tenant = await db.tenant.findUnique({
          where: { id: token.tenantId as string },
          select: { name: true },
        })
        if (tenant) token.tenantName = tenant.name
      }
      return token
    },
    async session({ session, token }) {
      if (!token.denied && token.userId) {
        session.user = {
          ...session.user,
          id: token.userId as string,
          name: (token.name as string) ?? null,
          email: (token.email as string) ?? null,
          tenantId: token.tenantId as string,
          tenantName: (token.tenantName as string) ?? null,
          role: token.role as string,
        }
      }
      return session
    },
    async signIn({ user }) {
      // SSO + credentials both funnel through a PROVISIONED user row —
      // unprovisioned OAuth emails never get a session (no JIT signup).
      if (!user?.id) return false
      const row = await db.user.findUnique({ where: { id: user.id }, include: { tenant: true } })
      return Boolean(row && row.active && row.tenant.status === 'ACTIVE')
    },
  },
}
