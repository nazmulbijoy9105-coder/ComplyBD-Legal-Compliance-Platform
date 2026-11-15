// ─────────────────────────────────────────────────────────────
// Regulator + workflow status visual theme.
// Palette rule: no blue / indigo — emerald, teal, amber, orange,
// rose, violet and slate only.
// ─────────────────────────────────────────────────────────────

export interface RegulatorTheme {
  code: string
  short: string
  chip: string // filled chip on light surfaces
  dot: string // solid dot / bar color
  bar: string // progress bar color
  soft: string // soft surface background
}

export const REGULATORS: Record<string, RegulatorTheme> = {
  RJSC: {
    code: 'RJSC',
    short: 'RJSC',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50',
  },
  BSEC: {
    code: 'BSEC',
    short: 'BSEC',
    chip: 'bg-teal-100 text-teal-800 border-teal-200',
    dot: 'bg-teal-500',
    bar: 'bg-teal-500',
    soft: 'bg-teal-50',
  },
  DSECSE: {
    code: 'DSECSE',
    short: 'DSE & CSE',
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    soft: 'bg-amber-50',
  },
  NBR: {
    code: 'NBR',
    short: 'NBR',
    chip: 'bg-orange-100 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    soft: 'bg-orange-50',
  },
  DOL: {
    code: 'DOL',
    short: 'Dept. of Labour',
    chip: 'bg-rose-100 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    soft: 'bg-rose-50',
  },
  BB: {
    code: 'BB',
    short: 'Bangladesh Bank',
    chip: 'bg-slate-200 text-slate-800 border-slate-300',
    dot: 'bg-slate-500',
    bar: 'bg-slate-500',
    soft: 'bg-slate-50',
  },
  NDGA: {
    code: 'NDGA',
    short: 'NDGA',
    chip: 'bg-violet-100 text-violet-800 border-violet-200',
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
    soft: 'bg-violet-50',
  },
}

export function regulatorTheme(code: string): RegulatorTheme {
  return REGULATORS[code] ?? REGULATORS.BB
}

export interface StatusTheme {
  label: string
  chip: string
  dot: string
}

export const WORKFLOW_STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'IN_REVIEW',
  'APPROVED',
  'FILED',
] as const

export const STATUS_THEMES: Record<string, StatusTheme> = {
  DRAFT: {
    label: 'Draft',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  IN_REVIEW: {
    label: 'In Review',
    chip: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
  },
  APPROVED: {
    label: 'Approved',
    chip: 'bg-teal-50 text-teal-700 border-teal-200',
    dot: 'bg-teal-500',
  },
  FILED: {
    label: 'Filed',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  OVERDUE: {
    label: 'Overdue',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
}

export function statusTheme(status: string): StatusTheme {
  return STATUS_THEMES[status] ?? STATUS_THEMES.DRAFT
}

export function statusLabel(status: string): string {
  return statusTheme(status).label
}

export interface VerificationTheme {
  label: string
  chip: string
}

// Canonical source-review definitions — single source of truth.
// Used by the Regulatory Map legend AND every VerificationBadge tooltip,
// so the wording can never drift apart between views.
export const VERIFICATION_HINTS: Record<string, string> = {
  VERIFIED:
    'Full row checked against the primary instrument (bdlaws.minlaw.gov.bd) or the regulator portal (rjsc.gov.bd / bsec.gov.bd / nbr.gov.bd / bb.org.bd).',
  PARTIAL:
    'Instrument confirmed, but the deadline rule or statutory form detail is still outstanding.',
  UNVERIFIED:
    'Not yet checked against any primary source — treat as an open TODO.',
  PENDING:
    'Awaiting source review — not yet checked against any primary source.',
}

export const VERIFICATION_HINT_FALLBACK = VERIFICATION_HINTS.UNVERIFIED

export const VERIFICATION_THEMES: Record<string, VerificationTheme> = {
  VERIFIED: {
    label: 'Verified',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  UNVERIFIED: {
    label: 'Unverified',
    chip: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  PARTIAL: {
    label: 'Partial',
    chip: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  PENDING: {
    label: 'Pending',
    chip: 'bg-slate-100 text-slate-700 border-slate-300',
  },
}

export function verificationTheme(v: string): VerificationTheme {
  return VERIFICATION_THEMES[v] ?? VERIFICATION_THEMES.UNVERIFIED
}

export const SOURCE_TIER_THEMES: Record<string, string> = {
  STATUTE: 'bg-slate-900 text-slate-100 border-slate-900',
  RULES: 'bg-slate-700 text-slate-100 border-slate-700',
  CIRCULAR: 'bg-amber-800 text-amber-50 border-amber-800',
  VOLUNTARY: 'bg-stone-400 text-stone-900 border-stone-400',
}

export function sourceTierTheme(tier: string): string {
  return SOURCE_TIER_THEMES[tier] ?? 'bg-slate-200 text-slate-700 border-slate-300'
}

export function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case 'ANNUAL':
      return 'Annual'
    case 'QUARTERLY':
      return 'Quarterly'
    case 'MONTHLY':
      return 'Monthly'
    case 'EVENT':
      return 'Event-driven'
    case 'ON_CHANGE':
      return 'On change'
    default:
      return cadence
  }
}

export function priorityTheme(priority: string): string {
  switch (priority) {
    case 'HIGH':
      return 'bg-rose-100 text-rose-800 border-rose-200'
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'LOW':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

export const CLASSIFICATION_THEMES: Record<string, string> = {
  PUBLIC: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  INTERNAL: 'bg-slate-100 text-slate-700 border-slate-200',
  CONFIDENTIAL: 'bg-amber-100 text-amber-800 border-amber-200',
  RESTRICTED: 'bg-rose-100 text-rose-800 border-rose-200',
}
