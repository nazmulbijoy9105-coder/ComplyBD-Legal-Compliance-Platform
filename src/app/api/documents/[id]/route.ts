import { NextResponse, type NextRequest } from 'next/server'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess, canAccess } from '@/lib/access-control'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/documents/[id] ──────────────────────────────────
// Open a single evidence item. Above the acting role's need-to-know
// clearance this is a hard DENIED (403, metadata withheld) and the
// attempt is logged — an unlogged read of unpublished price-sensitive
// material is precisely the insider-trading exposure this endpoint
// exists to prevent.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef

  const existing = await user.document.findUnique({
    where: { id },
    include: { obligation: { select: { title: true } } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (!canAccess(role, existing.classification)) {
    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'OPEN_DOCUMENT',
      resource: `/api/documents/${id}`,
      detail: `attempted "${existing.name}" at ${existing.classification}`,
      classification: existing.classification,
      outcome: 'DENIED',
      reason: `${role.label} clearance is ${role.clearance} — ${existing.classification} evidence is above need-to-know.`,
    })
    // Deny WITHOUT revealing the document metadata beyond its class.
    return NextResponse.json(
      { error: `Need-to-know: ${role.label} (clearance ${role.clearance}) cannot open ${existing.classification} evidence`, masked: true },
      { status: 403 },
    )
  }

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'OPEN_DOCUMENT',
    resource: `/api/documents/${id}`,
    detail: `"${existing.name}" at ${existing.classification}`,
    classification: existing.classification,
    outcome: 'ALLOWED',
    reason: role.rationale,
  })

  return NextResponse.json({
    document: {
      id: existing.id,
      name: existing.name,
      classification: existing.classification,
      version: existing.version,
      fileType: existing.fileType,
      sizeKb: existing.sizeKb,
      uploadedBy: existing.uploadedBy,
      createdAt: existing.createdAt.toISOString(),
      obligationId: existing.obligationId,
      obligationTitle: existing.obligation?.title ?? null,
    },
  })
}

// ── DELETE /api/documents/[id] ───────────────────────────────
// Need-to-know applies to deletion too: no role may destroy evidence it
// cannot even read, and every attempt is logged.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef

  const existing = await user.document.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (!canAccess(role, existing.classification)) {
    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'DELETE_DOCUMENT',
      resource: `/api/documents/${id}`,
      detail: `"${existing.name}" at ${existing.classification}`,
      classification: existing.classification,
      outcome: 'DENIED',
      reason: `${role.label} clearance is ${role.clearance} — cannot access, therefore cannot delete.`,
    })
    return NextResponse.json({ error: `Need-to-know: ${role.label} cannot delete ${existing.classification} evidence` }, { status: 403 })
  }

  await user.document.delete({ where: { id } })

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'DELETE_DOCUMENT',
    resource: `/api/documents/${id}`,
    detail: `"${existing.name}" at ${existing.classification}`,
    classification: existing.classification,
    outcome: 'ALLOWED',
    reason: role.rationale,
  })

  return NextResponse.json({ ok: true })
}
