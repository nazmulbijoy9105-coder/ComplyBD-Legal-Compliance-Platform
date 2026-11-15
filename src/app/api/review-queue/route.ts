import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { selectActiveRules } from '@/lib/rule-versions'
import { loadFacts } from '@/lib/engine-loader'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'
import { PLATFORM_AS_OF } from '@/lib/platform'
import type { EngineFact } from '@/lib/evaluator'
import type { ReviewQueueData } from '@/lib/types'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/review-queue ────────────────────────────────────
// JUDGMENT findings go to an advocate or company secretary for sign-off.
// Open items = judgment rules with no human determination on file (or one
// that was escalated). Decisions are logged with reasoning and timestamp,
// and mirrored into the fact store as judgment.<refCode> so past runs
// replay exactly.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const [rows, facts, decisions] = await Promise.all([
    user.obligationTemplate.findMany({ orderBy: [{ refCode: 'asc' }, { version: 'asc' }] }),
    loadFacts(identity.tenantId),
    user.reviewDecision.findMany({ orderBy: { decidedAt: 'desc' }, take: 20 }),
  ])

  const { active } = selectActiveRules(rows, PLATFORM_AS_OF)
  const judgmentRules = active.filter((r) => r.evaluationType === 'JUDGMENT')

  // Latest judgment fact per rule at the platform as-of (mirror of the review queue).
  const judgmentFacts = new Map<string, EngineFact>()
  for (const f of facts.filter((x) => x.type === 'FACT' && x.key.startsWith('judgment.') && x.asOf <= PLATFORM_AS_OF)) {
    const key = f.key.replace('judgment.', '')
    const incumbent = judgmentFacts.get(key)
    if (!incumbent || f.asOf >= incumbent.asOf) judgmentFacts.set(key, f)
  }

  const relevantKeys = ['board_size', 'independent_directors', 'audit_committee_formed', 'nomination_remuneration_committee_formed']
  const factState = new Map(facts.filter((f) => f.type === 'FACT' && f.asOf <= PLATFORM_AS_OF).map((f) => [f.key, f]))

  const openItems: ReviewQueueData['openItems'] = judgmentRules
    .filter((r) => {
      const decision = judgmentFacts.get(r.refCode)
      return !decision || decision.value === 'ESCALATED'
    })
    .map((r) => ({
      refCode: r.refCode,
      title: r.title,
      regulatorCode: r.regulatorCode,
      guidance: (() => {
        try {
          const formula = JSON.parse(r.deadlineFormula || '{}') as { note?: string }
          return formula.note ?? r.deadlineNote
        } catch {
          return r.deadlineNote
        }
      })(),
      relevantFacts: relevantKeys
        .filter((k) => factState.has(k))
        .map((k) => `${k} = ${factState.get(k)?.value}`),
      lastStatus: judgmentFacts.get(r.refCode)?.value ?? null,
      lastReason: judgmentFacts.get(r.refCode)?.note ?? null,
    }))

  const data: ReviewQueueData = {
    openItems,
    decisions: decisions.map((d) => ({
      id: d.id,
      refCode: d.refCode,
      decision: d.decision,
      reasoning: d.reasoning,
      decidedBy: d.decidedBy,
      decidedRole: d.decidedRole,
      decidedAt: d.decidedAt.toISOString(),
    })),
  }
  return NextResponse.json(data)
}

// ── POST /api/review-queue ───────────────────────────────────
const signOffSchema = z.object({
  refCode: z.string().trim().min(1),
  decision: z.enum(['SATISFIED', 'EXCEPTION_NOTED', 'ESCALATED']),
  reasoning: z.string().trim().min(10, 'the reasoning trail requires at least 10 characters'),
  runId: z.string().trim().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = signOffSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { refCode, decision, reasoning, runId } = parsed.data
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)
  const role = identity.roleDef

  const current = await user.obligationTemplate.findFirst({
    where: { refCode, effectiveTo: null },
  })
  if (!current) {
    return NextResponse.json({ error: `Unknown rule "${refCode}"` }, { status: 404 })
  }
  if (current.evaluationType !== 'JUDGMENT') {
    return NextResponse.json({ error: `Rule "${refCode}" is ${current.evaluationType} — only JUDGMENT rules go through the review queue` }, { status: 409 })
  }

  const [decisionRow] = await db.$transaction([
    db.reviewDecision.create({
      data: {
        tenantId: identity.tenantId,
        refCode,
        runId: runId ?? null,
        decision,
        reasoning,
        decidedBy: role.actor,
        decidedRole: role.label,
      },
    }),
    // Mirror into the fact store — the evaluator is a pure function of
    // (facts, rules, as-of), so a signed-off judgment becomes part of the
    // replayable fact state dated at the platform as-of.
    db.companyFact.create({
      data: {
        tenantId: identity.tenantId,
        type: 'FACT',
        key: `judgment.${refCode}`,
        value: decision,
        source: `Review queue sign-off (${role.label})`,
        asOf: PLATFORM_AS_OF,
        verifiedBy: role.actor,
        note: reasoning,
      },
    }),
  ])

  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'SIGN_OFF_JUDGMENT',
    resource: `/api/review-queue ${refCode}`,
    detail: `${decision} — ${reasoning.slice(0, 80)}`,
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: 'Judgment sign-off is a need-to-know legal determination, logged with reasoning and timestamp.',
  })

  return NextResponse.json({ decision: { id: decisionRow.id, refCode, decision } }, { status: 201 })
}
