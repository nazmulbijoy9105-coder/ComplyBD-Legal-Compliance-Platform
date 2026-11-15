// ─────────────────────────────────────────────────────────────
// Access control & confidentiality — need-to-know enforcement.
//
// Listed-company data includes UNPUBLISHED price-sensitive information.
// Tenant isolation here is a legal exposure, and staff access to it is
// an insider-trading risk, so:
//   1. every role carries an explicit need-to-know clearance ladder,
//   2. classified resources are masked above a role's clearance,
//   3. every sensitive read (allowed or denied) is written to the
//      AccessLog with actor, role, outcome and the need-to-know reason.
// ─────────────────────────────────────────────────────────────
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const ROLE_COOKIE = 'complybd_role'
export const DEFAULT_ROLE: RoleId = 'COMPLIANCE_OFFICER'

export type RoleId = 'COMPANY_SECRETARY' | 'COMPLIANCE_OFFICER' | 'EXTERNAL_AUDITOR' | 'EXECUTIVE'

export type Classification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'

const CLASSIFICATION_RANK: Record<Classification, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
}

export interface RoleDef {
  id: RoleId
  label: string
  actor: string // demo persona for the audit trail
  /** Highest classification this role may open (need-to-know ceiling). */
  clearance: Classification
  canClear: Classification[]
  rationale: string
}

export const ROLES: Record<RoleId, RoleDef> = {
  COMPANY_SECRETARY: {
    id: 'COMPANY_SECRETARY',
    label: 'Company Secretary',
    actor: 'Tanvir Ahmed — Company Secretary',
    clearance: 'RESTRICTED',
    canClear: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
    rationale: 'Legal custodian of the register — full need-to-know including unpublished price-sensitive information.',
  },
  COMPLIANCE_OFFICER: {
    id: 'COMPLIANCE_OFFICER',
    label: 'Compliance Officer',
    actor: 'Nusrat Jahan — Compliance Officer',
    clearance: 'CONFIDENTIAL',
    canClear: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
    rationale: 'Runs the compliance workflow — up to CONFIDENTIAL; RESTRICTED stays with the company secretary.',
  },
  EXTERNAL_AUDITOR: {
    id: 'EXTERNAL_AUDITOR',
    label: 'External Auditor',
    actor: 'Sabbir Rahman — External Auditor (CA firm)',
    clearance: 'CONFIDENTIAL',
    canClear: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
    rationale: 'Engagement scope only — audit evidence up to CONFIDENTIAL; RESTRICTED board material excluded.',
  },
  EXECUTIVE: {
    id: 'EXECUTIVE',
    label: 'Executive (MD/CEO)',
    actor: 'Md. Rafiqul Islam — Managing Director',
    clearance: 'INTERNAL',
    canClear: ['PUBLIC', 'INTERNAL'],
    rationale: 'Management view — INTERNAL only; working papers and price-sensitive filings are need-to-know.',
  },
}

export function isRoleId(value: string | undefined | null): value is RoleId {
  return value === 'COMPANY_SECRETARY' || value === 'COMPLIANCE_OFFICER' || value === 'EXTERNAL_AUDITOR' || value === 'EXECUTIVE'
}

/** Resolve the acting role from the role cookie (demo persona switcher). */
export function resolveRole(request: NextRequest): RoleDef {
  const raw = request.cookies.get(ROLE_COOKIE)?.value
  return isRoleId(raw) ? ROLES[raw] : ROLES[DEFAULT_ROLE]
}

/** Need-to-know check: the classification must sit at or below the role ceiling. */
export function canAccess(role: RoleDef, classification: string): boolean {
  const rank = CLASSIFICATION_RANK[(classification as Classification) ?? 'INTERNAL'] ?? 1
  return rank <= CLASSIFICATION_RANK[role.clearance]
}

export interface AccessLogEntry {
  tenantId: string // every access row belongs to exactly one tenant
  actor: string
  role: string
  action: string
  resource: string
  detail?: string
  classification: string
  outcome: 'ALLOWED' | 'DENIED'
  reason?: string
}

/**
 * Persist an access-log row. A failed log write must never silently pass:
 * it is logged to stderr so the incident is visible in the server trail.
 */
export async function logAccess(entry: AccessLogEntry): Promise<void> {
  if (!entry.tenantId) {
    // A log without a tenant is an isolation hole — fail loudly.
    console.error('[access-log] REFUSED: missing tenantId — compliance incident', entry)
    return
  }
  try {
    await db.accessLog.create({
      data: {
        tenantId: entry.tenantId,
        actor: entry.actor,
        role: entry.role,
        action: entry.action,
        resource: entry.resource,
        detail: entry.detail ?? null,
        classification: entry.classification,
        outcome: entry.outcome,
        reason: entry.reason ?? null,
      },
    })
  } catch (error) {
    console.error('[access-log] FAILED to persist access log entry — compliance incident', entry, error)
  }
}

/** Highest classification present in a set — used to log list endpoints. */
export function highestClassification(values: string[]): string {
  const rank = (c: string) => CLASSIFICATION_RANK[(c as Classification) ?? 'PUBLIC'] ?? 0
  return values.reduce((best, c) => (rank(c) > rank(best) ? c : best), 'PUBLIC')
}
