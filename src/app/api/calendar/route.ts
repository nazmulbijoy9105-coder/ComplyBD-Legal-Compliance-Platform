import { NextResponse, type NextRequest } from 'next/server'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { STATUS_FILED, STATUS_OVERDUE, computeEffectiveStatus, parseForms } from '@/lib/status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Verification caveat carried on every statutory row — mirrors the
// source map (Regulatory Mapping v2) so calendar data states how the
// row was source-reviewed.
interface TemplateCaveat {
  refCode: string
  verification: string
  legalBasis: string
  legalBasisNote: string | null
  deadlineRule: string
  sourceTier: string
}

interface CalendarEvent {
  id: string
  title: string
  refCode: string | null
  regulatorCode: string
  forms: string[]
  cadence: string
  periodLabel: string | null
  dueDate: string
  status: string
  priority: string
  assignee: string
  effectiveStatus: string
  template: TemplateCaveat | null
}

interface MonthSummary {
  total: number
  overdue: number
  filed: number
  open: number
}

// ── GET /api/calendar?year=YYYY&month=1-12 ───────────────────
// Tenant-scoped statutory calendar.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const { searchParams } = new URL(request.url)
  const now = new Date()

  const rawYear = Number.parseInt(searchParams.get('year') ?? '', 10)
  const rawMonth = Number.parseInt(searchParams.get('month') ?? '', 10)

  const year = Number.isInteger(rawYear) ? rawYear : now.getUTCFullYear()
  const month =
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth
      : now.getUTCMonth() + 1

  // Month window in UTC: [start, nextMonthStart)
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const nextMonthStart = new Date(Date.UTC(year, month, 1))

  const rows = await user.obligation.findMany({
    where: {
      dueDate: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    include: {
      template: {
        select: {
          refCode: true,
          verification: true,
          legalBasis: true,
          legalBasisNote: true,
          deadlineRule: true,
          sourceTier: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  let overdue = 0
  let filed = 0
  let open = 0

  const events: CalendarEvent[] = rows.map((row) => {
    const effective = computeEffectiveStatus(row.status, row.dueDate, now)
    if (row.status === STATUS_FILED) {
      filed += 1
    } else {
      open += 1
      if (effective === STATUS_OVERDUE) overdue += 1
    }
    return {
      id: row.id,
      title: row.title,
      refCode: row.refCode,
      regulatorCode: row.regulatorCode,
      forms: parseForms(row.forms),
      cadence: row.cadence,
      periodLabel: row.periodLabel,
      dueDate: row.dueDate.toISOString(),
      status: row.status,
      priority: row.priority,
      assignee: row.assignee,
      effectiveStatus: effective,
      template: row.template
        ? {
            refCode: row.template.refCode,
            verification: row.template.verification,
            legalBasis: row.template.legalBasis,
            legalBasisNote: row.template.legalBasisNote,
            deadlineRule: row.template.deadlineRule,
            sourceTier: row.template.sourceTier,
          }
        : null,
    }
  })

  const monthSummary: MonthSummary = {
    total: events.length,
    overdue,
    filed,
    open,
  }

  return NextResponse.json({ events, monthSummary })
}
