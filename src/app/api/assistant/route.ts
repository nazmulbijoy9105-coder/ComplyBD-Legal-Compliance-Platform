import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'
import { logAccess } from '@/lib/access-control'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// LLM calls can take several seconds — allow up to a minute.
export const maxDuration = 60

const MAX_HISTORY = 12

interface KnowledgeRow {
  refCode: string
  regulatorCode: string
  title: string
  cadence: string
  deadlineRule: string
  deadlineNote: string | null
  verification: string
  legalBasis: string
}

interface OpenObligationRow {
  title: string
  regulatorCode: string
  dueDate: string
  status: string
  priority: string
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[]
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1, 'messages must not be empty'),
})

function buildSystemPrompt(tenantId: string): Promise<string> {
  return (async () => {
    const user = tenantDb(tenantId)
    const [templates, openObligations] = await Promise.all([
      user.obligationTemplate.findMany({ orderBy: { refCode: 'asc' } }),
      user.obligation.findMany({
        where: { status: { not: 'FILED' } },
        orderBy: { dueDate: 'asc' },
        select: {
          title: true,
          regulatorCode: true,
          dueDate: true,
          status: true,
          priority: true,
        },
      }),
    ])

    const knowledge: KnowledgeRow[] = templates.map((t) => ({
      refCode: t.refCode,
      regulatorCode: t.regulatorCode,
      title: t.title,
      cadence: t.cadence,
      deadlineRule: t.deadlineRule,
      deadlineNote: t.deadlineNote,
      verification: t.verification,
      legalBasis: t.legalBasis,
    }))

    const snapshot: OpenObligationRow[] = openObligations.map((o) => ({
      title: o.title,
      regulatorCode: o.regulatorCode,
      dueDate: o.dueDate.toISOString(),
      status: o.status,
      priority: o.priority,
    }))

    return [
      'You are the AI compliance-officer assistant of a Legal Compliance Platform for Bangladesh PUBLIC LIMITED LISTED companies (listed on DSE/CSE).',
      '',
      'CLIENT CONTEXT: You assist the compliance team of the demo company "Padma Textiles & Apparels Ltd." — a listed textile manufacturer. Its fiscal year ends 30 June.',
      '',
      'COMPACT REGULATORY KNOWLEDGE — obligation-template register (every row carries its verification status):',
      JSON.stringify(knowledge),
      '',
      'CURRENT OPEN OBLIGATIONS SNAPSHOT for Padma Textiles & Apparels Ltd. (non-FILED, ordered by due date):',
      JSON.stringify(snapshot),
      '',
      'OPERATING RULES (follow all of them):',
      '1. ALWAYS cite the legal basis (instrument + section) when discussing a filing, deadline or penalty.',
      '2. Quote each register row\'s verification status (VERIFIED / PARTIAL / UNVERIFIED / PENDING) when citing it — the same caveats as the Regulatory Map. Any row NOT marked VERIFIED, or any deadline containing \'??\', MUST be flagged as requiring primary-source confirmation. Treat ALL rows (including VERIFIED) as reference data: remind the user to confirm against the primary sources (bdlaws.minlaw.gov.bd, rjsc.gov.bd, bsec.gov.bd, nbr.gov.bd, bb.org.bd) before reliance.',
      '3. NEVER invent statutory deadlines. If a deadline is not in the register or you are not certain, say so and point to the governing instrument instead of guessing a date.',
      '4. Bangladesh Bank FE-2 / FE-4 returns apply ONLY to banks. Padma Textiles & Apparels Ltd. is a NON-BANK listed company — FE-2/FE-4 and other banking-company returns are OUT OF SCOPE for it.',
      '5. The PDPA 2026 s.20 breach-notification time limit is "as prescribed" by subordinate rules — the 72-hour figure is a GDPR concept, NOT a Bangladesh statutory limit. Never state 72 hours as Bangladesh law.',
      '6. Be concise. Use clean markdown structure (short headings, bullets) for answers.',
      '7. End critical answers (deadlines, filings, penalties, legal interpretation) with a one-line verification reminder pointing to the relevant primary source.',
      '8. You are not a law firm and your output is not legal advice — state this when giving substantive compliance conclusions.',
    ].join('\n')
  })()
}

// ── POST /api/assistant ──────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Keep only the most recent turn history.
  const history = parsed.data.messages.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // The assistant is grounded in the obligation register (INTERNAL: open
  // filings, due dates, regulator scoping) — every query is access-logged.
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const role = identity.roleDef
  await logAccess({
    tenantId: identity.tenantId,
    actor: identity.actor,
    role: role.id,
    action: 'QUERY_ASSISTANT',
    resource: '/api/assistant',
    detail: parsed.data.messages[parsed.data.messages.length - 1]?.content.slice(0, 120) ?? '',
    classification: 'INTERNAL',
    outcome: 'ALLOWED',
    reason: role.rationale,
  })

  try {
    const systemPrompt = await buildSystemPrompt(identity.tenantId)
    const messages: { role: 'assistant' | 'user'; content: string }[] = [
      { role: 'assistant', content: systemPrompt },
      ...history,
    ]

    const zai = await ZAI.create()
    const completion = (await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })) as ChatCompletionResponse

    const reply = completion.choices?.[0]?.message?.content ?? null
    if (!reply) {
      return NextResponse.json(
        { error: 'Assistant returned an empty response' },
        { status: 500 },
      )
    }

    return NextResponse.json({ reply })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assistant request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
