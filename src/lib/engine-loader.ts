// ─────────────────────────────────────────────────────────────
// Engine loader — the ONLY bridge between the database and the
// pure evaluator. The engine loads its rules from the database;
// the code holds no rule definitions.
// ─────────────────────────────────────────────────────────────
import type { ObligationTemplate } from '@prisma/client'
import { db } from '@/lib/db'
import { evaluateCompliance, type EngineFact, type EngineInstrument, type EngineRule, type EngineReport } from '@/lib/evaluator'
import type { ApplicabilityPredicate } from '@/lib/catalogue'

/** Map a versioned rule row onto the evaluator's rule shape. */
export function toEngineRule(t: ObligationTemplate): EngineRule {
  return {
    refCode: t.refCode,
    title: t.title,
    regulatorCode: t.regulatorCode,
    module: t.module,
    legalBasis: t.legalBasis,
    deadlineRule: t.deadlineRule,
    deadlineNote: t.deadlineNote,
    verification: t.verification,
    instrumentCode: t.instrumentCode,
    trigger: t.trigger,
    evaluationType: t.evaluationType,
    applicability: JSON.parse(t.applicability || '{}') as ApplicabilityPredicate,
    requiredEvidence: JSON.parse(t.requiredEvidence || '[]') as string[],
    deadlineFormula: JSON.parse(t.deadlineFormula || '{}'),
    penaltyRef: t.penaltyRef,
    version: t.version,
    effectiveFrom: t.effectiveFrom,
    effectiveTo: t.effectiveTo,
    sourceRef: t.sourceRef,
  }
}

export async function loadInstruments(): Promise<EngineInstrument[]> {
  const rows = await db.legalInstrument.findMany({ include: { versions: { orderBy: { versionNo: 'asc' } } } })
  return rows.map((i) => ({
    code: i.code,
    title: i.title,
    issuingBody: i.issuingBody,
    referenceType: i.referenceType,
    reference: i.reference,
    sourceUrl: i.sourceUrl,
    verification: i.verification,
    verifiedBy: i.verifiedBy,
    note: i.note,
    versions: i.versions.map((v) => ({
      versionNo: v.versionNo,
      label: v.label,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      changeNote: v.changeNote,
      status: v.status,
      verification: v.verification,
    })),
  }))
}

export async function loadFacts(tenantId: string): Promise<EngineFact[]> {
  if (!tenantId) throw new Error('[engine-loader] loadFacts requires a tenantId — facts are tenant-scoped')
  const rows = await db.companyFact.findMany({ where: { tenantId }, orderBy: { asOf: 'asc' } })
  return rows.map((f) => ({
    type: f.type as 'FACT' | 'OVERRIDE',
    key: f.key,
    value: f.value,
    scopeRefCode: f.scopeRefCode,
    source: f.source,
    asOf: f.asOf,
    verifiedBy: f.verifiedBy,
    note: f.note,
  }))
}

/** Run the pure evaluator over a given set of rule rows (used for impact reports: same facts, rules swapped). */
export function evaluateWithRows(
  rows: ObligationTemplate[],
  instruments: EngineInstrument[],
  facts: EngineFact[],
  asOfISO: string,
): EngineReport {
  return evaluateCompliance(rows.map(toEngineRule), instruments, facts, asOfISO)
}
