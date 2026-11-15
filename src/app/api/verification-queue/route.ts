import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { selectActiveRules, insertRuleVersion, RuleVersionError } from '@/lib/rule-versions'
import { loadInstruments } from '@/lib/engine-loader'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'
import { PLATFORM_AS_OF } from '@/lib/platform'
import { DETERMINISTIC_KINDS } from '@/lib/evaluator'
import type { EngineInstrument, EngineRule } from '@/lib/evaluator'
import type { VerificationPendingItem, VerificationQueueData } from '@/lib/types'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/verification-queue ──────────────────────────────
// Every deadline is checked against the actual law text BEFORE the rule
// goes in — this queue is where that happens inside the platform, not as
// an off-system chore. Pending items are derived live from the rule rows:
// an unverified deadline formula, an unverified penalty citation or an
// unverified instrument citation each queue a confirmation task. A
// confirmation applies the verified definition as a NEW rule version
// (never in place) and the finding stops being provisional.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const [rows, instruments, recent] = await Promise.all([
    user.obligationTemplate.findMany({ orderBy: [{ refCode: 'asc' }, { version: 'asc' }] }),
    loadInstruments(),
    user.ruleVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }),
  ])

  const { active } = selectActiveRules(rows, PLATFORM_AS_OF)
  const instrumentByCode = new Map<string, EngineInstrument>(instruments.map((i) => [i.code, i]))

  const pending: VerificationPendingItem[] = []
  let detTotal = 0
  let detVerified = 0

  for (const rule of active) {
    let formula: (EngineRule['deadlineFormula'] & Record<string, unknown>) | null = null
    try {
      const parsed = JSON.parse(rule.deadlineFormula || '{}') as EngineRule['deadlineFormula']
      formula = parsed && parsed.kind ? parsed : null
    } catch {
      formula = null
    }

    const subjects: VerificationPendingItem['subjects'] = []
    if (rule.evaluationType === 'DETERMINISTIC') {
      detTotal += 1
      if (formula && formula.unverified === false) detVerified += 1
      else subjects.push('DEADLINE_FORMULA')
    }
    if (rule.penaltyRef && rule.penaltyRef.toUpperCase().includes('UNVERIFIED')) subjects.push('PENALTY_REF')
    if (rule.verification !== 'VERIFIED') subjects.push('CITATION')
    if (subjects.length === 0) continue

    const instrument = rule.instrumentCode ? instrumentByCode.get(rule.instrumentCode) : undefined
    pending.push({
      refCode: rule.refCode,
      version: rule.version,
      title: rule.title,
      regulatorCode: rule.regulatorCode,
      subjects,
      claim: rule.deadlineRule,
      deadlineFormula: formula,
      instrumentCode: rule.instrumentCode,
      instrumentTitle: instrument?.title ?? null,
      instrumentReference: instrument?.reference ?? null,
      instrumentSourceUrl: instrument?.sourceUrl ?? null,
      ruleVerification: rule.verification,
      penaltyRef: rule.penaltyRef,
    })
  }

  const data: VerificationQueueData = {
    pending,
    recent: recent.map((v) => ({
      id: v.id,
      refCode: v.refCode,
      subject: v.subject,
      claim: v.claim,
      status: v.status,
      decidedBy: v.decidedBy,
      decidedRole: v.decidedRole,
      decidedAt: v.decidedAt ? v.decidedAt.toISOString() : null,
      proposedNote: v.proposedNote,
    })),
    verifiedDeadlinePct: detTotal > 0 ? Math.round((detVerified / detTotal) * 100) : 0,
  }
  return NextResponse.json(data)
}

