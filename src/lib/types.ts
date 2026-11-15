// ─────────────────────────────────────────────────────────────
// Shared frontend types — mirror the backend API contracts.
// ─────────────────────────────────────────────────────────────

export type ViewId =
  | 'dashboard'
  | 'calendar'
  | 'obligations'
  | 'regulatory-map'
  | 'compliance-engine'
  | 'documents'
  | 'assistant'

export interface TemplateSummary {
  refCode: string
  verification: string
  deadlineRule: string
  deadlineNote: string | null
  legalBasis: string
  sourceTier: string
  module: string
}

export interface ObligationItem {
  id: string
  refCode: string | null
  title: string
  regulatorCode: string
  forms: string[]
  cadence: string
  periodLabel: string | null
  dueDate: string
  status: string
  priority: string
  assignee: string
  company?: string
  notes?: string | null
  filedAt?: string | null
  updatedAt?: string
  createdAt?: string
  effectiveStatus: string
  template?: TemplateSummary | null
}

export interface TemplateDetail extends TemplateSummary {
  legalBasisNote: string | null
  lawStatus: string
  applicableTo: string
  forms: string[]
}

export interface DocumentItem {
  id: string
  /** null when masked above the acting role's need-to-know clearance */
  name: string | null
  /** true when the row is masked — metadata only, contents withheld */
  masked: boolean
  classification: string
  version: number
  fileType: string
  sizeKb: number
  uploadedBy: string | null
  createdAt: string
  obligationId?: string | null
  obligationTitle?: string | null
}

export interface ActivityItem {
  id: string
  type: string
  actor: string
  message: string
  createdAt: string
  obligationId?: string | null
}

export interface ObligationDetail extends ObligationItem {
  template: TemplateDetail | null
  documents: DocumentItem[]
  activities: ActivityItem[]
}

export interface DashboardData {
  stats: {
    total: number
    open: number
    overdue: number
    dueSoon: number
    filedThisYear: number
    complianceScore: number
  }
  regulatorBreakdown: {
    code: string
    name: string
    fullName: string
    total: number
    filed: number
    overdue: number
    dueSoon: number
  }[]
  upcoming: ObligationItem[]
  activity: ActivityItem[]
}

export interface CalendarData {
  events: ObligationItem[]
  monthSummary: {
    total: number
    overdue: number
    filed: number
    open: number
  }
}

export interface TemplateRow {
  refCode: string
  module: string
  title: string
  description: string | null
  legalBasis: string
  legalBasisNote: string | null
  sourceTier: string
  lawStatus: string
  verification: string
  forms: string[]
  cadence: string
  deadlineRule: string
  deadlineNote: string | null
  applicableTo: string
  instrumentCode: string | null
  evaluationType: string
  openCount: number
  overdueCount: number
}

export interface RegulatorRow {
  code: string
  name: string
  fullName: string
  description: string
  scopeNote: string | null
  templates: TemplateRow[]
}

export interface SimpleItem {
  title: string
  body: string
}

export interface RegulatoryMapData {
  regulators: RegulatorRow[]
  voluntary: SimpleItem[]
  pendingItems: SimpleItem[]
}

// ── Catalogue reconciliation (seed ↔ database ↔ engine) ──────

export type ReconciliationStatus =
  | 'MATCHED'
  | 'AMENDED'
  | 'DEFINITION_DRIFT'
  | 'MISSING_IN_DATABASE'
  | 'ORPHAN_IN_DATABASE'

export interface RuleReconciliation {
  refCode: string
  title: string
  verification: string
  inSeed: boolean
  inDatabase: boolean
  /** null when the rule exists on only one layer (nothing to compare) */
  definitionMatch: boolean | null
  driftedFields: string[]
  linkedObligations: number
  status: ReconciliationStatus
  /** current version in the database (null when the rule is not in the DB) */
  currentVersion: number | null
  /** amendment chain for versions > 1 — each must trace to an approval (sourceRef) */
  amendmentChain: { version: number; effectiveFrom: string; effectiveTo: string | null; sourceRef: string | null }[]
  /** versions whose sourceRef is missing or unexplained — breaks the integrity story */
  unexplainedVersions: number[]
}

export interface RegulatorReconciliation {
  code: string
  fullName: string
  inSeed: boolean
  inDatabase: boolean
  definitionMatch: boolean | null
  driftedFields: string[]
  status: ReconciliationStatus
}

export interface EngineJoinIssue {
  obligationId: string
  obligationTitle: string
  refCode: string | null
  issue: string
}

