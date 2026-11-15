import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { tenantDb } from '@/lib/tenant-db'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { ROLES, logAccess, canAccess } from '@/lib/access-control'
import type { AccessLogData } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/access-log ──────────────────────────────────────
// Confidentiality surface: recent access entries (allowed AND denied),
// the need-to-know role matrix and counters — TENANT-SCOPED. Listed-
// company data can include unpublished price-sensitive information;
// tenant isolation is a legal exposure, staff access is an insider-
// trading risk, so every sensitive read leaves a trace here.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })

  const user = tenantDb(identity.tenantId)
  const [entries, all] = await Promise.all([
    user.accessLog.findMany({ orderBy: { at: 'desc' }, take: 40 }),
    user.accessLog.findMany({ select: { outcome: true } }),
  ])

  const data: AccessLogData = {
    currentRole: identity.role,
    roles: Object.values(ROLES).map((r) => ({
      id: r.id,
      label: r.label,
      clearance: r.clearance,
      canClear: r.canClear,
      rationale: r.rationale,
      actor: identity.authenticated && identity.role === r.id ? identity.actor : r.actor,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      actor: e.actor,
      role: e.role,
      action: e.action,
      resource: e.resource,
      detail: e.detail,
      classification: e.classification,
      outcome: e.outcome,
      reason: e.reason,
    })),
    counters: {
      allowed: all.filter((e) => e.outcome === 'ALLOWED').length,
      denied: all.filter((e) => e.outcome === 'DENIED').length,
      total: all.length,
    },
  }
  return NextResponse.json(data)
}

// ── POST /api/access-log ─────────────────────────────────────
// Log a role switch (demo persona) — the switch itself is an access event.
// With a real session the role comes from the signed token and the demo
// switcher is not offered; this endpoint stays for the demo fallback.
const switchSchema = z.object({
  action: z.literal('ROLE_SWITCH'),
  to: z.enum(['COMPANY_SECRETARY', 'COMPLIANCE_OFFICER', 'EXTERNAL_AUDITOR', 'EXECUTIVE']),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = switchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  if (identity.authenticated) {
    // Signed-in users cannot switch roles — the role is provisioned, not picked.
    return NextResponse.json(
      { error: 'Signed-in users hold a provisioned role; the demo role switcher is only available without a session' },
      { status: 403 },
    )
  }
  const current = identity.roleDef
  const target = ROLES[parsed.data.to]

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: current.id,
    action: 'ROLE_SWITCH',
    resource: 'session persona (demo)',
    detail: `${current.label} → ${target.label} (clearance ${target.clearance})`,
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: target.rationale,
  })

  // Self-check: the target role must pass its own matrix.
  const matrixOk = target.canClear.every((c) => canAccess(target, c))

  return NextResponse.json({ logged: true, role: target.id, matrixOk })
}
