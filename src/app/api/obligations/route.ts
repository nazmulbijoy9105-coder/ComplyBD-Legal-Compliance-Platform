import { NextResponse, type NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import {
  STATUS_FILED,
  STATUS_OVERDUE,
  computeEffectiveStatus,
  isParseableDate,
  parseForms,
} from '@/lib/status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── response shapes ──────────────────────────────────────────
interface TemplateSummary {
  refCode: string
  verification: string
  deadlineRule: string
  deadlineNote: string | null
  legalBasis: string
  sourceTier: string
  module: string
}

interface ObligationItem {
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
  template: TemplateSummary | null
}

type ObligationRow = Prisma.ObligationGetPayload<{ include: { template: true } }>

function serializeObligation(
  row: ObligationRow,
  now: Date,
): ObligationItem {
  const template: TemplateSummary | null = row.template
    ? {
        refCode: row.template.refCode,
        verification: row.template.verification,
        deadlineRule: row.template.deadlineRule,
        deadlineNote: row.template.deadlineNote,
        legalBasis: row.template.legalBasis,
        sourceTier: row.template.sourceTier,
        module: row.template.module,
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
  }
}

// ── GET /api/obligations ─────────────────────────────────────
// Tenant-scoped register.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const regulator = searchParams.get('regulator')?.trim() ?? ''
  const status = searchParams.get('status')?.trim() ?? ''
  const priority = searchParams.get('priority')?.trim() ?? ''

  const where: Prisma.ObligationWhereInput = {}

  if (q.length > 0) {
    // SQLite `contains` (LIKE) is case-insensitive for ASCII.
    where.OR = [
      { title: { contains: q } },
      { assignee: { contains: q } },
      { notes: { contains: q } },
    ]
  }
  if (regulator.length > 0) {
    where.regulatorCode = regulator
  }
  if (priority.length > 0) {
    where.priority = priority
  }
  if (status.length > 0) {
    if (status === STATUS_OVERDUE) {
      // Effective status OVERDUE = not FILED and dueDate in the past.
      where.status = { not: STATUS_FILED }
      where.dueDate = { lt: new Date() }
    } else {
      where.status = status
    }
  }

  const rows = await user.obligation.findMany({
    where,
    include: { template: true },
    orderBy: { dueDate: 'asc' },
  })

  const now = new Date()
  const obligations = rows.map((row) => serializeObligation(row, now))

  return NextResponse.json({ obligations })
}

// ── POST /api/obligations ────────────────────────────────────
const createSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  regulatorCode: z.string().trim().min(1, 'regulatorCode is required'),
  dueDate: z
    .string()
    .min(1, 'dueDate is required')
    .refine(isParseableDate, 'dueDate must be a valid ISO date string'),
  assignee: z.string().trim().min(1, 'assignee is required'),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  cadence: z.enum(['ANNUAL', 'QUARTERLY', 'MONTHLY', 'EVENT', 'ON_CHANGE']).default('EVENT'),
  periodLabel: z.string().optional(),
  notes: z.string().optional(),
  forms: z.array(z.string()).optional(),
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

  const regulator = await db.regulator.findUnique({
    where: { code: data.regulatorCode },
  })
  if (!regulator) {
    return NextResponse.json(
      { error: `Unknown regulatorCode: ${data.regulatorCode}` },
      { status: 400 },
    )
  }

  const created = await user.obligation.create({
    data: {
      tenantId: identity.tenantId,
      title: data.title,
      regulatorCode: data.regulatorCode,
      dueDate: new Date(data.dueDate),
      assignee: data.assignee,
      priority: data.priority,
      cadence: data.cadence,
      periodLabel: data.periodLabel ?? null,
      notes: data.notes ?? null,
      forms: data.forms ? JSON.stringify(data.forms) : null,
      status: 'DRAFT',
    },
    include: { template: true },
  })

  await user.activity.create({
    data: {
      tenantId: identity.tenantId,
      obligationId: created.id,
      type: 'CREATED',
      actor: data.assignee,
      message: `Obligation created: ${data.title}`,
    },
  })

  const obligation = serializeObligation(created, new Date())
  return NextResponse.json({ obligation }, { status: 201 })
}
