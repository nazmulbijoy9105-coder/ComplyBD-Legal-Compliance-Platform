import { NextResponse, type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { DEFAULT_ACTOR, computeEffectiveStatus, isParseableDate, parseForms } from '@/lib/status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── response shapes ──────────────────────────────────────────
interface TemplateDetail {
  refCode: string
  module: string
  legalBasis: string
  legalBasisNote: string | null
  sourceTier: string
  lawStatus: string
  verification: string
  cadence: string
  deadlineRule: string
  deadlineNote: string | null
  applicableTo: string
  forms: string[]
}

interface DocumentItem {
  id: string
  name: string
  classification: string
  version: number
  fileType: string
  sizeKb: number
  uploadedBy: string
  createdAt: string
}

interface ActivityItem {
  id: string
  type: string
  actor: string
  message: string
  createdAt: string
}

interface ObligationDetail {
  id: string
  refCode: string | null
  title: string
  regulatorCode: string
  forms: string[]
  cadence: string
  periodLabel: string | null
  dueDate: string
  status: string
  priority: string
  assignee: string
  company: string
  notes: string | null
  filedAt: string | null
  updatedAt: string
  createdAt: string
  effectiveStatus: string
  template: TemplateDetail | null
  documents: DocumentItem[]
  activities: ActivityItem[]
}

type ObligationRow = Prisma.ObligationGetPayload<{
  include: { template: true; documents: true; activities: true }
}>

function serializeDetail(row: ObligationRow, now: Date): ObligationDetail {
  const template: TemplateDetail | null = row.template
    ? {
        refCode: row.template.refCode,
        module: row.template.module,
        legalBasis: row.template.legalBasis,
        legalBasisNote: row.template.legalBasisNote,
        sourceTier: row.template.sourceTier,
        lawStatus: row.template.lawStatus,
        verification: row.template.verification,
        cadence: row.template.cadence,
        deadlineRule: row.template.deadlineRule,
        deadlineNote: row.template.deadlineNote,
        applicableTo: row.template.applicableTo,
        forms: parseForms(row.template.forms),
      }
    : null

  return {
    id: row.id,
    refCode: row.refCode,
    title: row.title,
    regulatorCode: row.regulatorCode,
    forms: parseForms(row.forms),
    cadence: row.cadence,
    periodLabel: row.periodLabel,
    dueDate: row.dueDate.toISOString(),
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    company: row.company,
    notes: row.notes,
    filedAt: row.filedAt ? row.filedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    effectiveStatus: computeEffectiveStatus(row.status, row.dueDate, now),
    template,
    documents: [...row.documents]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((d) => ({
        id: d.id,
        name: d.name,
        classification: d.classification,
        version: d.version,
        fileType: d.fileType,
        sizeKb: d.sizeKb,
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt.toISOString(),
      })),
    activities: [...row.activities]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => ({
        id: a.id,
        type: a.type,
        actor: a.actor,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
      })),
  }
}

async function loadDetail(id: string, tenantId: string): Promise<ObligationDetail | null> {
  const user = tenantDb(tenantId)
  const row = await user.obligation.findUnique({
    where: { id },
    include: {
      template: true,
      documents: true,
      activities: true,
    },
  })
  if (!row) return null
  return serializeDetail(row, new Date())
}

// ── GET /api/obligations/[id] ────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const identity = await resolveIdentity(_request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const obligation = await loadDetail(id, identity.tenantId)
  if (!obligation) {
    return NextResponse.json({ error: 'Obligation not found' }, { status: 404 })
  }
  return NextResponse.json({ obligation })
}

// ── PATCH /api/obligations/[id] ──────────────────────────────
const patchSchema = z.object({
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'FILED']).optional(),
  assignee: z.string().trim().min(1).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z
    .string()
    .min(1)
    .refine(isParseableDate, 'dueDate must be a valid ISO date string')
    .optional(),
  notes: z.string().nullable().optional(),
  comment: z.string().trim().min(1).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const patch = parsed.data

  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const existing = await user.obligation.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Obligation not found' }, { status: 404 })
  }

  // ── apply updates ─────────────────────────────────────────
  const data: Prisma.ObligationUpdateInput = {}
  const statusChanged =
    patch.status !== undefined && patch.status !== existing.status

  if (statusChanged && patch.status) {
    data.status = patch.status
  }
  if (patch.assignee !== undefined) data.assignee = patch.assignee
  if (patch.priority !== undefined) data.priority = patch.priority
  if (patch.dueDate !== undefined) data.dueDate = new Date(patch.dueDate)
  if (patch.notes !== undefined) data.notes = patch.notes

  const filingNow = statusChanged && patch.status === 'FILED'
  if (filingNow) {
    data.filedAt = new Date()
  }

  const updated = await user.obligation.update({ where: { id }, data })

  // ── audit-trail logging ───────────────────────────────────
  const detailsChanged =
    (patch.assignee !== undefined && patch.assignee !== existing.assignee) ||
    (patch.priority !== undefined && patch.priority !== existing.priority) ||
    (patch.dueDate !== undefined &&
      new Date(patch.dueDate).getTime() !== existing.dueDate.getTime()) ||
    (patch.notes !== undefined && patch.notes !== existing.notes)

  const logEntries: { type: string; actor: string; message: string }[] = []

  if (statusChanged && patch.status) {
    logEntries.push({
      type: 'STATUS_CHANGE',
      actor: DEFAULT_ACTOR,
      message: `Status moved ${existing.status} → ${patch.status}`,
    })
  }
  if (filingNow) {
    logEntries.push({
      type: 'FILED',
      actor: DEFAULT_ACTOR,
      message: `Filed: ${existing.title}`,
    })
  }
  if (patch.comment !== undefined) {
    logEntries.push({
      type: 'COMMENT',
      actor: DEFAULT_ACTOR,
      message: patch.comment,
    })
  } else if (detailsChanged) {
    logEntries.push({
      type: 'UPDATED',
      actor: DEFAULT_ACTOR,
      message: 'Obligation details updated',
    })
  }

  if (logEntries.length > 0) {
    await user.activity.createMany({
      data: logEntries.map((entry) => ({
        tenantId: identity.tenantId,
        obligationId: id,
        type: entry.type,
        actor: entry.actor,
        message: entry.message,
      })),
    })
  }

  const obligation = await loadDetail(updated.id, identity.tenantId)
  return NextResponse.json({ obligation })
}
