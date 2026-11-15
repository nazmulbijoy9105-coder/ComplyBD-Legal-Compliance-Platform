// ─────────────────────────────────────────────────────────────
// Compliance evaluator — a PURE function of (facts, rules, as-of).
//
// No database access happens in this file. Everything comes in as
// plain data and every finding can be replayed exactly by re-running
// with the same inputs — the API persists the fact snapshot per run
// to make that guarantee auditable.
//
// Layers, in order:
//   1. Fact state        — latest fact per key with asOf ≤ run as-of
//   2. Applicability gate — company type / listing / exchange /
//                          category / sector / required facts, then
//                          fact-level overrides (consents, exemptions)
//   3. Evaluation        — DETERMINISTIC | DOCUMENTARY | JUDGMENT
//
// DETERMINISTIC rules score MECHANICALLY — dates in, answer out. The
// law gives a clear date or period and either you met it or you didn't.
// The rule-entry discipline ("each deadline is checked against the
// actual law text before it goes in") is enforced at REGISTRATION time
// via the verification queue; it travels with the finding as the rule
// verification badge and a caveat in the reason — it never blocks a
// computable due date.
//
// LOUD FAILURE: a rule the engine cannot evaluate (unknown deadline
// formula kind, unparseable definition, broken version chain) yields
// ENGINE_GAP — it is never skipped silently, it fails the run's
// engine-health flag and is excluded from no report.
//
// JUDGMENT rules are the exception to scoring: the engine never self-
// certifies. They surface as UNDETERMINED / HUMAN REVIEW, route to the
// review queue, and a sign-off (mirrored into the fact store as
// judgment.<refCode>) records the human determination with reasoning
// and timestamp. Aggregate rating is a WORST-SEVERITY FLOOR, not a
// weighted average — a single BLACK finding must never be averaged
// away.
// ─────────────────────────────────────────────────────────────
import type { ApplicabilityPredicate } from '@/lib/catalogue'

export interface EngineRule {
  refCode: string
  title: string
  regulatorCode: string
  module: string
  legalBasis: string
  deadlineRule: string
  deadlineNote: string | null
  verification: string
  instrumentCode: string | null
  trigger: string
  evaluationType: string
  applicability: ApplicabilityPredicate
  requiredEvidence: string[]
  deadlineFormula: { kind: string; unverified: boolean; note?: string } & Record<string, unknown>
  penaltyRef: string | null
  judgmentGuidance?: string | null
  version: number
  effectiveFrom: string
  effectiveTo: string | null
  sourceRef: string | null
}

export interface EngineInstrumentVersion {
  versionNo: number
  label: string
  effectiveFrom: string
  effectiveTo: string | null
  changeNote: string | null
  status: string
  verification: string
}

export interface EngineInstrument {
  code: string
  title: string
  issuingBody: string
  referenceType: string
  reference: string
  sourceUrl: string | null
  verification: string
  verifiedBy: string | null
  note: string | null
  versions: EngineInstrumentVersion[]
}

export interface EngineFact {
  type: 'FACT' | 'OVERRIDE'
  key: string
  value: string
  scopeRefCode: string | null
  source: string
  asOf: string
  verifiedBy: string | null
  note: string | null
}

export type FindingStatus =
  | 'OVERDUE'
  | 'DUE_SOON'
  | 'UPCOMING'
  | 'EVENT_DRIVEN'
  | 'UNVERIFIED_DEADLINE'
  | 'EVIDENCE_PRESENT'
  | 'EVIDENCE_MISSING'
  | 'JUDGMENT_REQUIRED'
  | 'JUDGMENT_SIGNED'
  | 'JUDGMENT_EXCEPTION'
  | 'JUDGMENT_ESCALATED'
  | 'ENGINE_GAP'
  | 'NOT_APPLICABLE'
  | 'EXEMPT'

/** Worst-severity floor: the aggregate rating is the MAX over findings, never an average. */
export type Severity = 'GREEN' | 'AMBER' | 'RED' | 'BLACK'

export const SEVERITY_RANK: Record<Severity, number> = { GREEN: 0, AMBER: 1, RED: 2, BLACK: 3 }

