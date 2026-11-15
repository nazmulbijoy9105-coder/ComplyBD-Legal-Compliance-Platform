import { NextResponse, type NextRequest } from 'next/server'
import { selectActiveRules } from '@/lib/rule-versions'
import { loadInstruments, loadFacts, evaluateWithRows } from '@/lib/engine-loader'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'
import { sweepEngineAlerts } from '@/lib/alerts'
import type { ComplianceEngineData, RuleVersionRow } from '@/lib/types'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Platform as-of date (mirrors the header date). The evaluator is a pure
// function, so any other as-of can be replayed via ?asOf=YYYY-MM-DD.
const PLATFORM_AS_OF = '2026-11-15'

function parseAsOf(raw: string | null): string {
  if (!raw) return PLATFORM_AS_OF
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return PLATFORM_AS_OF
  // reject impossible dates (e.g. 2026-02-31) — Date normalises them, so re-check
  const d = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return PLATFORM_AS_OF
  return raw
}

// ── GET /api/compliance-engine?asOf=YYYY-MM-DD ───────────────
// The engine loads its rules from the database — the code holds no rule
// definitions. The loader fetches every version and selects ONLY the
// versions whose effective window covers the as-of date (that is what
// makes re-running an old verdict as of an old date reproducible), runs
// the pure evaluator over (facts, rules, as-of) and persists the run with
// its exact fact snapshot for replay. Access is logged: findings can
// embed unpublished, price-sensitive timing data.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const asOf = parseAsOf(searchParams.get('asOf'))
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef

  const [profileRow, allTemplateRows, instruments, facts, recentRuns, pendingChanges] = await Promise.all([
    user.companyProfile.findFirst(),
    user.obligationTemplate.findMany({ orderBy: [{ refCode: 'asc' }, { version: 'asc' }] }),
    loadInstruments(),
    loadFacts(identity.tenantId),
    user.complianceRun.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    user.changeRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  // Rule loader — versions active at the as-of date, with loud errors for
  // overlapping windows (never silently resolved) and rules not yet in force.
  const selection = selectActiveRules(allTemplateRows, asOf)
  const report = evaluateWithRows(selection.active, instruments, facts, asOf)

  // Persist the run with the exact fact snapshot — any past finding replays.
  const run = await db.complianceRun.create({
    data: {
      tenantId: identity.tenantId,
      asOf,
      summary: JSON.stringify(report.summary),
      factSnapshot: JSON.stringify(report.factState),
      findings: {
        create: report.findings.map((f) => ({
          tenantId: identity.tenantId,
          refCode: f.refCode,
          title: f.title,
          regulatorCode: f.regulatorCode,
          evaluationType: f.evaluationType,
          trigger: f.trigger,
          status: f.status,
          dueDate: f.dueDate,
          gateTrace: JSON.stringify(f.gateTrace),
          reason: f.reason,
          ruleVerification: f.ruleVerification,
          ruleVersion: f.ruleVersion,
          instrumentCode: f.instrumentCode,
        })),
      },
    },
  })

  // Access log — a compliance run surfaces deadline computations for a
  // listed company (INTERNAL at minimum): log who ran what, when.
  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'RUN_COMPLIANCE_ENGINE',
    resource: '/api/compliance-engine',
    detail: `run ${run.id.slice(-8)} · as-of ${asOf} · ${report.summary.applicable} applicable findings · rating ${report.summary.rating}`,
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: role.rationale,
  })

  // Engine-health sweep — gaps, stale unverified rules and pending
  // circulars raise OPEN alerts (deduped) and notify the webhook; when a
  // condition clears the alert resolves. A stale GREEN is the worst
  // failure mode, so the sweep runs on EVERY evaluation.
  await sweepEngineAlerts(identity.tenantId, {
    asOf,
    runId: run.id,
    findings: report.findings.map((f) => ({ refCode: f.refCode, status: f.status, title: f.title })),
    rulesInForce: selection.active,
    changeRequests: pendingChanges.map((c) => ({
      id: c.id,
      refCode: c.refCode,
      title: c.title,
      issuer: c.issuer,
      reference: c.reference,
      status: c.status,
      createdAt: c.createdAt,
    })),
  })

  // Full version chain per rule ID for the registry view.
  const activeIds = new Set(selection.active.map((r) => r.id))
  const ruleVersions: RuleVersionRow[] = allTemplateRows.map((t) => ({
    refCode: t.refCode,
    version: t.version,
    title: t.title,
    evaluationType: t.evaluationType,
    verification: t.verification,
    deadlineRule: t.deadlineRule,
    effectiveFrom: t.effectiveFrom,
    effectiveTo: t.effectiveTo,
    sourceRef: t.sourceRef,
    activeAtAsOf: activeIds.has(t.id),
  }))

  const data: ComplianceEngineData = {
    runId: run.id,
    asOf: report.asOf,
    replayable: true,
    summary: report.summary,
    findings: report.findings,
    factState: report.factState,
    instruments,
    facts,
    profile: profileRow
      ? { name: profileRow.name, stockTickers: profileRow.stockTickers, sector: profileRow.sector, note: profileRow.note }
      : { name: 'Unknown company', stockTickers: null, sector: '', note: null },
    recentRuns: recentRuns.map((r) => {
      const summary = JSON.parse(r.summary) as { score?: number; rating?: string }
      return {
        id: r.id,
        asOf: r.asOf,
        createdAt: r.createdAt.toISOString(),
        score: summary.score ?? 0,
        rating: summary.rating ?? 'UNKNOWN',
      }
    }),
    ruleVersions,
    overlaps: selection.overlaps,
    notYetInForce: selection.notYetInForce,
  }

  return NextResponse.json(data)
}
