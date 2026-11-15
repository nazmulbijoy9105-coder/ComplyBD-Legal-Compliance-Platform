import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { insertRuleVersion, RuleVersionError } from '@/lib/rule-versions'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'
import { PLATFORM_AS_OF } from '@/lib/platform'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/rules ───────────────────────────────────────────
// The full version chain for every rule ID. Versions are immutable:
// an amendment appends a version and never edits the old one, so any
// past verdict can be re-run as of an old date and reproduce itself.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const rows = await user.obligationTemplate.findMany({
    orderBy: [{ refCode: 'asc' }, { version: 'asc' }],
  })

  const rules = new Map<string, unknown[]>()
  for (const r of rows) {
    const list = rules.get(r.refCode) ?? []
    list.push({
      refCode: r.refCode,
      version: r.version,
      title: r.title,
      evaluationType: r.evaluationType,
      verification: r.verification,
      deadlineRule: r.deadlineRule,
      deadlineNote: r.deadlineNote,
      legalBasis: r.legalBasis,
      instrumentCode: r.instrumentCode,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      sourceRef: r.sourceRef,
      current: r.effectiveTo === null,
    })
    rules.set(r.refCode, list)
  }

  return NextResponse.json({
    asOf: PLATFORM_AS_OF,
    rules: Object.fromEntries(rules),
    totalVersions: rows.length,
    ruleIds: [...rules.keys()].sort(),
  })
}

// ── POST /api/rules ──────────────────────────────────────────
// Edits NEVER update a row in place: a POST inserts a NEW version with
// an effective-from date, closes the superseded version the day before,
// and refuses overlapping windows. Uniqueness is (refCode, version).
const patchSchema = z.object({
  refCode: z.string().trim().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD'),
  note: z.string().trim().min(1, 'a change note is required'),
  // optional rule-layer patch — everything absent is inherited from the superseded version
  title: z.string().trim().min(1).optional(),
  legalBasis: z.string().trim().min(1).optional(),
  legalBasisNote: z.string().trim().optional(),
  deadlineRule: z.string().trim().min(1).optional(),
  deadlineNote: z.string().trim().optional(),
  deadlineFormula: z.record(z.string(), z.unknown()).optional(),
  applicability: z.record(z.string(), z.unknown()).optional(),
  requiredEvidence: z.array(z.string()).optional(),
  penaltyRef: z.string().trim().optional(),
  evaluationType: z.enum(['DETERMINISTIC', 'DOCUMENTARY', 'JUDGMENT']).optional(),
  trigger: z.enum(['CALENDAR', 'EVENT', 'STATE']).optional(),
  verification: z.enum(['VERIFIED', 'PARTIAL', 'UNVERIFIED', 'PENDING']).optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
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
  const data = parsed.data
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const role = identity.roleDef

  const patch: Record<string, string> = {}
  for (const key of ['title', 'legalBasis', 'legalBasisNote', 'deadlineRule', 'deadlineNote', 'penaltyRef', 'evaluationType', 'trigger', 'verification'] as const) {
    const value = data[key]
    if (value !== undefined) patch[key] = value
  }
  if (data.deadlineFormula) patch.deadlineFormula = JSON.stringify(data.deadlineFormula)
  if (data.applicability) patch.applicability = JSON.stringify(data.applicability)
  if (data.requiredEvidence) patch.requiredEvidence = JSON.stringify(data.requiredEvidence)

  try {
    const created = await db.$transaction((tx) =>
      insertRuleVersion(tx, {
        tenantId: identity.tenantId,
        refCode: data.refCode,
        effectiveFrom: data.effectiveFrom,
        patch,
        sourceRef: `Manual amendment via /api/rules — "${data.note}" approved by ${role.actor} (${role.id})`,
      }),
    )
    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'CREATE_RULE_VERSION',
      resource: `/api/rules ${data.refCode}`,
      detail: `v${created.version} effective ${created.effectiveFrom}`,
      classification: 'INTERNAL',
      outcome: 'ALLOWED',
      reason: 'Rule amendments require an accountable approver; recorded in the version chain.',
    })
    return NextResponse.json({ rule: created }, { status: 201 })
  } catch (error) {
    if (error instanceof RuleVersionError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[api/rules] failed to insert version', error)
    return NextResponse.json({ error: 'Failed to insert rule version' }, { status: 500 })
  }
}
