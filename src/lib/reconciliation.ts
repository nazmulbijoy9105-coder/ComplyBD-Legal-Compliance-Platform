// ─────────────────────────────────────────────────────────────
// Catalogue reconciliation engine — proves that the three layers
// agree on every statutory rule ID and its definition:
//
//   seed      → src/lib/catalogue.ts (canonical manifest)
//   database  → Regulator / ObligationTemplate live rows
//   engine    → joins used by /api/regulators + /api/calendar
//               (obligation.refCode / templateId / regulatorCode)
//
// Rule ID  = ObligationTemplate.refCode (seed ↔ database key)
// Definition = FULL rule definition: catalogue base fields + the whole
//              rule layer (instrument citation, trigger, applicability
//              predicate, required evidence, deadline formula, penalty
//              reference, evaluation type)
//
// VERSIONING: the manifest defines the BASELINE (version 1) definition.
// Later versions are legitimate amendments ONLY when they trace to an
// approval (sourceRef — change pipeline / verification queue). A rule
// with an explained amendment chain reports AMENDED, not drift. A
// version with no sourceRef is unexplained and breaks the integrity
// story (UNVERIFIED).
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db'
import { tenantDb } from '@/lib/tenant-db'
import {
  CATALOGUE_REGULATORS,
  CATALOGUE_TEMPLATES,
  CATALOGUE_VERSION,
  definitionDrift,
  FULL_RULE_DEFINITION_FIELDS,
  REGULATOR_DEFINITION_FIELDS,
  resolveRule,
} from '@/lib/catalogue'
import type {
  EngineJoinIssue,
  ReconciliationReport,
  RegulatorReconciliation,
  RuleReconciliation,
} from '@/lib/types'