/** Severity of a finding status. ENGINE_GAP outranks every breach: a blind engine is the worst failure mode. */
export function severityOf(status: FindingStatus): Severity {
  switch (status) {
    case 'ENGINE_GAP':
      return 'BLACK'
    case 'OVERDUE':
    case 'EVIDENCE_MISSING':
    case 'JUDGMENT_EXCEPTION':
      return 'RED'
    case 'DUE_SOON':
    case 'UNVERIFIED_DEADLINE':
    case 'JUDGMENT_REQUIRED':
    case 'JUDGMENT_ESCALATED':
      return 'AMBER'
    default:
      return 'GREEN'
  }
}

export interface EngineFinding {
  refCode: string
  title: string
  regulatorCode: string
  module: string
  evaluationType: string
  trigger: string
  status: FindingStatus
  severity: Severity
  dueDate: string | null
  gateTrace: string[]
  reason: string
  requiredEvidence: string[]
  evidenceState: { item: string; present: boolean; factValue: string | null; source: string | null; asOf: string | null; verifiedBy: string | null }[]
  deadlineFormula: EngineRule['deadlineFormula'] | null
  deadlineRule: string
  penaltyRef: string | null
  ruleVerification: string
  instrumentCode: string | null
  ruleVersion: number
  ruleEffectiveFrom: string
  ruleSourceRef: string | null
}

export interface EngineSummary {
  score: number // % of machine-decidable findings in good standing — a secondary metric only
  /** Worst-severity floor across applicable findings. A single BLACK is never averaged away. */
  rating: Severity
  evaluableCount: number
  goodCount: number
  breachCount: number
  applicable: number
  notApplicable: number
  exempt: number
  overdue: number
  dueSoon: number
  upcoming: number
  eventDriven: number
  unverifiedDeadline: number
  evidencePresent: number
  evidenceMissing: number
  judgmentRequired: number
  judgmentSigned: number
  judgmentException: number
  judgmentEscalated: number
  engineGaps: number
  engineHealthy: boolean
  rulesInForce: number
  verifiedDeadlinePct: number // % of applicable DETERMINISTIC rules with an instrument-verified formula
  byEvaluationType: Record<string, { applicable: number; good: number; breach: number; judgment: number; unverified: number }>
}

export interface EngineReport {
  asOf: string
  factState: Record<string, EngineFact>
  findings: EngineFinding[]
  summary: EngineSummary
}

const GOOD_STATUSES: FindingStatus[] = ['UPCOMING', 'DUE_SOON', 'EVENT_DRIVEN', 'EVIDENCE_PRESENT']
// A breach is a machine-decidable bad standing. UNVERIFIED_DEADLINE is NOT a
// breach — it is a data gap (the rule's anchor fact is absent at the as-of)
// tracked via unverifiedDeadline and verifiedDeadlinePct. Every JUDGMENT_*
// status is excluded from the score: the engine never self-certifies.
const BREACH_STATUSES: FindingStatus[] = ['OVERDUE', 'EVIDENCE_MISSING']
const JUDGMENT_STATUSES: FindingStatus[] = ['JUDGMENT_REQUIRED', 'JUDGMENT_SIGNED', 'JUDGMENT_EXCEPTION', 'JUDGMENT_ESCALATED']

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseUTC(s: string): Date {
  return new Date(`${s}T00:00:00Z`)
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d)
  x.setUTCMonth(x.getUTCMonth() + months)
  return x
}

function endOfMonth(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 0))
}

/** Shift a date back whole months; if the source day is a month-end, keep month-end alignment (06-30 → 03-31, not 03-30). */
function shiftMonthsQuarter(fyEndDate: Date, monthsBack: number): Date {
  const isMonthEnd = fyEndDate.getUTCDate() === endOfMonth(fyEndDate.getUTCFullYear(), fyEndDate.getUTCMonth()).getUTCDate()
  const target = addMonths(fyEndDate, monthsBack)
  return isMonthEnd ? endOfMonth(target.getUTCFullYear(), target.getUTCMonth()) : target
}

