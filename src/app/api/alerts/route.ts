import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/alerts ──────────────────────────────────────────
// Engine-health alerts for the calling tenant: OPEN first, then the
// recently resolved — produced by the sweep on every compliance run
// (ENGINE_GAP, RULE_UNVERIFIED_STALE, CHANGE_PENDING).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const rows = await user.engineAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })

  const alerts = rows.map((a) => ({
    id: a.id,
    type: a.type,
    refCode: a.refCode,
    severity: a.severity,
    message: a.message,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    lastSeenAt: a.lastSeenAt.toISOString(),
    resolvedAt: a.resolvedAt?.toISOString() ?? null,
    notifiedAt: a.notifiedAt?.toISOString() ?? null,
  }))

  return NextResponse.json({
    alerts,
    open: alerts.filter((a) => a.status === 'OPEN').length,
    resolved: alerts.filter((a) => a.status === 'RESOLVED').length,
  })
}

// ── POST /api/alerts ─────────────────────────────────────────
// Manual acknowledgement: mark an alert RESOLVED with a note (audited).
const resolveSchema = z.object({
  id: z.string().trim().min(1),
  note: z.string().trim().min(3, 'a resolution note is required'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }

  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const updated = await user.engineAlert.update({
    where: { id: parsed.data.id },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  })

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: identity.role,
    action: 'RESOLVE_ALERT',
    resource: `/api/alerts ${parsed.data.id.slice(-6)}`,
    detail: `${updated.type} ${updated.refCode ?? ''} resolved — ${parsed.data.note.slice(0, 80)}`,
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: 'Alert resolution is an auditable operator decision.',
  })

  return NextResponse.json({ alert: { id: updated.id, status: updated.status } })
}