export async function reconcileCatalogue(tenantId: string): Promise<ReconciliationReport> {
  if (!tenantId) throw new Error('[reconciliation] tenantId required — catalogue comparison is tenant-scoped')
  const [dbRegulators, dbTemplates, obligations] = await Promise.all([
    db.regulator.findMany({ orderBy: { sortOrder: 'asc' } }),
    tenantDb(tenantId).obligationTemplate.findMany({ orderBy: [{ refCode: 'asc' }, { version: 'asc' }] }),
    tenantDb(tenantId).obligation.findMany({
      select: { id: true, title: true, refCode: true, templateId: true, regulatorCode: true },
    }),
  ])

  // ── Layer 1 ↔ 2: seed manifest ↔ database catalogue, by rule ID ──
  const seedById = new Map(CATALOGUE_TEMPLATES.map((t) => [t.refCode, t]))
  // The manifest compares against the BASELINE (version 1) row — later
  // versions are amendments, not drift, when they carry a sourceRef.
  const baselineByRefCode = new Map<string, (typeof dbTemplates)[number]>()
  const chainByRefCode = new Map<string, (typeof dbTemplates)[number][]>()
  for (const t of dbTemplates) {
    const chain = chainByRefCode.get(t.refCode) ?? []
    chain.push(t)
    chainByRefCode.set(t.refCode, chain)
    if (t.version === 1) baselineByRefCode.set(t.refCode, t)
  }

  const ruleIds = [...new Set([...seedById.keys(), ...chainByRefCode.keys()])].sort()

  const rules: RuleReconciliation[] = ruleIds.map((refCode) => {
    const s = seedById.get(refCode)
    const baseline = baselineByRefCode.get(refCode)
    const chain = chainByRefCode.get(refCode) ?? []
    const current = chain.length > 0 ? chain[chain.length - 1] : undefined

    let definitionMatch: boolean | null = null
    let driftedFields: string[] = []
    if (s && baseline) {
      // Full definition = base catalogue row + rule layer (trigger,
      // applicability, evidence, deadline formula, penalty, evaluation type).
      driftedFields = definitionDrift(resolveRule(refCode), baseline, FULL_RULE_DEFINITION_FIELDS)
      definitionMatch = driftedFields.length === 0
    }

    // Amendment chain: every version above the baseline must trace to an
    // approval (sourceRef). Unexplained versions are a loud integrity breach.
    const amendmentChain = chain
      .filter((t) => t.version > 1)
      .map((t) => ({ version: t.version, effectiveFrom: t.effectiveFrom, effectiveTo: t.effectiveTo, sourceRef: t.sourceRef }))
    const unexplainedVersions = amendmentChain.filter((a) => !a.sourceRef).map((a) => a.version)

    const linkedObligations = obligations.filter(
      (o) => o.refCode === refCode || (current !== undefined && o.templateId === current.id) || chain.some((t) => o.templateId === t.id),
    ).length

    let status: RuleReconciliation['status']
    if (s && chain.length === 0) status = 'MISSING_IN_DATABASE'
    else if (!s && chain.length > 0) status = 'ORPHAN_IN_DATABASE'
    else if (unexplainedVersions.length > 0) status = 'DEFINITION_DRIFT'
    else if (amendmentChain.length > 0) status = 'AMENDED'
    else if (definitionMatch) status = 'MATCHED'
    else status = 'DEFINITION_DRIFT'

    const source = current ?? s
    return {
      refCode,
      title: source?.title ?? refCode,
      verification: source?.verification ?? 'UNVERIFIED',
      inSeed: Boolean(s),
      inDatabase: chain.length > 0,
      definitionMatch,
      driftedFields,
      linkedObligations,
      status,
      currentVersion: current?.version ?? null,
      amendmentChain,
      unexplainedVersions,
    }
  })

  // Regulator catalogue — same model, keyed by code.
  const seedRegByCode = new Map(CATALOGUE_REGULATORS.map((r) => [r.code, r]))
  const dbRegByCode = new Map(dbRegulators.map((r) => [r.code, r]))
  const regulatorCodes = [...new Set([...seedRegByCode.keys(), ...dbRegByCode.keys()])].sort()

  const regulators: RegulatorReconciliation[] = regulatorCodes.map((code) => {
    const s = seedRegByCode.get(code)
    const d = dbRegByCode.get(code)
    let definitionMatch: boolean | null = null
    let driftedFields: string[] = []
    if (s && d) {
      driftedFields = definitionDrift(s, d, REGULATOR_DEFINITION_FIELDS)
      definitionMatch = driftedFields.length === 0
    }
    let status: RegulatorReconciliation['status']
    if (s && !d) status = 'MISSING_IN_DATABASE'
    else if (!s && d) status = 'ORPHAN_IN_DATABASE'
    else if (definitionMatch) status = 'MATCHED'
    else status = 'DEFINITION_DRIFT'
    return {
      code,
      fullName: (d ?? s)?.fullName ?? code,
      inSeed: Boolean(s),
      inDatabase: Boolean(d),
      definitionMatch,
      driftedFields,
      status,
    }
  })

  // ── Layer 3: engine join integrity (obligations → catalogue rules) ──
  const engineIssues: EngineJoinIssue[] = []
  let joinChecks = 0

  for (const o of obligations) {
    // Custom rows (no refCode / no template) are a legitimate part of the
    // platform — they are unverified by definition, not a join failure.
    if (!o.refCode) continue

    // refCode must resolve to a catalogue rule.
    joinChecks += 1
    if (!seedById.has(o.refCode)) {
      engineIssues.push({
        obligationId: o.id,
        obligationTitle: o.title,
        refCode: o.refCode,
        issue: `Rule ID "${o.refCode}" not found in the canonical catalogue (orphan engine copy).`,
      })
    }

    // templateId must resolve to a version of the rule carrying the same
    // refCode — this is the exact join /api/regulators and /api/calendar rely on.
    if (o.templateId) {
      joinChecks += 1
      const joined = dbTemplates.find((t) => t.id === o.templateId)
      if (!joined) {
        engineIssues.push({
          obligationId: o.id,
          obligationTitle: o.title,
          refCode: o.refCode,
          issue: 'templateId does not resolve to any ObligationTemplate row (dangling join).',
        })
      } else if (joined.refCode !== o.refCode) {
        engineIssues.push({
          obligationId: o.id,
          obligationTitle: o.title,
          refCode: o.refCode,
          issue: `templateId points to rule "${joined.refCode}" — mismatch with row refCode "${o.refCode}".`,
        })
      }
    }

    // Instance regulatorCode must resolve to a catalogue regulator.
    joinChecks += 1
    if (!seedRegByCode.has(o.regulatorCode)) {
      engineIssues.push({
        obligationId: o.id,
        obligationTitle: o.title,
        refCode: o.refCode,
        issue: `Regulator code "${o.regulatorCode}" not present in the catalogue.`,
      })
    }
  }

  // Every template's regulatorCode must resolve in both layers.
  for (const t of dbTemplates) {
    if (!dbRegByCode.has(t.regulatorCode) || !seedRegByCode.has(t.regulatorCode)) {
      engineIssues.push({
        obligationId: '',
        obligationTitle: `Rule ${t.refCode} v${t.version}`,
        refCode: t.refCode,
        issue: `regulatorCode "${t.regulatorCode}" does not resolve to a catalogue regulator.`,
      })
    }
  }

  const matchedRules = rules.filter((r) => r.status === 'MATCHED').length
  const amendedRules = rules.filter((r) => r.status === 'AMENDED').length
  const driftedRules = rules.filter((r) => r.status === 'DEFINITION_DRIFT').length
  const missingInDatabase = rules.filter((r) => r.status === 'MISSING_IN_DATABASE').length
  const orphanInDatabase = rules.filter((r) => r.status === 'ORPHAN_IN_DATABASE').length
  const matchedRegulators = regulators.filter((r) => r.status === 'MATCHED').length
  const driftedRegulators = regulators.filter((r) => r.status !== 'MATCHED').length

  const totalIssues =
    driftedRules + missingInDatabase + orphanInDatabase + driftedRegulators + engineIssues.length

  return {
    ok: totalIssues === 0,
    verification: totalIssues === 0 ? 'VERIFIED' : 'UNVERIFIED',
    checkedAt: new Date().toISOString(),
    catalogueVersion: CATALOGUE_VERSION,
    layers: {
      seed: { regulators: CATALOGUE_REGULATORS.length, rules: CATALOGUE_TEMPLATES.length },
      database: {
        regulators: dbRegulators.length,
        rules: dbTemplates.length,
        obligations: obligations.length,
      },
      engine: { joinChecks, brokenJoins: engineIssues.length },
    },
    summary: {
      matchedRules,
      amendedRules,
      driftedRules,
      missingInDatabase,
      orphanInDatabase,
      matchedRegulators,
      driftedRegulators,
      brokenJoins: engineIssues.length,
      totalIssues,
    },
    rules,
    regulators,
    engineIssues,
  }
}
