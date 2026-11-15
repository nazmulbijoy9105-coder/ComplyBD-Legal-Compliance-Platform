// ─────────────────────────────────────────────────────────────
// Identity resolution — session-first, demo fallback.
//
//   1. A signed NextAuth session (JWT cookie) is authoritative:
//      tenantId + role come from the token AND are re-checked
//      against the live User/Tenant rows on every request, so a
//      deactivated user or a suspended tenant is cut off even
//      with a still-valid session (the kill switch).
//   2. Without a session the request runs as the DEMO persona
//      (role cookie switcher) inside the demo tenant — this keeps
//      the sandbox preview fully usable while being clearly
//      labelled as demo identity in the audit trail.
//
// Every API route resolves identity through here; nothing else
// reads the role cookie.
// ─────────────────────────────────────────────────────────────
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ROLES, isRoleId, resolveRole, type RoleDef, type RoleId } from '@/lib/access-control'

export interface Identity {
  authenticated: boolean // signed NextAuth session
  demo: boolean // demo persona fallback (sandbox preview)
  /** Non-null when the session exists but access is cut off — routes must 403. */
  denied: string | null
  actor: string // audit-trail display name
  email: string | null
  userId: string | null
  role: RoleId
  roleDef: RoleDef
  tenantId: string
  tenantName: string
}

const DEMO_TENANT_SLUG = 'padma-textiles'
let demoTenantCache: { id: string; name: string; expires: number } | null = null

async function demoTenant(): Promise<{ id: string; name: string }> {
  if (demoTenantCache && demoTenantCache.expires > Date.now()) {
    return { id: demoTenantCache.id, name: demoTenantCache.name }
  }
  const tenant = await db.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } })
  if (!tenant) {
    // Fail loudly — running without the demo tenant means the identity
    // layer cannot stamp rows; silence here would corrupt isolation.
    throw new Error(`[identity] demo tenant "${DEMO_TENANT_SLUG}" missing — run the seed`)
  }
  demoTenantCache = { id: tenant.id, name: tenant.name, expires: Date.now() + 60_000 }
  return { id: tenant.id, name: tenant.name }
}

export async function resolveIdentity(request: NextRequest): Promise<Identity> {
  let token: Record<string, unknown> | null = null
  try {
    token = (await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })) as unknown as Record<string, unknown>
  } catch {
    token = null
  }

  if (token && typeof token.userId === 'string' && token.userId) {
    if (token.denied) {
      return {
        authenticated: true,
        demo: false,
        denied: String(token.denied),
        actor: 'rejected-session',
        email: (token.email as string) ?? null,
        userId: null,
        role: 'COMPLIANCE_OFFICER',
        roleDef: ROLES.COMPLIANCE_OFFICER,
        tenantId: '',
        tenantName: '',
      }
    }
    const user = await db.user.findUnique({ where: { id: token.userId }, include: { tenant: true } })
    if (!user || !user.active) {
      return {
        authenticated: true, demo: false, denied: 'USER_INACTIVE',
        actor: 'rejected-session', email: null, userId: token.userId,
        role: 'COMPLIANCE_OFFICER', roleDef: ROLES.COMPLIANCE_OFFICER, tenantId: '', tenantName: '',
      }
    }
    if (user.tenant.status !== 'ACTIVE') {
      return {
        authenticated: true, demo: false, denied: 'TENANT_SUSPENDED',
        actor: user.name, email: user.email, userId: user.id,
        role: 'COMPLIANCE_OFFICER', roleDef: ROLES.COMPLIANCE_OFFICER, tenantId: '', tenantName: user.tenant.name,
      }
    }
    const role: RoleId = isRoleId(user.role) ? user.role : 'COMPLIANCE_OFFICER'
    return {
      authenticated: true,
      demo: false,
      denied: null,
      actor: user.name,
      email: user.email,
      userId: user.id,
      role,
      roleDef: ROLES[role],
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
    }
  }

  // Demo persona fallback — sandbox preview without a session.
  const roleDef = resolveRole(request)
  const tenant = await demoTenant()
  return {
    authenticated: false,
    demo: true,
    denied: null,
    actor: roleDef.actor,
    email: null,
    userId: null,
    role: roleDef.id,
    roleDef,
    tenantId: tenant.id,
    tenantName: tenant.name,
  }
}

/** 403 for a denied identity, or null when access may proceed. */
export function deniedResponse(identity: Identity): { error: string; code: string } | null {
  if (!identity.denied) return null
  return { error: `Access denied: ${identity.denied}`, code: identity.denied }
}