/** Fiscal quarter ends derived from the fy_end fact (MM-DD, default 06-30). */
function fiscalQuarterEnds(asOf: Date, fyEnd: string): Date[] {
  const [fyM, fyD] = fyEnd.split('-').map(Number)
  const ends: Date[] = []
  // Look across three fiscal years: the NEXT actionable quarter-end can
  // fall inside a fiscal year that itself ends after the as-of date, so a
  // look-ahead of one full FY is required — otherwise every quarterly rule
  // would wrongly report "no upcoming fiscal quarter-end".
  for (const yearOffset of [-1, 0, 1]) {
    const fyEndDate = new Date(Date.UTC(asOf.getUTCFullYear() + yearOffset, fyM - 1, fyD))
    // Quarters: FY end and 3/6/9 months before it.
    ends.push(fyEndDate, shiftMonthsQuarter(fyEndDate, 3), shiftMonthsQuarter(fyEndDate, 6), shiftMonthsQuarter(fyEndDate, 9))
  }
  return [...new Set(ends.map(iso))].map(parseUTC).sort((a, b) => a.getTime() - b.getTime())
}

/** Fiscal year ends (two most recent relative to asOf). */
function fiscalYearEnds(asOf: Date, fyEnd: string): Date[] {
  const [fyM, fyD] = fyEnd.split('-').map(Number)
  const ends: Date[] = []
  for (const yearOffset of [0, -1, -2]) {
    let fyEndYear = asOf.getUTCFullYear() + yearOffset
    if (new Date(Date.UTC(fyEndYear, fyM - 1, fyD)) > asOf) fyEndYear -= 1
    ends.push(new Date(Date.UTC(fyEndYear, fyM - 1, fyD)))
  }
  return [...new Set(ends.map(iso))].map(parseUTC).sort((a, b) => a.getTime() - b.getTime())
}

interface DueResult {
  dueDate: Date | null
  status: FindingStatus
  basis: string
}

/** The evaluation capabilities of the engine, keyed by formula kind. A rule row whose kind is absent here fails loudly. */
export const DETERMINISTIC_KINDS = {
  DAYS_FROM_MONTH_END: 'N days after the latest completed month-end',
  DAYS_FROM_QUARTER_END: 'N days after the fiscal quarter-end',
  MONTHS_FROM_FY_END: 'N months after the fiscal year-end',
  FIXED_DATE: 'a fixed statutory date',
  DAYS_FROM_FACT: 'N days after an anchor fact',
  DAYS_FROM_EVENT: 'N days after a triggering event',
  ON_EVENT: 'on occurrence of the event',
  WITH_ANNUAL_REPORT: 'with the annual report cycle',
  ANNUAL_CYCLE: 'once per fiscal year',
  CONTINUOUS: 'continuous obligation',
  ON_CHANGE: 'on change of the underlying fact',
} as const

/** Thrown when the engine has no evaluation function for a rule row — surfaced as ENGINE_GAP, never skipped. */
export class EngineGapError extends Error {
  constructor(refCode: string, issue: string) {
    super(`ENGINE GAP on ${refCode}: ${issue}`)
    this.name = 'EngineGapError'
  }
}