// ── POST /api/verification-queue ─────────────────────────────
const formulaSchema = z.object({
  kind: z.enum(Object.keys(DETERMINISTIC_KINDS) as [keyof typeof DETERMINISTIC_KINDS, ...string[]]),
  days: z.number().int().positive().optional(),
  months: z.number().int().positive().optional(),
  anchorDay: z.number().int().min(1).max(31).optional(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  factKey: z.string().trim().min(1).optional(),
})

const confirmSchema = z.object({
  refCode: z.string().trim().min(1),
  subject: z.enum(['DEADLINE_FORMULA', 'PENALTY_REF', 'CITATION']),
  action: z.enum(['CONFIRM', 'REJECT']),
  note: z.string().trim().min(5, 'the citation note is required (where in the instrument was this confirmed?)'),
  formula: formulaSchema.optional(),
  confirmedRuleText: z.string().trim().min(1).optional(),
  confirmedPenaltyRef: z.string().trim().min(1).optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { refCode, subject, action, note, formula, confirmedRuleText, confirmedPenaltyRef } = parsed.data
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef

  const current = await user.obligationTemplate.findFirst({ where: { refCode, effectiveTo: null } })
  if (!current) {
    return NextResponse.json({ error: `Unknown rule "${refCode}"` }, { status: 404 })
  }

  const claim = current.deadlineRule

  // REJECT — keep the rule unverified, record the human rejection.
  if (action === 'REJECT') {
    const row = await db.ruleVerification.create({
      data: {
        tenantId: identity.tenantId,
        refCode,
        ruleVersion: current.version,
        subject,
        claim,
        instrumentCode: current.instrumentCode ?? 'UNREGISTERED',
        instrumentReference: 'n/a — rejected, instrument text does not support the claim',
        proposedNote: note,
        status: 'REJECTED',
        decidedBy: role.actor,
        decidedRole: role.label,
        decidedAt: new Date(),
      },
    })
    return NextResponse.json({ verification: { id: row.id, status: 'REJECTED' } }, { status: 201 })
  }

  // CONFIRM — apply the verified definition as a NEW rule version.
  const patch: Record<string, string> = { verification: 'VERIFIED' }
  let proposedFormulaJson: string | null = null

  if (subject === 'DEADLINE_FORMULA') {
    if (!formula) {
      return NextResponse.json({ error: 'Confirming a deadline formula requires the verified formula object' }, { status: 400 })
    }
    // Validate the formula is complete enough for the engine to evaluate.
    if ((formula.kind === 'DAYS_FROM_MONTH_END' || formula.kind === 'DAYS_FROM_QUARTER_END' || formula.kind === 'DAYS_FROM_FACT') && !formula.days) {
      return NextResponse.json({ error: `kind ${formula.kind} requires "days"` }, { status: 400 })
    }
    if (formula.kind === 'DAYS_FROM_FACT' && !formula.factKey) {
      return NextResponse.json({ error: 'kind DAYS_FROM_FACT requires "factKey"' }, { status: 400 })
    }
    if (formula.kind === 'MONTHS_FROM_FY_END' && !formula.months) {
      return NextResponse.json({ error: 'kind MONTHS_FROM_FY_END requires "months"' }, { status: 400 })
    }
    if (formula.kind === 'FIXED_DATE' && (!formula.month || !formula.day)) {
      return NextResponse.json({ error: 'kind FIXED_DATE requires "month" and "day"' }, { status: 400 })
    }
    const verified = { ...formula, unverified: false, note }
    patch.deadlineFormula = JSON.stringify(verified)
    patch.deadlineRule = confirmedRuleText ?? current.deadlineRule
    patch.deadlineNote = `${note} — confirmed against the instrument text by ${role.label}.`
    proposedFormulaJson = JSON.stringify(verified)
  } else if (subject === 'PENALTY_REF') {
    patch.penaltyRef = confirmedPenaltyRef ?? note
    if (!confirmedPenaltyRef) {
      return NextResponse.json({ error: 'Confirming a penalty reference requires the verified citation text' }, { status: 400 })
    }
  } else {
    patch.legalBasisNote = `${current.legalBasisNote ? `${current.legalBasisNote} ` : ''}Citation confirmed: ${note}`
  }

  const sourceRef = `RuleVerification · ${subject} confirmed against ${current.instrumentCode ?? 'the instrument'} by ${role.actor} (${role.label}) — ${note}`

  // The confirmed definition takes effect at the platform as-of — unless a
  // previous confirmation already started on that date, in which case it
  // starts the next day (version windows must never overlap).
  const effectiveFrom =
    current.effectiveFrom >= PLATFORM_AS_OF
      ? new Date(new Date(`${current.effectiveFrom}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)
      : PLATFORM_AS_OF

  try {
    const created = await db.$transaction((tx) =>
      insertRuleVersion(tx, {
        tenantId: identity.tenantId,
        refCode,
        effectiveFrom,
        patch,
        sourceRef,
      }),
    )
    await db.ruleVerification.create({
      data: {
        tenantId: identity.tenantId,
        refCode,
        ruleVersion: created.version,
        subject,
        claim,
        instrumentCode: current.instrumentCode ?? 'UNREGISTERED',
        instrumentReference: sourceRef,
        proposedFormula: proposedFormulaJson,
        proposedNote: note,
        status: 'CONFIRMED',
        decidedBy: role.actor,
        decidedRole: role.label,
        decidedAt: new Date(),
      },
    })
    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'CONFIRM_RULE_VERIFICATION',
      resource: `/api/verification-queue ${refCode}`,
      detail: `${subject} confirmed — rule v${created.version} effective ${created.effectiveFrom}`,
      classification: 'INTERNAL',
      outcome: 'ALLOWED',
      reason: 'Deadline confirmations cite the instrument and carry an accountable verifier.',
    })
    return NextResponse.json({ rule: { refCode: created.refCode, version: created.version, effectiveFrom: created.effectiveFrom } }, { status: 201 })
  } catch (error) {
    if (error instanceof RuleVersionError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[api/verification-queue] failed', error)
    return NextResponse.json({ error: 'Failed to record verification' }, { status: 500 })
  }
}
