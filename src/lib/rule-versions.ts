// ─────────────────────────────────────────────────────────────
// Rule versioning — the engine loads its rules from the database
// and the code holds no rule definitions.
//
// LOAD: for any as-of date, exactly ONE version per rule ID may be
// active (effectiveFrom ≤ as-of < effectiveTo, null = still current).
// Overlapping windows are a data error and fail LOUDLY — they are
// never silently resolved by "picking the latest".
//
// WRITE: edits insert a NEW version and never update a row in place.
// Uniqueness is (refCode, version); a rule's date ranges must never
// overlap; the superseded version is closed the day before the new
// one starts. sourceRef records the approval that created the version
// (change pipeline / verification queue), so every version is
// traceable to a human decision.
// ─────────────────────────────────────────────────────────────
import { Prisma, type ObligationTemplate } from '@prisma/client'

export type VersionedRuleRow = ObligationTemplate

export interface ActiveRuleSelection {
  /** One active version per rule ID, as of the given date. */
  active: VersionedRuleRow[]
  /** Overlapping effective windows — a loud data error, never skipped. */
  overlaps: { refCode: string; issue: string }[]
  /** Versions registered but not yet in force at the as-of date. */
  notYetInForce: { refCode: string; version: number; effectiveFrom: string }[]
}

/** The version active on `asOf`: effectiveFrom ≤ asOf < (effectiveTo ?? ∞). */
function isWindowActive(v: { effectiveFrom: string; effectiveTo: string | null }, asOfISO: string): boolean {
  // ISO strings (and year-level prefixes like "1994") compare correctly
  // lexicographically — honest precision, no fake dates invented.
  if (v.effectiveFrom > asOfISO) return false
  if (v.effectiveTo !== null && v.effectiveTo <= asOfISO) return false
  return true
}

/**
 * Loader: select the rules in force at the as-of date. The engine must
 * only ever see rules whose effective window covers the as-of — that is
 * what makes re-running an old verdict as of an old date reproducible.
 */
export function selectActiveRules(templates: VersionedRuleRow[], asOfISO: string): ActiveRuleSelection {
  const byRefCode = new Map<string, VersionedRuleRow[]>()
  for (const t of templates) {
    const list = byRefCode.get(t.refCode) ?? []
    list.push(t)
    byRefCode.set(t.refCode, list)
  }

  const active: VersionedRuleRow[] = []
  const overlaps: ActiveRuleSelection['overlaps'] = []
  const notYetInForce: ActiveRuleSelection['notYetInForce'] = []

  for (const [refCode, versions] of byRefCode) {
    const live = versions.filter((v) => isWindowActive({ effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo }, asOfISO))
    if (live.length === 1) {
      active.push(live[0])
    } else if (live.length > 1) {
      // Fail loudly: overlapping windows would make the verdict ambiguous.
      overlaps.push({
        refCode,
        issue: `${live.length} versions active at ${asOfISO} (v${live.map((v) => v.version).join(', v')}) — effective windows overlap; rule ignored by the run and reported as an engine gap.`,
      })
      console.error(`[rule-versions] OVERLAP for ${refCode} at ${asOfISO}: versions ${live.map((v) => v.version).join(', ')}`)
    } else {
      const future = versions.filter((v) => v.effectiveFrom > asOfISO)
      if (future.length > 0) {
        notYetInForce.push({
          refCode,
          version: Math.min(...future.map((v) => v.version)),
          effectiveFrom: future[0].effectiveFrom,
        })
      }
      // A rule whose windows have all lapsed with no successor is a data
      // error too (there should always be a current version) — report it.
      if (future.length === 0) {
        overlaps.push({
          refCode,
          issue: `no version of this rule is in force at ${asOfISO} and no successor is registered — the version chain is broken.`,
        })
        console.error(`[rule-versions] BROKEN CHAIN for ${refCode} at ${asOfISO}`)
      }
    }
  }

  return { active, overlaps, notYetInForce }
}

export type RuleClient = Prisma.TransactionClient

