import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { selectActiveRules, insertRuleVersion, RuleVersionError } from '@/lib/rule-versions'
import { loadInstruments, loadFacts, evaluateWithRows } from '@/lib/engine-loader'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'
import type { ImpactReport } from '@/lib/types'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const actionSchema = z.object({
  action: z.enum(['UNDER_REVIEW', 'APPROVE', 'REJECT']),
  note: z.string().trim().optional(),
})

/** Findings that flip between two evaluation runs — the impact report core. */
function diffReports(
  before: ReturnType<typeof evaluateWithRows>,
  after: ReturnType<typeof evaluateWithRows>,
  createdVersion: number,
): ImpactReport {
  const beforeBy = new Map(before.findings.map((f) => [f.refCode, f]))
  const findingsChanged = after.findings
    .filter((f) => {
      const b = beforeBy.get(f.refCode)
      if (!b) return false
      return b.status !== f.status || b.dueDate !== f.dueDate
    })
    .map((f) => {
      const b = beforeBy.get(f.refCode) as NonNullable<ReturnType<(typeof before.findings)['find']>>
      return {
        refCode: f.refCode,
        title: f.title,
        before: { status: b.status, dueDate: b.dueDate },
        after: { status: f.status, dueDate: f.dueDate },
        change:
          b.status !== f.status
            ? `status ${b.status} → ${f.status}${f.dueDate && f.dueDate !== b.dueDate ? `, due ${b.dueDate ?? '—'} → ${f.dueDate}` : ''}`
            : `due date ${b.dueDate ?? '—'} → ${f.dueDate ?? '—'}`,
      }
    })
  return {
    computedAt: new Date().toISOString(),
    createdVersion,
    findingsChanged,
    ratingBefore: before.summary.rating,
    ratingAfter: after.summary.rating,
    scoreBefore: before.summary.score,
    scoreAfter: after.summary.score,
    rulesEvaluated: after.summary.applicable,
  }
}

// ── POST /api/change-pipeline/[id] ───────────────────────────
// Human decision on an ingested circular. APPROVE applies the proposed
// field patch as a NEW rule version (never in place) and computes the
// impact report: the evaluator runs once with the rules as they were and
// once with the amended rule, and the report records exactly which
// findings flip. A rejected circular never touches the rule base.
export async function POST(
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
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { action, note } = parsed.data
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef

  const changeRequest = await user.changeRequest.findUnique({ where: { id } })
  if (!changeRequest) {
    return NextResponse.json({ error: 'Change request not found' }, { status: 404 })
  }
  if (changeRequest.status === 'APPROVED' || changeRequest.status === 'REJECTED') {
    return NextResponse.json({ error: `This change request was already ${changeRequest.status.toLowerCase()}` }, { status: 409 })
  }

  if (action === 'UNDER_REVIEW') {
    const updated = await user.changeRequest.update({
      where: { id },
      data: { status: 'UNDER_REVIEW', reviewedBy: role.actor, reviewedAt: new Date(), reviewNote: note ?? 'moved to review' },
    })
    return NextResponse.json({ request: { id: updated.id, status: updated.status } })
  }

  if (action === 'REJECT') {
    if (!note || note.trim().length < 5) {
      return NextResponse.json({ error: 'A rejection must record why (min 5 chars)' }, { status: 400 })
    }
    const updated = await user.changeRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedBy: identity.actor, reviewedAt: new Date(), reviewNote: note },
    })
    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'REJECT_CIRCULAR',
      resource: `/api/change-pipeline/${id}`,
      detail: `${changeRequest.issuer} ${changeRequest.reference} rejected — ${note.slice(0, 80)}`,
      classification: 'INTERNAL',
      outcome: 'ALLOWED',
      reason: 'Rejections are part of the auditable change pipeline.',
    })
    return NextResponse.json({ request: { id: updated.id, status: updated.status } })
  }

  // ── APPROVE ── apply the amendment as a new rule version + impact report.
  let proposed: Record<string, unknown>
  try {
    proposed = JSON.parse(changeRequest.proposedFields || '{}') as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Change request carries an unparseable field patch' }, { status: 500 })
  }

  const allowedFields = ['title', 'legalBasis', 'legalBasisNote', 'deadlineRule', 'deadlineNote', 'penaltyRef', 'evaluationType', 'trigger', 'verification', 'deadlineFormula', 'applicability', 'requiredEvidence']
  const patch: Record<string, string> = {}
  for (const key of allowedFields) {
    const value = proposed[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string') patch[key] = value
    else patch[key] = JSON.stringify(value)
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'The proposed field patch carries no applicable rule fields' }, { status: 400 })
  }

  const [instruments, facts] = await Promise.all([loadInstruments(), loadFacts(identity.tenantId)])

  // Impact is measured at the amendment's OWN effective date — the steady
  // state where the new version is in force and the superseded one is
  // closed. Evaluating at today's as-of would hide future-dated amendments.
  const impactAsOf = changeRequest.effectiveFrom

  // BEFORE: rules as they stand (with the current version still open) at the amendment date.
  const rowsBefore = await user.obligationTemplate.findMany({ orderBy: [{ refCode: 'asc' }, { version: 'asc' }] })
  const beforeSelection = selectActiveRules(rowsBefore, impactAsOf)
  // The current chain already reflects the inserted state only AFTER the
  // transaction, so for the BEFORE run close nothing — just drop versions
  // of the target rule created for this change request (none exist yet).
  const before = evaluateWithRows(beforeSelection.active, instruments, facts, impactAsOf)

  let created
  try {
    created = await db.$transaction((tx) =>
      insertRuleVersion(tx, {
        tenantId: identity.tenantId,
        refCode: changeRequest.refCode,
        effectiveFrom: changeRequest.effectiveFrom,
        patch,
        sourceRef: `ChangeRequest ${changeRequest.reference} (${changeRequest.issuer}) approved by ${identity.actor} (${role.label}) — ${changeRequest.title}`,
      }),
    )
  } catch (error) {
    if (error instanceof RuleVersionError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[change-pipeline] approve failed', error)
    return NextResponse.json({ error: 'Failed to create the amended rule version' }, { status: 500 })
  }

  // AFTER: same rules, amended version swapped in — active at its own
  // effective date, superseding the closed previous version.
  const rowsAfter = await user.obligationTemplate.findMany({ orderBy: [{ refCode: 'asc' }, { version: 'asc' }] })
  const selectionAfter = selectActiveRules(rowsAfter, impactAsOf)
  const afterRows = selectionAfter.active.map((r) => (r.refCode === changeRequest.refCode ? created : r))
  const after = evaluateWithRows(afterRows, instruments, facts, impactAsOf)

  const impact = diffReports(before, after, created.version)

  const updated = await user.changeRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedBy: identity.actor,
      reviewedAt: new Date(),
      reviewNote: note ?? 'approved — impact report computed',
      impactReport: JSON.stringify(impact),
    },
  })

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'APPROVE_CIRCULAR',
    resource: `/api/change-pipeline/${id}`,
    detail: `${changeRequest.issuer} ${changeRequest.reference} approved — rule ${changeRequest.refCode} v${created.version} · ${impact.findingsChanged.length} finding(s) flipped`,
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: 'Approvals create rule versions and must carry an accountable approver.',
  })

  return NextResponse.json({
    request: {
      id: updated.id,
      status: updated.status,
      createdVersion: created.version,
      impactReport: impact,
    },
  })
}
