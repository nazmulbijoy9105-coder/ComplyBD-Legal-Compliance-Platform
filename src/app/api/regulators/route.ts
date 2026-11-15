import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { STATUS_FILED, STATUS_OVERDUE, computeEffectiveStatus, parseForms } from '@/lib/status'
import { CATALOGUE_PENDING_ITEMS, CATALOGUE_VOLUNTARY } from '@/lib/catalogue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface TemplateRow {
  refCode: string
  module: string
  title: string
  description: string | null
  legalBasis: string
  legalBasisNote: string | null
  sourceTier: string
  lawStatus: string
  verification: string
  forms: string[]
  cadence: string
  deadlineRule: string
  deadlineNote: string | null
  applicableTo: string
  openCount: number
  overdueCount: number
}

interface RegulatorRow {
  code: string
  name: string
  fullName: string
  description: string
  scopeNote: string | null
  templates: TemplateRow[]
}

// Source-reviewed static sections — served from the canonical catalogue
// (src/lib/catalogue.ts) so seed and engine share one definition. Drift
// between this presentation copy and the seed manifest is impossible by
// construction and covered by GET /api/reconciliation.
const VOLUNTARY = CATALOGUE_VOLUNTARY
const PENDING_ITEMS = CATALOGUE_PENDING_ITEMS

// ── GET /api/regulators ──────────────────────────────────────
// Regulators are GLOBAL (the statute book is shared); rules and
// obligations are TENANT-SCOPED.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const now = new Date()

  const [regulators, templates, obligations] = await Promise.all([
    db.regulator.findMany({ orderBy: { sortOrder: 'asc' } }),
    user.obligationTemplate.findMany(),
    user.obligation.findMany({
      select: {
        refCode: true,
        templateId: true,
        status: true,
        dueDate: true,
      },
    }),
  ])

  const templatesByRegulator = new Map<string, typeof templates>()
  for (const t of templates) {
    const bucket = templatesByRegulator.get(t.regulatorCode)
    if (bucket) {
      bucket.push(t)
    } else {
      templatesByRegulator.set(t.regulatorCode, [t])
    }
  }

  const result: RegulatorRow[] = regulators.map((reg) => {
    const regTemplates = [...(templatesByRegulator.get(reg.code) ?? [])].sort(
      (a, b) => a.refCode.localeCompare(b.refCode),
    )

    const mappedTemplates: TemplateRow[] = regTemplates.map((t) => {
      // An obligation belongs to a template via refCode or templateId.
      const linked = obligations.filter(
        (o) => o.refCode === t.refCode || o.templateId === t.id,
      )
      const openCount = linked.filter((o) => o.status !== STATUS_FILED).length
      const overdueCount = linked.filter(
        (o) => computeEffectiveStatus(o.status, o.dueDate, now) === STATUS_OVERDUE,
      ).length

      return {
        refCode: t.refCode,
        module: t.module,
        title: t.title,
        description: t.description,
        legalBasis: t.legalBasis,
        legalBasisNote: t.legalBasisNote,
        sourceTier: t.sourceTier,
        lawStatus: t.lawStatus,
        verification: t.verification,
        forms: parseForms(t.forms),
        cadence: t.cadence,
        deadlineRule: t.deadlineRule,
        deadlineNote: t.deadlineNote,
        applicableTo: t.applicableTo,
        instrumentCode: t.instrumentCode,
        evaluationType: t.evaluationType,
        openCount,
        overdueCount,
      }
    })

    return {
      code: reg.code,
      name: reg.name,
      fullName: reg.fullName,
      description: reg.description,
      scopeNote: reg.scopeNote,
      templates: mappedTemplates,
    }
  })

  return NextResponse.json({
    regulators: result,
    voluntary: VOLUNTARY,
    pendingItems: PENDING_ITEMS,
  })
}