export interface ReconciliationReport {
  ok: boolean
  /**
   * The reconciliation layer's own state, expressed in the same model as
   * every statutory row (VERIFIED / UNVERIFIED). VERIFIED = all three layers
   * agree on every rule ID and definition; UNVERIFIED = drift detected, treat
   * affected rows as unconfirmed until restored to the manifest.
   */
  verification: 'VERIFIED' | 'UNVERIFIED'
  checkedAt: string
  catalogueVersion: string
  layers: {
    seed: { regulators: number; rules: number }
    database: { regulators: number; rules: number; obligations: number }
    engine: { joinChecks: number; brokenJoins: number }
  }
  summary: {
    matchedRules: number
    amendedRules: number
    driftedRules: number
    missingInDatabase: number
    orphanInDatabase: number
    matchedRegulators: number
    driftedRegulators: number
    brokenJoins: number
    totalIssues: number
  }
  rules: RuleReconciliation[]
  regulators: RegulatorReconciliation[]
  engineIssues: EngineJoinIssue[]
}

// ── Compliance engine (pure function of facts × rules × as-of) ──

export interface RuleVersionRow {
  refCode: string
  version: number
  title: string
  evaluationType: string
  verification: string
  deadlineRule: string
  effectiveFrom: string
  effectiveTo: string | null
  sourceRef: string | null
  activeAtAsOf: boolean
}

export interface ImpactReport {
  computedAt: string
  createdVersion: number
  findingsChanged: {
    refCode: string
    title: string
    before: { status: string; dueDate: string | null }
    after: { status: string; dueDate: string | null }
    change: string
  }[]
  ratingBefore: string
  ratingAfter: string
  scoreBefore: number
  scoreAfter: number
  rulesEvaluated: number
}

export interface ComplianceEngineData {
  runId: string
  asOf: string
  /** true when the run was persisted with the exact fact snapshot used */
  replayable: boolean
  summary: import('@/lib/evaluator').EngineSummary
  findings: import('@/lib/evaluator').EngineFinding[]
  factState: Record<string, import('@/lib/evaluator').EngineFact>
  instruments: import('@/lib/evaluator').EngineInstrument[]
  facts: import('@/lib/evaluator').EngineFact[]
  profile: { name: string; stockTickers: string | null; sector: string; note: string | null }
  recentRuns: { id: string; asOf: string; createdAt: string; score: number; rating: string }[]
  /** full version chain per rule ID — versions are immutable, edits append */
  ruleVersions: RuleVersionRow[]
  /** loud data errors: overlapping effective windows at the as-of date */
  overlaps: { refCode: string; issue: string }[]
  /** rules registered but not yet in force at the as-of date */
  notYetInForce: { refCode: string; version: number; effectiveFrom: string }[]
}

// ── Review queue (JUDGMENT findings → human sign-off) ──

export interface ReviewQueueData {
  openItems: {
    refCode: string
    title: string
    regulatorCode: string
    guidance: string | null
    relevantFacts: string[]
    lastStatus: string | null
    lastReason: string | null
  }[]
  decisions: {
    id: string
    refCode: string
    decision: string
    reasoning: string
    decidedBy: string
    decidedRole: string
    decidedAt: string
  }[]
}

// ── Verification queue (every deadline confirmed against its instrument) ──

export interface VerificationPendingItem {
  refCode: string
  version: number
  title: string
  regulatorCode: string
  subjects: ('DEADLINE_FORMULA' | 'PENALTY_REF' | 'CITATION')[]
  claim: string
  deadlineFormula: { kind: string; unverified: boolean; note?: string } & Record<string, unknown> | null
  instrumentCode: string | null
  instrumentTitle: string | null
  instrumentReference: string | null
  instrumentSourceUrl: string | null
  ruleVerification: string
  penaltyRef: string | null
}

export interface VerificationQueueData {
  pending: VerificationPendingItem[]
  recent: {
    id: string
    refCode: string
    subject: string
    claim: string
    status: string
    decidedBy: string | null
    decidedRole: string | null
    decidedAt: string | null
    proposedNote: string | null
  }[]
  verifiedDeadlinePct: number
}

// ── Change pipeline (circulars → human approval → impact report) ──

export interface ChangeRequestItem {
  id: string
  refCode: string
  title: string
  issuer: string
  reference: string
  publishedAt: string
  summary: string
  effectiveFrom: string
  status: string
  proposedFields: Record<string, unknown>
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  impactReport: ImpactReport | null
  createdAt: string
}

export interface ChangePipelineData {
  requests: ChangeRequestItem[]
  ruleIds: { refCode: string; title: string; version: number }[]
}

// ── Access log & confidentiality ──

export interface AccessLogData {
  currentRole: string
  roles: { id: string; label: string; clearance: string; canClear: string[]; rationale: string; actor: string }[]
  entries: {
    id: string
    at: string
    actor: string
    role: string
    action: string
    resource: string
    detail: string | null
    classification: string
    outcome: string
    reason: string | null
  }[]
  counters: { allowed: number; denied: number; total: number }
}