function computeDeterministicDue(rule: EngineRule, factState: Record<string, EngineFact>, asOf: Date, asOfISO: string): DueResult {
  const f = rule.deadlineFormula
  // Structural failure — the engine has no evaluation function for this
  // formula. Fails LOUDLY (ENGINE_GAP), never skipped silently.
  if (!f || !f.kind) {
    throw new EngineGapError(rule.refCode, 'DETERMINISTIC rule carries no deadline formula — the engine has no evaluation function for it')
  }
  if (!(f.kind in DETERMINISTIC_KINDS)) {
    throw new EngineGapError(rule.refCode, `deadline formula kind "${f.kind}" has no matching evaluation function — registered kinds: ${Object.keys(DETERMINISTIC_KINDS).join(', ')}`)
  }
  const asOfTs = parseUTC(asOfISO).getTime()
  const classify = (due: Date, basis: string): DueResult => {
    const diffDays = Math.round((due.getTime() - asOfTs) / 86400000)
    if (diffDays < 0) return { dueDate: due, status: 'OVERDUE', basis }
    if (diffDays <= 30) return { dueDate: due, status: 'DUE_SOON', basis }
    return { dueDate: due, status: 'UPCOMING', basis }
  }

  switch (f.kind) {
    case 'DAYS_FROM_MONTH_END': {
      // Latest completed month-end relative to as-of (the actionable monthly return).
      const prevMonthEnd = endOfMonth(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1)
      return classify(addDays(prevMonthEnd, Number(f.days)), `monthly period ending ${iso(prevMonthEnd)} + ${f.days} days`)
    }
    case 'DAYS_FROM_QUARTER_END': {
      const fyEnd = factState['fy_end']?.value ?? '06-30'
      const ends = fiscalQuarterEnds(asOf, fyEnd)
      const next = ends.find((e) => e.getTime() > asOfTs)
      if (!next) return { dueDate: null, status: 'UNVERIFIED_DEADLINE', basis: 'no upcoming fiscal quarter-end found' }
      return classify(addDays(next, Number(f.days)), `fiscal quarter ending ${iso(next)} + ${f.days} days`)
    }
    case 'MONTHS_FROM_FY_END': {
      const fyEnd = factState['fy_end']?.value ?? '06-30'
      const candidates = fiscalYearEnds(asOf, fyEnd).map((fy) => {
        const due = addMonths(fy, Number(f.months))
        if (f.anchorDay) due.setUTCDate(Number(f.anchorDay))
        return due
      })
      const next = candidates.find((d) => d.getTime() >= asOfTs)
      if (next) return classify(next, `fiscal year-end + ${f.months} months${f.anchorDay ? `, day ${f.anchorDay}` : ''}`)
      const latest = candidates[candidates.length - 1]
      return { dueDate: latest, status: 'OVERDUE', basis: `fiscal year-end + ${f.months} months — passed` }
    }
    case 'FIXED_DATE': {
      const month = Number(f.month) - 1
      const day = Number(f.day)
      const candidates = [asOf.getUTCFullYear(), asOf.getUTCFullYear() - 1].map(
        (y) => new Date(Date.UTC(y, month, day)),
      ).sort((a, b) => a.getTime() - b.getTime())
      const next = candidates.find((d) => d.getTime() >= asOfTs)
      if (next) return classify(next, `fixed statutory date ${iso(next)}`)
      return { dueDate: candidates[candidates.length - 1], status: 'OVERDUE', basis: `fixed statutory date ${iso(candidates[candidates.length - 1])} — passed` }
    }
    case 'DAYS_FROM_FACT': {
      const fact = factState[String(f.factKey)]
      if (!fact) return { dueDate: null, status: 'UNVERIFIED_DEADLINE', basis: `anchor fact "${String(f.factKey)}" not present at as-of` }
      return classify(addDays(parseUTC(fact.value), Number(f.days)), `${String(f.factKey)} (${fact.value}) + ${f.days} days`)
    }
    case 'DAYS_FROM_EVENT': {
      // Day-count after a company event — the event date itself is not known engine-side.
      return { dueDate: null, status: 'EVENT_DRIVEN', basis: `${f.days ?? '?'} day(s) from the triggering event${f.unverified ? ' — formula pending instrument verification' : ''}` }
    }
    case 'ON_EVENT':
    case 'WITH_ANNUAL_REPORT':
    case 'ANNUAL_CYCLE':
    case 'CONTINUOUS':
    case 'ON_CHANGE':
      return { dueDate: null, status: 'EVENT_DRIVEN', basis: f.note ?? rule.deadlineRule }
    default:
      // Unreachable in practice (the kind is validated against DETERMINISTIC_KINDS
      // above) — kept as a loud failure so a future kind can never slip through silently.
      throw new EngineGapError(rule.refCode, `deadline formula kind "${f.kind}" is registered but has no implemented evaluation branch`)
  }
}