/** Fields an amendment may carry. Everything else is inherited from the superseded version. */
export type RulePatch = Partial<
  Pick<
    ObligationTemplate,
    | 'title'
    | 'description'
    | 'legalBasis'
    | 'legalBasisNote'
    | 'sourceTier'
    | 'lawStatus'
    | 'verification'
    | 'forms'
    | 'cadence'
    | 'deadlineRule'
    | 'deadlineNote'
    | 'applicableTo'
    | 'instrumentCode'
    | 'trigger'
    | 'applicability'
    | 'requiredEvidence'
    | 'deadlineFormula'
    | 'penaltyRef'
    | 'evaluationType'
  >
>

function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export class RuleVersionError extends Error {}

/**
 * Insert a NEW version of a rule (never updates in place). Runs inside a
 * transaction: the superseded version is closed the day before the new
 * effective-from, chronology is validated (no overlaps), and the new row
 * carries the sourceRef of the approval that created it.
 */
export async function insertRuleVersion(
  db: RuleClient,
  params: {
    tenantId: string // rows are tenant-scoped — the new version inherits custody
    refCode: string
    effectiveFrom: string // ISO date (YYYY-MM-DD)
    patch: RulePatch
    sourceRef: string // e.g. "ChangeRequest CR-… approved by …" / "RuleVerification #… confirmed by …"
  },
): Promise<ObligationTemplate> {
  const { tenantId, refCode, effectiveFrom, patch, sourceRef } = params
  if (!tenantId) {
    throw new RuleVersionError(`insertRuleVersion requires a tenantId — rule rows are tenant-scoped`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    throw new RuleVersionError(`effectiveFrom must be an ISO date (YYYY-MM-DD), got "${effectiveFrom}"`)
  }

  const versions = await db.obligationTemplate.findMany({
    where: { tenantId, refCode },
    orderBy: { version: 'desc' },
  })
  if (versions.length === 0) {
    throw new RuleVersionError(`Unknown rule ID "${refCode}" — new rules must be registered through the catalogue manifest, not improvised`)
  }

  const current = versions.find((v) => v.effectiveTo === null)
  if (!current) {
    throw new RuleVersionError(`Rule "${refCode}" has no current version — version chain is broken; refusing to append`)
  }

  // Chronology: the new from-date must sit after every existing window
  // boundary, otherwise ranges would overlap — which is forbidden.
  for (const v of versions) {
    if (v.effectiveFrom >= effectiveFrom) {
      throw new RuleVersionError(`Version overlap: rule "${refCode}" already has a version effective from ${v.effectiveFrom} (v${v.version}); a new version must start later`)
    }
    if (v.effectiveTo !== null && v.effectiveTo >= effectiveFrom) {
      throw new RuleVersionError(`Version overlap: rule "${refCode}" v${v.version} runs until ${v.effectiveTo}, which covers ${effectiveFrom}; a new version may not start inside an existing window`)
    }
  }

  const nextVersion = Math.max(...versions.map((v) => v.version)) + 1

  // Close the current window the day before the new version starts.
  await db.obligationTemplate.update({
    where: { id: current.id },
    data: { effectiveTo: dayBefore(effectiveFrom) },
  })

  return db.obligationTemplate.create({
    data: {
      tenantId,
      refCode,
      version: nextVersion,
      effectiveFrom,
      effectiveTo: null,
      sourceRef,
      // inherit everything from the superseded version, then apply the patch
      regulatorCode: current.regulatorCode,
      module: current.module,
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      legalBasis: patch.legalBasis ?? current.legalBasis,
      legalBasisNote: patch.legalBasisNote ?? current.legalBasisNote,
      sourceTier: patch.sourceTier ?? current.sourceTier,
      lawStatus: patch.lawStatus ?? current.lawStatus,
      verification: patch.verification ?? current.verification,
      forms: patch.forms ?? current.forms,
      cadence: patch.cadence ?? current.cadence,
      deadlineRule: patch.deadlineRule ?? current.deadlineRule,
      deadlineNote: patch.deadlineNote ?? current.deadlineNote,
      applicableTo: patch.applicableTo ?? current.applicableTo,
      instrumentCode: patch.instrumentCode ?? current.instrumentCode,
      trigger: patch.trigger ?? current.trigger,
      applicability: patch.applicability ?? current.applicability,
      requiredEvidence: patch.requiredEvidence ?? current.requiredEvidence,
      deadlineFormula: patch.deadlineFormula ?? current.deadlineFormula,
      penaltyRef: patch.penaltyRef ?? current.penaltyRef,
      evaluationType: patch.evaluationType ?? current.evaluationType,
    },
  })
}
