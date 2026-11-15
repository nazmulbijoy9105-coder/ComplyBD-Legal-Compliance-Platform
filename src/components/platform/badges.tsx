'use client'

import { cn } from '@/lib/utils'
import {
  cadenceLabel,
  priorityTheme,
  regulatorTheme,
  sourceTierTheme,
  statusLabel,
  statusTheme,
  verificationTheme,
  VERIFICATION_HINTS,
  VERIFICATION_HINT_FALLBACK,
} from '@/lib/regulator-theme'

export function RegulatorChip({ code, className }: { code: string; className?: string }) {
  const theme = regulatorTheme(code)
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold',
        theme.chip,
        className,
      )}
    >
      {theme.short}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const theme = statusTheme(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold',
        theme.chip,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', theme.dot)} />
      {statusLabel(status)}
    </span>
  )
}

export function VerificationBadge({ value, className }: { value: string; className?: string }) {
  const theme = verificationTheme(value)
  const hint = VERIFICATION_HINTS[value] ?? VERIFICATION_HINT_FALLBACK
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        theme.chip,
        className,
      )}
      title={hint}
    >
      {theme.label}
    </span>
  )
}

export function SourceTierBadge({ tier, className }: { tier: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        sourceTierTheme(tier),
        className,
      )}
      title="Legal source tier"
    >
      {tier}
    </span>
  )
}

export function CadenceChip({ cadence, className }: { cadence: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600',
        className,
      )}
    >
      {cadenceLabel(cadence)}
    </span>
  )
}

export function PriorityChip({ priority, className }: { priority: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        priorityTheme(priority),
        className,
      )}
    >
      {priority}
    </span>
  )
}

export function LawStatusBadge({ status, className }: { status: string; className?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    IN_FORCE: { label: 'In force', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    AMENDED_2026: { label: 'Amended 2025/26', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    PHASED_IN: { label: 'Phased in', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  }
  const item = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        item.cls,
        className,
      )}
    >
      {item.label}
    </span>
  )
}

export function EvaluationTypeBadge({ value, className }: { value: string; className?: string }) {
  const map: Record<string, { label: string; cls: string; title: string }> = {
    DETERMINISTIC: { label: 'Deterministic', cls: 'bg-slate-100 text-slate-700 border-slate-300', title: 'Machine-decidable — dates, thresholds, filings' },
    DOCUMENTARY: { label: 'Documentary', cls: 'bg-teal-50 text-teal-700 border-teal-200', title: 'A certificate or report must exist and be valid' },
    JUDGMENT: { label: 'Judgment', cls: 'bg-violet-50 text-violet-700 border-violet-200', title: 'Human assessment — the engine never self-certifies (e.g. independence of directors, adequacy of disclosure)' },
  }
  const item = map[value] ?? { label: value, cls: 'bg-slate-100 text-slate-600 border-slate-200', title: 'Evaluation type' }
  return (
    <span
      title={item.title}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        item.cls,
        className,
      )}
    >
      {item.label}
    </span>
  )
}

export function FindingStatusBadge({ status, className }: { status: string; className?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OVERDUE: { label: 'Overdue', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    DUE_SOON: { label: 'Due soon', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    UPCOMING: { label: 'Upcoming', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    EVENT_DRIVEN: { label: 'Event-driven', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
    UNVERIFIED_DEADLINE: { label: 'Deadline unverified', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
    EVIDENCE_PRESENT: { label: 'Evidence present', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    EVIDENCE_MISSING: { label: 'Evidence missing', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    JUDGMENT_REQUIRED: { label: 'Human review', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    JUDGMENT_SIGNED: { label: 'Signed off', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    JUDGMENT_EXCEPTION: { label: 'Exception noted', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    JUDGMENT_ESCALATED: { label: 'Escalated', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    ENGINE_GAP: { label: 'Engine gap', cls: 'bg-slate-950 text-white border-slate-950' },
    NOT_APPLICABLE: { label: 'Not applicable', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    EXEMPT: { label: 'Exempt', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  }
  const item = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        item.cls,
        className,
      )}
    >
      {item.label}
    </span>
  )
}

/** Aggregate rating — worst-severity floor, never an average. */
export function RatingBadge({ rating, className }: { rating: string; className?: string }) {
  const map: Record<string, { label: string; cls: string; title: string }> = {
    GREEN: { label: 'GREEN', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', title: 'No machine-decidable breaches and no gaps — good standing across the board' },
    AMBER: { label: 'AMBER', cls: 'bg-amber-50 text-amber-800 border-amber-300', title: 'Attention: due-soon, unverified anchors, judgment pending or escalations — no breach yet' },
    RED: { label: 'RED', cls: 'bg-rose-50 text-rose-800 border-rose-300', title: 'At least one machine-decidable breach (overdue filing / missing evidence / human-noted exception)' },
    BLACK: { label: 'BLACK', cls: 'bg-slate-950 text-white border-slate-950', title: 'The engine itself is blind on a rule (engine gap) — findings are incomplete until fixed; worst failure mode' },
  }
  const item = map[rating] ?? { label: rating, cls: 'bg-slate-100 text-slate-600 border-slate-200', title: 'Aggregate rating' }
  return (
    <span
      title={item.title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold tracking-wide',
        item.cls,
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {item.label}
    </span>
  )
}
