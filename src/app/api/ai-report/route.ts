import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'
import { severityOf } from '@/lib/evaluator'
import type { EngineFinding, EngineSummary } from '@/lib/evaluator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// LLM calls can take several seconds — allow up to a minute.
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// AI compliance report — the LLM is the NARRATOR, never the judge.
//
// The legal conclusions come from the deterministic engine (dates in,
// verdicts out). This route feeds the PERSISTED run to the language
// model with a strict contract: organise, explain and format the
// engine output — never re-decide, re-score or re-date anything.
// The engine summary travels with the report so any drift between
// narrative and machine verdict is immediately visible.
//
// PROVIDER: z-ai-web-dev-sdk — bundled with this project (no external
// API key, no billing = free tier). The narrative function is isolated
// below; for a self-hosted deployment the same function can call any
// provider without touching the compliance logic.
// ─────────────────────────────────────────────────────────────

const bodySchema = z.object({
  runId: z.string().min(1),
})

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[]
}

/** Compact the finding to what a board report needs — keeps the prompt small. */
function compactFinding(f: EngineFinding) {
  return {
    refCode: f.refCode,
    rule: f.title,
    regulator: f.regulatorCode,
    type: f.evaluationType,
    status: f.status,
    severity: severityOf(f.status as EngineFinding['status']),
    due: f.dueDate,
    evidenceMissing: f.evidenceState.filter((e) => !e.present).map((e) => e.item),
    ruleVerification: f.ruleVerification,
    penalty: f.penaltyRef,
    reason: f.reason.length > 260 ? `${f.reason.slice(0, 257)}…` : f.reason,
  }
}

function buildUserPayload(run: {
  asOf: string
  summary: EngineSummary
  findings: EngineFinding[]
  companyName: string
}): string {
  const atRisk = run.findings.filter((f) => f.severity === 'BLACK' || f.severity === 'RED' || f.severity === 'AMBER')
  const rest = run.findings.filter((f) => f.severity !== 'BLACK' && f.severity !== 'RED' && f.severity !== 'AMBER')
  return [
    `Company: ${run.companyName}`,
    `Compliance run as-of date: ${run.asOf}`,
    '',
    'ENGINE SUMMARY (authoritative — do not alter):',
    JSON.stringify(run.summary, null, 1),
    '',
    `FINDINGS (${run.findings.length} applicable rules; at-risk first, then the rest):`,
    JSON.stringify([...atRisk, ...rest].map(compactFinding), null, 1),
  ].join('\n')
}

function buildSystemPrompt(): string {
  return [
    'You write the compliance report of a regulated listed company in Bangladesh for its board and auditors.',
    '',
    'ABSOLUTE CONTRACT:',
    '1. You are the NARRATOR of a deterministic compliance engine. You NEVER decide compliance.',
    '2. Do NOT invent, alter, upgrade, downgrade or re-date any status, severity, due date or count.',
    '3. Every claim you make must be traceable to the JSON provided. If data is absent, say "not stated in the engine run".',
    '4. UNVERIFIED rule rows and JUDGMENT items must be presented as pending human verification / sign-off — never as confirmed compliant or confirmed breach.',
    '5. The aggregate rating is a WORST-SEVERITY floor: one BLACK finding makes the company rating BLACK even if everything else is green. Never average severity away.',
    '',
    'OUTPUT — markdown, exactly these sections:',
    '# Compliance Report — <company> (as-of <date>)',
    '## Executive summary  (3-5 sentences: rating, worst findings, what needs action now)',
    '## Key exposures  (ordered worst severity first; each: rule ID, status, due date, penalty provision, one-line what/why)',
    '## Immediate actions  (numbered, concrete, each tied to a rule ID)',
    '## Pending human judgement  (JUDGMENT items awaiting sign-off + UNVERIFIED deadline rows)',
    '## Statement of method  (2-3 sentences: this report narrates a deterministic engine run over versioned rules and dated facts; the machine JSON is authoritative; the AI text adds no legal conclusions)',
    '',
    'Tone: precise, factual, board-ready. No pleasantries, no speculation, no legal advice beyond what the engine output states.',
  ].join('\n')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const role = identity.roleDef

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 })
  }

  const user = tenantDb(identity.tenantId)
  const run = await user.complianceRun.findUnique({
    where: { id: parsed.data.runId },
    include: { findings: true },
  })
  if (!run) {
    return NextResponse.json({ error: 'Compliance run not found — run the engine first' }, { status: 404 })
  }

  const [profileRow, persistedDecisions] = await Promise.all([
    user.companyProfile.findFirst(),
    user.reviewDecision.findMany({ orderBy: { decidedAt: 'desc' }, take: 20 }),
  ])

  const summary = JSON.parse(run.summary) as EngineSummary
  const findings: EngineFinding[] = run.findings.map((f) => ({
    refCode: f.refCode,
    title: f.title,
    regulatorCode: f.regulatorCode,
    module: '',
    evaluationType: f.evaluationType,
    trigger: f.trigger,
    status: f.status as EngineFinding['status'],
    severity: severityOf(f.status as EngineFinding['status']),
    dueDate: f.dueDate,
    gateTrace: [],
    reason: f.reason,
    requiredEvidence: [],
    evidenceState: [],
    deadlineFormula: null,
    deadlineRule: '',
    penaltyRef: null,
    ruleVerification: f.ruleVerification,
    instrumentCode: f.instrumentCode,
    ruleVersion: f.ruleVersion,
    ruleEffectiveFrom: '',
    ruleSourceRef: null,
  }))

  // Sign-offs that exist on record — the narrator must reflect them.
  const signOffs = persistedDecisions.map((d) => ({
    refCode: d.refCode,
    decision: d.decision,
    by: `${d.decidedBy} (${d.decidedRole})`,
    at: d.decidedAt.toISOString(),
  }))

  const companyName = profileRow?.name ?? 'the company'
  let userContent = buildUserPayload({ asOf: run.asOf, summary, findings, companyName })
  if (signOffs.length > 0) {
    userContent += `\n\nREVIEW SIGN-OFFS ON RECORD: ${JSON.stringify(signOffs)}`
  }

  // Access log — the report bundles deadline computations and exposure
  // detail for a listed company: log who generated what, when.
  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'GENERATE_AI_REPORT',
    resource: `/api/ai-report/${run.id.slice(-8)}`,
    detail: `narrative over ${findings.length} findings · rating ${summary.rating}`,
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: role.rationale,
  })

  try {
    const zai = await ZAI.create()
    const completion = (await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: buildSystemPrompt() },
        { role: 'user', content: userContent },
      ],
      thinking: { type: 'disabled' },
    })) as unknown as ChatCompletionResponse

    const narrative = completion.choices?.[0]?.message?.content?.trim() ?? ''
    if (!narrative) {
      return NextResponse.json({ error: 'AI provider returned an empty narrative' }, { status: 502 })
    }

    return NextResponse.json({
      runId: run.id,
      asOf: run.asOf,
      company: companyName,
      narrative,
      // The authoritative machine verdict travels with the report so any
      // drift between narrative and engine output is immediately visible.
      engineVerdict: {
        rating: summary.rating,
        breaches: summary.breachCount,
        applicable: summary.applicable,
        engineHealthy: summary.engineHealthy,
      },
      signOffs,
      generatedBy: 'z-ai-web-dev-sdk (bundled LLM — no external API key required)',
      contract: 'AI narrates the engine output only — it never re-decides compliance.',
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ai-report] generation failed', error)
    return NextResponse.json(
      { error: 'AI report generation failed', detail: error instanceof Error ? error.message : 'unknown' },
      { status: 502 },
    )
  }
}