function evaluateGate(rule: EngineRule, factState: Record<string, EngineFact>, override: EngineFact | null, asOfISO: string): { applicable: boolean; trace: string[]; blockedReason: string | null; exemptReason: string | null; consentNote: string | null } {
  const trace: string[] = []
  const p = rule.applicability ?? {}
  const fail = (msg: string) => ({ applicable: false, trace, blockedReason: msg, exemptReason: null, consentNote: null })

  const checkList = (label: string, factKey: string, allowed: string[] | undefined, fallback: string) => {
    if (!allowed || allowed.length === 0) {
      trace.push(`${label}: any value accepted`)
      return
    }
    const value = factState[factKey]?.value ?? fallback
    const ok = allowed.includes(value)
    trace.push(`${label}: ${value || 'unknown'} ${ok ? '∈' : '∉'} [${allowed.join(', ')}] ${ok ? '✓' : '✗'}`)
    if (!ok) throw new Error(`${label} ${value || 'unknown'} is not in [${allowed.join(', ')}]`)
  }

  try {
    checkList('Company type', 'company_type', p.companyTypes, '')
    checkList('Listing status', 'listing_status', p.listingStatus, '')
    checkList('Exchange', 'exchange', p.exchanges, '')
    checkList('Category', 'category', p.categories, '')
    if (p.sectors && p.sectors.length > 0) checkList('Sector', 'sector', p.sectors, '')
    for (const req of p.requireFacts ?? []) {
      const fact = factState[req.key]
      const ok = fact ? (req.truthy ? fact.value === 'true' : req.equals ? fact.value === req.equals : true) : false
      trace.push(`Required fact ${req.key}: ${fact ? fact.value : 'absent'} ${ok ? '✓' : '✗'}`)
      if (!ok) return fail(`required fact "${req.key}" is ${fact ? fact.value : 'absent'} at as-of ${asOfISO}`)
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'applicability predicate failed')
  }

  if (override && override.value === 'EXEMPT') {
    trace.push(`Override ${override.key} = EXEMPT for ${rule.refCode} ✓ (consent/exemption on file)`)
    return { applicable: false, trace, blockedReason: null, exemptReason: override.note ?? 'Exemption on file as a fact-level override.', consentNote: null }
  }
  let consentNote: string | null = null
  if (override) {
    trace.push(`Override ${override.key} = ${override.value} for ${rule.refCode} (company-specific consent on file)`)
    consentNote = `Company-specific consent on file (${override.key} = ${override.value}, as of ${override.asOf}, verified by ${override.verifiedBy ?? 'unverified'})${override.note ? ` — ${override.note}` : ''}`
  }
  return { applicable: true, trace, blockedReason: null, exemptReason: null, consentNote }
}

