import { NextResponse, type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { DEFAULT_ACTOR } from '@/lib/status'
import { logAccess, canAccess, highestClassification } from '@/lib/access-control'
import type { DocumentItem } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type DocumentRow = Prisma.DocumentGetPayload<{
  include: { obligation: { select: { title: true } } }
}>

function serializeDocument(row: DocumentRow): DocumentItem {
  return {
    id: row.id,
    name: row.name,
    masked: false,
    classification: row.classification,
    version: row.version,
    fileType: row.fileType,
    sizeKb: row.sizeKb,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    obligationId: row.obligationId,
    obligationTitle: row.obligation?.title ?? null,
  }
}

/** Above a role's need-to-know clearance, the document is masked — metadata only. */
function maskDocument(row: DocumentRow): DocumentItem {
  return {
    id: row.id,
    name: null,
    masked: true,
    classification: row.classification,
    version: row.version,
    fileType: row.fileType,
    sizeKb: 0,
    uploadedBy: null,
    createdAt: row.createdAt.toISOString(),
    obligationId: null,
    obligationTitle: null,
  }
}

// ── GET /api/documents ───────────────────────────────────────
// Need-to-know enforcement: documents above the acting role's clearance
// are MASKED (metadata only) and the read is logged — listing unpublished
// price-sensitive material is exactly the insider-trading exposure the
// access log exists to evidence.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef
  const rows = await user.document.findMany({
    orderBy: { createdAt: 'desc' },
    include: { obligation: { select: { title: true } } },
  })

  const documents = rows.map((row) => (canAccess(role, row.classification) ? serializeDocument(row) : maskDocument(row)))
  const masked = documents.filter((d) => d.masked).length

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'LIST_DOCUMENTS',
    resource: '/api/documents',
    detail: `${documents.length - masked} visible · ${masked} masked above ${role.clearance} clearance`,
    classification: highestClassification(rows.map((r) => r.classification)),
    outcome: 'ALLOWED',
    reason: role.rationale,
  })

  return NextResponse.json({ documents, role: role.id, clearance: role.clearance })
}

// ── POST /api/documents ──────────────────────────────────────
const createSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).default('INTERNAL'),
  fileType: z.string().trim().min(1).default('PDF'),
  obligationId: z.string().min(1).optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const data = parsed.data
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef

  // Need-to-know: a role may not file evidence above its own clearance.
  if (!canAccess(role, data.classification)) {
    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'UPLOAD_DOCUMENT',
      resource: '/api/documents',
      detail: `attempted "${data.name}" at ${data.classification}`,
      classification: data.classification,
      outcome: 'DENIED',
      reason: `${role.label} clearance is ${role.clearance} — filing at ${data.classification} requires higher need-to-know.`,
    })
    return NextResponse.json(
      { error: `Need-to-know: ${role.label} (clearance ${role.clearance}) cannot file ${data.classification} evidence` },
      { status: 403 },
    )
  }

  // If an obligation is referenced it must exist — evidence needs a home.
  if (data.obligationId) {
    const obligation = await user.obligation.findUnique({
      where: { id: data.obligationId },
    })
    if (!obligation) {
      return NextResponse.json(
        { error: `Obligation not found: ${data.obligationId}` },
        { status: 400 },
      )
    }
  }

  const created = await user.document.create({
    data: {
      tenantId: identity.tenantId,
      name: data.name,
      classification: data.classification,
      fileType: data.fileType,
      version: 1,
      uploadedBy: role.actor,
      obligationId: data.obligationId ?? null,
    },
    include: { obligation: { select: { title: true } } },
  })

  if (data.obligationId) {
    await user.activity.create({
      data: {
        tenantId: identity.tenantId,
        obligationId: data.obligationId,
        type: 'DOCUMENT_UPLOADED',
        actor: DEFAULT_ACTOR,
        message: `Uploaded "${data.name}"`,
      },
    })
  }

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'UPLOAD_DOCUMENT',
    resource: '/api/documents',
    detail: `"${data.name}" at ${data.classification}`,
    classification: data.classification,
    outcome: 'ALLOWED',
    reason: role.rationale,
  })

  return NextResponse.json({ document: serializeDocument(created) }, { status: 201 })
}
