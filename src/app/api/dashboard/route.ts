import { NextResponse, type NextRequest } from 'next/server'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { db } from '@/lib/db'
import {
  STATUS_FILED,
  STATUS_OVERDUE,
  computeEffectiveStatus,
  isDueSoon,
  parseForms,
} from '@/lib/status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Stats {
  total: number
  open: number
  overdue: number
  dueSoon: number
  filedThisYear: number
  complianceScore: number
}

interface RegulatorBreakdownRow {
  code: string
  name: string
  fullName: string
  total: number
  filed: number
  overdue: number
  dueSoon: number
}

interface UpcomingTemplateCaveat {
  refCode: string
  verification: string
  legalBasis: string
  deadlineRule: string
  sourceTier: string
}

interface UpcomingItem {
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
  template: UpcomingTemplateCaveat | null
}

interface ActivityItem {
  id: string
  type: string
  actor: string
  message: string
  createdAt: string
  obligationId: string | null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const now = new Date()
  const currentYear = now.getUTCFullYear()

  const [obligations, regulators, activities] = await Promise.all([
    user.obligation.findMany({
      select: {
        id: true,
        title: true,
        refCode: true,
        regulatorCode: true,
        forms: true,
        cadence: true,
        periodLabel: true,
        dueDate: true,
        status: true,
        priority: true,
        assignee: true,
        filedAt: true,
        template: {
          select: {
            refCode: true,
            verification: true,
            legalBasis: true,
            deadlineRule: true,
            sourceTier: true,
          },
        },
      },
    }),
    db.regulator.findMany({ orderBy: { sortOrder: 'asc' } }),
    user.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        actor: true,
        message: true,
        createdAt: true,
        obligationId: true,
      },
    }),
  ])

  // ── portfolio stats ────────────────────────────────────────
  let open = 0
  let overdue = 0
  let dueSoon = 0
  let filed = 0
  let filedThisYear = 0

  for (const o of obligations) {
    const effective = computeEffectiveStatus(o.status, o.dueDate, now)
    if (o.status === STATUS_FILED) {
      filed += 1
      if (o.filedAt && o.filedAt.getUTCFullYear() === currentYear) filedThisYear += 1
      continue
    }
    open += 1
    if (effective === STATUS_OVERDUE) overdue += 1
    if (isDueSoon(o.status, o.dueDate, now)) dueSoon += 1
  }

  const total = obligations.length
  const stats: Stats = {
    total,
    open,
    overdue,
    dueSoon,
    filedThisYear,
    complianceScore: total > 0 ? Math.round((filed / total) * 100) : 0,
  }

  // ── regulator breakdown (always all regulators, even at 0) ─
  const regulatorBreakdown: RegulatorBreakdownRow[] = regulators.map((reg) => {
    const rows = obligations.filter((o) => o.regulatorCode === reg.code)
    let regFiled = 0
    let regOverdue = 0
    let regDueSoon = 0
    for (const o of rows) {
      if (o.status === STATUS_FILED) {
        regFiled += 1
        continue
      }
      if (computeEffectiveStatus(o.status, o.dueDate, now) === STATUS_OVERDUE) regOverdue += 1
      if (isDueSoon(o.status, o.dueDate, now)) regDueSoon += 1
    }
    return {
      code: reg.code,
      name: reg.name,
      fullName: reg.fullName,
      total: rows.length,
      filed: regFiled,
      overdue: regOverdue,
      dueSoon: regDueSoon,
    }
  })

  // ── upcoming: next 8 open obligations by dueDate (overdue first) ─
  const upcoming: UpcomingItem[] = obligations
    .filter((o) => o.status !== STATUS_FILED)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      title: o.title,
      refCode: o.refCode,
      regulatorCode: o.regulatorCode,
      forms: parseForms(o.forms),
      cadence: o.cadence,
      periodLabel: o.periodLabel,
      dueDate: o.dueDate.toISOString(),
      status: o.status,
      priority: o.priority,
      assignee: o.assignee,
      effectiveStatus: computeEffectiveStatus(o.status, o.dueDate, now),
      template: o.template
        ? {
            refCode: o.template.refCode,
            verification: o.template.verification,
            legalBasis: o.template.legalBasis,
            deadlineRule: o.template.deadlineRule,
            sourceTier: o.template.sourceTier,
          }
        : null,
    }))

  // ── latest audit-trail activity ────────────────────────────
  const activity: ActivityItem[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    actor: a.actor,
    message: a.message,
    createdAt: a.createdAt.toISOString(),
    obligationId: a.obligationId,
  }))

  return NextResponse.json({ stats, regulatorBreakdown, upcoming, activity })
}