export function evaluateCompliance(
  rules: EngineRule[],
  instruments: EngineInstrument[],
  facts: EngineFact[],
  asOfISO: string,
): EngineReport {
  const asOf = parseUTC(asOfISO)

  // 1. Fact state at as-of — latest fact per key (FACT) / per rule scope (OVERRIDE)
  //    with asOf ≤ run as-of. This is what makes past runs replayable: facts
  //    dated after the as-of simply did not exist yet.
  const factState: Record<string, EngineFact> = {}
  for (const fact of facts.filter((f) => f.type === 'FACT' && f.asOf <= asOfISO)) {
    const incumbent = factState[fact.key]
    if (!incumbent || fact.asOf >= incumbent.asOf) factState[fact.key] = fact
  }
  const overrideState: Record<string, EngineFact> = {}
  for (const fact of facts.filter((x) => x.type === 'OVERRIDE' && x.scopeRefCode && x.asOf <= asOfISO)) {
    const key = fact.scopeRefCode as string
    const incumbent = overrideState[key]
    if (!incumbent || fact.asOf >= incumbent.asOf) overrideState[key] = fact
  }

  const instrumentByCode = new Map(instruments.map((i) => [i.code, i]))

  // 2 + 3. Gate, then evaluate by type.
  const findings: EngineFinding[] = []
  for (const rule of rules) {
    const gate = evaluateGate(rule, factState, overrideState[rule.refCode] ?? null, asOfISO)
    const instrument = rule.instrumentCode ? instrumentByCode.get(rule.instrumentCode) : undefined
    const citation = instrument
      ? `${instrument.title} (${instrument.reference}) — issued by ${instrument.issuingBody}`
      : 'no registered instrument cited'

    if (!gate.applicable) {
      const status: FindingStatus = gate.exemptReason ? 'EXEMPT' : 'NOT_APPLICABLE'
      findings.push({
        refCode: rule.refCode,
        title: rule.title,
        regulatorCode: rule.regulatorCode,
        module: rule.module,
        evaluationType: rule.evaluationType,
        trigger: rule.trigger,
        status,
        severity: severityOf(status),
        dueDate: null,
        gateTrace: gate.trace,
        reason: gate.exemptReason
          ? `Exempt via fact-level override — ${gate.exemptReason} Citation: ${citation}.`
          : `Applicability gate blocked this rule at as-of ${asOfISO}: ${gate.blockedReason}. Citation: ${citation}.`,
        requiredEvidence: rule.requiredEvidence,
        evidenceState: [],
        deadlineFormula: null,
        deadlineRule: rule.deadlineRule,
        penaltyRef: rule.penaltyRef,
        ruleVerification: rule.verification,
        instrumentCode: rule.instrumentCode,
        ruleVersion: rule.version,
        ruleEffectiveFrom: rule.effectiveFrom,
        ruleSourceRef: rule.sourceRef,
      })
      continue
    }

    if (rule.evaluationType === 'DETERMINISTIC') {
      // Dates in, answer out. A formula the engine has no function for
      // throws — caught here and surfaced as a LOUD ENGINE_GAP finding.
      let due: DueResult
      try {
        due = computeDeterministicDue(rule, factState, asOf, asOfISO)
      } catch (e) {
        const issue = e instanceof EngineGapError ? e.message.replace(`ENGINE GAP on ${rule.refCode}: `, '') : 'evaluation function failed'
        console.error(e instanceof EngineGapError ? e.message : `[engine] ${rule.refCode}: ${issue}`)
        findings.push({
          refCode: rule.refCode,
          title: rule.title,
          regulatorCode: rule.regulatorCode,
          module: rule.module,
          evaluationType: rule.evaluationType,
          trigger: rule.trigger,
          status: 'ENGINE_GAP',
          severity: severityOf('ENGINE_GAP'),
          dueDate: null,
          gateTrace: gate.trace,
          reason: `ENGINE GAP — the engine holds no evaluation function for this rule row: ${issue}. The rule is NEVER skipped silently; the run is flagged unhealthy and the rule must be given a registered formula kind before reliance. Citation: ${citation}.`,
          requiredEvidence: rule.requiredEvidence,
          evidenceState: [],
          deadlineFormula: rule.deadlineFormula,
          deadlineRule: rule.deadlineRule,
          penaltyRef: rule.penaltyRef,
          ruleVerification: rule.verification,
          instrumentCode: rule.instrumentCode,
          ruleVersion: rule.version,
          ruleEffectiveFrom: rule.effectiveFrom,
          ruleSourceRef: rule.sourceRef,
        })
        continue
      }
      const formulaNote = due.basis ? ` ${due.basis}.` : ''
      const verificationCaveat = rule.deadlineFormula.unverified
        ? ' Caveat: this deadline formula is pending verification against the instrument text (see verification queue) — treat the computed date as provisional until confirmed.'
        : ''
      findings.push({
        refCode: rule.refCode,
        title: rule.title,
        regulatorCode: rule.regulatorCode,
        module: rule.module,
        evaluationType: rule.evaluationType,
        trigger: rule.trigger,
        status: due.status,
        severity: severityOf(due.status),
        dueDate: due.dueDate ? iso(due.dueDate) : null,
        gateTrace: gate.trace,
        reason: `${due.status === 'UNVERIFIED_DEADLINE' ? 'Due date not computable at this as-of' : 'Computed deadline'} per ${rule.deadlineRule}.${formulaNote}${verificationCaveat}${gate.consentNote ? ` ${gate.consentNote}` : ''} Citation: ${citation}.`,
        requiredEvidence: rule.requiredEvidence,
        evidenceState: [],
        deadlineFormula: rule.deadlineFormula,
        deadlineRule: rule.deadlineRule,
        penaltyRef: rule.penaltyRef,
        ruleVerification: rule.verification,
        instrumentCode: rule.instrumentCode,
        ruleVersion: rule.version,
        ruleEffectiveFrom: rule.effectiveFrom,
        ruleSourceRef: rule.sourceRef,
      })
      continue
    }

    if (rule.evaluationType === 'DOCUMENTARY') {
      const evidenceKey = `evidence.${rule.refCode.toLowerCase()}`
      const evidenceState = rule.requiredEvidence.map((item) => {
        const fact = factState[evidenceKey]
        return {
          item,
          present: fact?.value === 'VALID',
          factValue: fact?.value ?? null,
          source: fact?.source ?? null,
          asOf: fact?.asOf ?? null,
          verifiedBy: fact?.verifiedBy ?? null,
        }
      })
      const allPresent = evidenceState.every((e) => e.present)
      const fact = factState[evidenceKey]
      findings.push({
        refCode: rule.refCode,
        title: rule.title,
        regulatorCode: rule.regulatorCode,
        module: rule.module,
        evaluationType: rule.evaluationType,
        trigger: rule.trigger,
        status: allPresent ? 'EVIDENCE_PRESENT' : 'EVIDENCE_MISSING',
        severity: severityOf(allPresent ? 'EVIDENCE_PRESENT' : 'EVIDENCE_MISSING'),
        dueDate: null,
        gateTrace: gate.trace,
        reason: allPresent
          ? `Required evidence present (${fact?.value}, as of ${fact?.asOf}, verified by ${fact?.verifiedBy ?? 'unverified'}). ${rule.deadlineNote ? `${rule.deadlineNote} ` : ''}Citation: ${citation}.`
          : `Required evidence missing or not yet valid (fact ${evidenceKey} = ${fact?.value ?? 'absent'} at as-of ${asOfISO}). The certificate/report must exist and be valid before this rule is in good standing.${gate.consentNote ? ` ${gate.consentNote}` : ''} Citation: ${citation}.`,
        requiredEvidence: rule.requiredEvidence,
        evidenceState,
        deadlineFormula: rule.deadlineFormula,
        deadlineRule: rule.deadlineRule,
        penaltyRef: rule.penaltyRef,
        ruleVerification: rule.verification,
        instrumentCode: rule.instrumentCode,
        ruleVersion: rule.version,
        ruleEffectiveFrom: rule.effectiveFrom,
        ruleSourceRef: rule.sourceRef,
      })
      continue
    }

    // JUDGMENT — the engine never self-certifies. It surfaces the guidance
    // and the facts a reviewer needs. A human sign-off is mirrored into the
    // fact store as judgment.<refCode>, so replaying an old run as of an
    // old date reproduces exactly the determination that existed then.
    const relevantFacts = ['board_size', 'independent_directors', 'audit_committee_formed', 'nomination_remuneration_committee_formed']
      .filter((k) => factState[k])
      .map((k) => `${k} = ${factState[k].value}`)
      .join(', ')
    const signOff = factState[`judgment.${rule.refCode}`]
    let status: FindingStatus = 'JUDGMENT_REQUIRED'
    let reason = `Human review required — ${rule.judgmentGuidance ?? 'this rule involves an assessment that cannot be machine-decided'}.${relevantFacts ? ` Relevant facts: ${relevantFacts}.` : ''}${gate.consentNote ? ` ${gate.consentNote}` : ''} Citation: ${citation}.`
    if (signOff) {
      if (signOff.value === 'SATISFIED') {
        status = 'JUDGMENT_SIGNED'
        reason = `Signed off as SATISFIED by ${signOff.verifiedBy ?? 'unknown reviewer'} (fact judgment.${rule.refCode}, as of ${signOff.asOf}, source: ${signOff.source}). The determination is recorded, not machine-scored.${relevantFacts ? ` Facts at sign-off: ${relevantFacts}.` : ''} Citation: ${citation}.`
      } else if (signOff.value === 'EXCEPTION_NOTED') {
        status = 'JUDGMENT_EXCEPTION'
        reason = `Reviewer ${signOff.verifiedBy ?? 'unknown'} noted a compliance EXCEPTION (fact judgment.${rule.refCode}, as of ${signOff.asOf}, source: ${signOff.source}) — a human-determined non-compliance must not be averaged away.${signOff.note ? ` ${signOff.note}` : ''} Citation: ${citation}.`
      } else if (signOff.value === 'ESCALATED') {
        status = 'JUDGMENT_ESCALATED'
        reason = `Escalated to counsel by ${signOff.verifiedBy ?? 'unknown reviewer'} (fact judgment.${rule.refCode}, as of ${signOff.asOf}, source: ${signOff.source}).${signOff.note ? ` ${signOff.note}` : ''} Citation: ${citation}.`
      }
    }
    findings.push({
      refCode: rule.refCode,
      title: rule.title,
      regulatorCode: rule.regulatorCode,
      module: rule.module,
      evaluationType: rule.evaluationType,
      trigger: rule.trigger,
      status,
      severity: severityOf(status),
      dueDate: null,
      gateTrace: gate.trace,
      reason,
      requiredEvidence: rule.requiredEvidence,
      evidenceState: [],
      deadlineFormula: rule.deadlineFormula,
      deadlineRule: rule.deadlineRule,
      penaltyRef: rule.penaltyRef,
      ruleVerification: rule.verification,
      instrumentCode: rule.instrumentCode,
      ruleVersion: rule.version,
      ruleEffectiveFrom: rule.effectiveFrom,
      ruleSourceRef: rule.sourceRef,
    })
  }

  // 4. Aggregation — the RATING is a worst-severity floor over applicable
  //    findings, never a weighted average: a single BLACK (engine gap) or
  //    RED (breach, human-noted exception) must not be averaged away. The
  //    % score is kept as a secondary metric over machine-decidable
  //    findings only; JUDGMENT_* and UNVERIFIED_DEADLINE never enter it.
  const applicableFindings = findings.filter((f) => f.status !== 'NOT_APPLICABLE' && f.status !== 'EXEMPT')
  const good = applicableFindings.filter((f) => GOOD_STATUSES.includes(f.status)).length
  const breach = applicableFindings.filter((f) => BREACH_STATUSES.includes(f.status)).length
  const evaluable = good + breach
  const detApplicable = applicableFindings.filter((f) => f.evaluationType === 'DETERMINISTIC')
  const detVerified = detApplicable.filter((f) => f.deadlineFormula && !f.deadlineFormula.unverified).length

  const rating = applicableFindings.reduce<Severity>((worst, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst] ? f.severity : worst), 'GREEN')
  const engineGaps = findings.filter((f) => f.status === 'ENGINE_GAP').length

  const byEvaluationType: EngineSummary['byEvaluationType'] = {}
  for (const f of applicableFindings) {
    const bucket = (byEvaluationType[f.evaluationType] ??= { applicable: 0, good: 0, breach: 0, judgment: 0, unverified: 0 })
    bucket.applicable += 1
    if (GOOD_STATUSES.includes(f.status)) bucket.good += 1
    else if (BREACH_STATUSES.includes(f.status)) bucket.breach += 1
    else if (JUDGMENT_STATUSES.includes(f.status)) bucket.judgment += 1
    else bucket.unverified += 1
  }

  const summary: EngineSummary = {
    score: evaluable > 0 ? Math.round((good / evaluable) * 100) : 0,
    rating,
    evaluableCount: evaluable,
    goodCount: good,
    breachCount: breach,
    applicable: applicableFindings.length,
    notApplicable: findings.filter((f) => f.status === 'NOT_APPLICABLE').length,
    exempt: findings.filter((f) => f.status === 'EXEMPT').length,
    overdue: findings.filter((f) => f.status === 'OVERDUE').length,
    dueSoon: findings.filter((f) => f.status === 'DUE_SOON').length,
    upcoming: findings.filter((f) => f.status === 'UPCOMING').length,
    eventDriven: findings.filter((f) => f.status === 'EVENT_DRIVEN').length,
    unverifiedDeadline: findings.filter((f) => f.status === 'UNVERIFIED_DEADLINE').length,
    evidencePresent: findings.filter((f) => f.status === 'EVIDENCE_PRESENT').length,
    evidenceMissing: findings.filter((f) => f.status === 'EVIDENCE_MISSING').length,
    judgmentRequired: findings.filter((f) => f.status === 'JUDGMENT_REQUIRED').length,
    judgmentSigned: findings.filter((f) => f.status === 'JUDGMENT_SIGNED').length,
    judgmentException: findings.filter((f) => f.status === 'JUDGMENT_EXCEPTION').length,
    judgmentEscalated: findings.filter((f) => f.status === 'JUDGMENT_ESCALATED').length,
    engineGaps,
    engineHealthy: engineGaps === 0,
    rulesInForce: rules.length,
    verifiedDeadlinePct: detApplicable.length > 0 ? Math.round((detVerified / detApplicable.length) * 100) : 0,
    byEvaluationType,
  }

  return { asOf: asOfISO, factState, findings, summary }
}
