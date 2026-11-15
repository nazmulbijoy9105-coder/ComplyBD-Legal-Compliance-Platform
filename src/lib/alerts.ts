// ─────────────────────────────────────────────────────────────
// Engine-health alerting — the engine must never go stale silently.
// A stale GREEN is the worst failure mode: an unverified rule or an
// unresolved circular sitting in the register while the dashboard
// looks fine. Every compliance run sweeps three conditions:
//
//   ENGINE_GAP            — a rule row the engine cannot evaluate
//   RULE_UNVERIFIED_STALE — a rule in force but not instrument-verified
//                           for longer than STALE_RULE_DAYS (default 30)
//   CHANGE_PENDING        — a circular sitting in the pipeline longer
//                           than PENDING_CHANGE_DAYS (default 7)
//
// Alerts dedupe per (type, refCode) while OPEN, carry a severity,
// resolve automatically when the condition clears, and notify an
// optional webhook (ALERT_WEBHOOK_URL — Slack/Discord/generic JSON)
// exactly once per OPEN alert. A failed webhook is logged to stderr,
// never swallowed.
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db'
import type { ObligationTemplate } from '@prisma/client'

export type AlertType = 'ENGINE_GAP' | 'RULE_UNVERIFIED_STALE' | 'CHANGE_PENDING'

const STALE_RULE_DAYS = Number(process.env.ALERT_STALE_RULE_DAYS ?? 30)
const PENDING_CHANGE_DAYS = Number(process.env.ALERT_PENDING_CHANGE_DAYS ?? 7)

interface DesiredAlert {
  type: AlertType
  refCode: string
  severity: 'INFO' | 'WARN' | 'CRITICAL'
  message: string
}

async function dispatchWebhook(tenantId: string, alert: { type: string; refCode: string; severity: string; message: string }): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `ComplyBD ${alert.severity} — ${alert.type}${alert.refCode ? ` (${alert.refCode})` : ''}: ${alert.message}`,
        tenantId,
        type: alert.type,
        refCode: alert.refCode,
        severity: alert.severity,
        message: alert.message,
        at: new Date().toISOString(),
      }),
    })
    if (!res.ok) throw new Error(`webhook responded HTTP ${res.status}`)
  } catch (error) {
    // Never swallow: a silent alerting failure is a stale alert in the wild.
    console.error('[alerts] webhook dispatch FAILED', alert.type, alert.refCode, error)
  }
}

export async function sweepEngineAlerts(
  tenantId: string,
  input: {
    asOf: string
    runId: string
    findings: { refCode: string; status: string; title: string }[]
    rulesInForce: ObligationTemplate[]
    changeRequests: { id: string; refCode: string; title: string; issuer: string; reference: string; status: string; createdAt: Date }[]
  },
): Promise<void> {
  const desired: DesiredAlert[] = []

  // 1. ENGINE_GAP — loud by design; the alert makes it leave the process log.
  for (const f of input.findings) {
    if (f.status === 'ENGINE_GAP') {
      desired.push({
        type: 'ENGINE_GAP',
        refCode: f.refCode,
        severity: 'CRITICAL',
        message: `The engine cannot evaluate "${f.title}" (${f.refCode}) — no matching evaluation function. The rule is excluded from no report and the run rating is floored.`,
      })
    }
  }

  // 2. RULE_UNVERIFIED_STALE — in force but never instrument-verified.
  const staleCutoff = Date.now() - STALE_RULE_DAYS * 86_400_000
  for (const rule of input.rulesInForce) {
    if (rule.verification !== 'VERIFIED' && rule.effectiveFrom && Date.parse(`${rule.effectiveFrom.slice(0, 10)}T00:00:00Z`) < staleCutoff) {
      desired.push({
        type: 'RULE_UNVERIFIED_STALE',
        refCode: rule.refCode,
        severity: 'WARN',
        message: `"${rule.title}" (${rule.refCode} v${rule.version}) has been in force unverified for over ${STALE_RULE_DAYS} days — confirm its deadline/penalty against the instrument in the verification queue.`,
      })
    }
  }

  // 3. CHANGE_PENDING — a circular waiting on a human decision.
  for (const cr of input.changeRequests) {
    if ((cr.status === 'RECEIVED' || cr.status === 'UNDER_REVIEW') && cr.createdAt.getTime() < Date.now() - PENDING_CHANGE_DAYS * 86_400_000) {
      desired.push({
        type: 'CHANGE_PENDING',
        refCode: cr.id,
        severity: 'WARN',
        message: `Circular ${cr.reference} (${cr.issuer}) targeting ${cr.refCode} has been pending decision for over ${PENDING_CHANGE_DAYS} days — approving late risks a stale rule register.`,
      })
    }
  }

  const now = new Date()
  const open = await db.engineAlert.findMany({ where: { tenantId, status: 'OPEN' } })
  const openKey = (a: { type: string; refCode: string | null }) => `${a.type}::${a.refCode ?? ''}`
  const openByKey = new Map(open.map((a) => [openKey(a), a]))
  const desiredKeys = new Set(desired.map((d) => openKey(d)))

  // Raise / refresh
  for (const d of desired) {
    const existing = openByKey.get(openKey(d))
    if (existing) {
      if (existing.lastSeenAt < now) {
        await db.engineAlert.update({ where: { id: existing.id }, data: { lastSeenAt: now } })
      }
      continue
    }
    const created = await db.engineAlert.create({
      data: {
        tenantId,
        type: d.type,
        refCode: d.refCode,
        severity: d.severity,
        message: d.message,
        status: 'OPEN',
        notifiedAt: null,
      },
    })
    await dispatchWebhook(tenantId, { type: d.type, refCode: d.refCode, severity: d.severity, message: d.message })
    await db.engineAlert.update({ where: { id: created.id }, data: { notifiedAt: new Date() } })
    console.warn(`[alerts] RAISED ${d.severity} ${d.type} ${d.refCode}: ${d.message.slice(0, 120)}`)
  }

  // Resolve conditions that cleared this run
  for (const a of open) {
    if (!desiredKeys.has(openKey(a))) {
      await db.engineAlert.update({
        where: { id: a.id },
        data: { status: 'RESOLVED', resolvedAt: now, lastSeenAt: now },
      })
      console.log(`[alerts] RESOLVED ${a.type} ${a.refCode ?? ''} — condition cleared at as-of ${input.asOf}`)
    }
  }
}
