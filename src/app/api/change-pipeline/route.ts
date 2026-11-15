import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'
import type { ChangePipelineData, ChangeRequestItem } from '@/lib/types'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/change-pipeline ─────────────────────────────────
// BSEC/DSE circulars are ingested through a human-approved flow. Each
// approval triggers an impact report showing which findings change.
// Without this the engine goes stale silently — and a stale GREEN is
// the worst failure mode.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const [rows, templateRows] = await Promise.all([
    user.changeRequest.findMany({ orderBy: { createdAt: 'desc' } }),
    user.obligationTemplate.findMany({ where: { effectiveTo: null }, orderBy: { refCode: 'asc' } }),
  ])

  const requests: ChangeRequestItem[] = rows.map((r) => {
    let impact: unknown = null
    try {
      impact = r.impactReport ? (JSON.parse(r.impactReport) as unknown) : null
    } catch {
      impact = null
    }
    return {
      id: r.id,
      refCode: r.refCode,
      title: r.title,
      issuer: r.issuer,
      reference: r.reference,
      publishedAt: r.publishedAt,
      summary: r.summary,
      effectiveFrom: r.effectiveFrom,
      status: r.status,
      proposedFields: (() => {
        try {
          return JSON.parse(r.proposedFields || '{}') as Record<string, unknown>
        } catch {
          return {}
        }
      })(),
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      reviewNote: r.reviewNote,
      impactReport: impact as ChangeRequestItem['impactReport'],
      createdAt: r.createdAt.toISOString(),
    }
  })

  const data: ChangePipelineData = {
    requests,
    ruleIds: templateRows.map((t) => ({ refCode: t.refCode, title: t.title, version: t.version })),
  }
  return NextResponse.json(data)
}

// ── POST /api/change-pipeline ────────────────────────────────
// Ingest a circular into the pipeline. It enters as RECEIVED — nothing
// touches the rule base until a human approves it.
const ingestSchema = z.object({
  refCode: z.string().trim().min(1, 'the rule this change targets is required'),
  title: z.string().trim().min(1),
  issuer: z.enum(['BSEC', 'DSE', 'CSE', 'RJSC', 'NBR', 'BB']),
  reference: z.string().trim().min(1, 'the circular/notification reference is required'),
  publishedAt: z.string().trim().min(4),
  summary: z.string().trim().min(10, 'summarise what the circular changes (min 10 chars)'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD'),
  proposedFields: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ingestSchema.safeParse(body)
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

  const targetRule = await user.obligationTemplate.findFirst({ where: { refCode: data.refCode, effectiveTo: null } })
  if (!targetRule) {
    return NextResponse.json({ error: `Unknown rule "${data.refCode}"` }, { status: 404 })
  }
  if (Object.keys(data.proposedFields).length === 0) {
    return NextResponse.json({ error: 'An amendment must propose at least one field change' }, { status: 400 })
  }

  const created = await db.changeRequest.create({
    data: {
      tenantId: identity.tenantId,
      refCode: data.refCode,
      title: data.title,
      issuer: data.issuer,
      reference: data.reference,
      publishedAt: data.publishedAt,
      summary: data.summary,
      proposedFields: JSON.stringify(data.proposedFields),
      effectiveFrom: data.effectiveFrom,
      status: 'RECEIVED',
    },
  })

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'INGEST_CIRCULAR',
    resource: `/api/change-pipeline ${created.id.slice(-6)}`,
    detail: `${data.issuer} ${data.reference} → ${data.refCode}`,
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: 'Regulatory circulars enter through the human-approved change pipeline.',
  })

  return NextResponse.json({ request: { id: created.id, status: created.status } }, { status: 201 })
}
