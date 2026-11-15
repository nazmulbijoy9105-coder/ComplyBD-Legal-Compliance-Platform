// Shared bits for the compliance-engine view family.
export const SCROLLBAR =
  '[&_::-webkit-scrollbar]:w-1.5 [&_::-webkit-scrollbar-track]:bg-transparent [&_::-webkit-scrollbar-thumb]:rounded-full [&_::-webkit-scrollbar-thumb]:bg-slate-300'

export const PLATFORM_DATE = '2026-11-15'

/** Read the acting role (demo persona) from the complybd_role cookie. */
export function currentRoleId(): string {
  if (typeof document === 'undefined') return 'COMPLIANCE_OFFICER'
  const match = document.cookie.match(/(?:^|;\s*)complybd_role=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : 'COMPLIANCE_OFFICER'
}

export const ROLE_LABELS: Record<string, string> = {
  COMPANY_SECRETARY: 'Company Secretary',
  COMPLIANCE_OFFICER: 'Compliance Officer',
  EXTERNAL_AUDITOR: 'External Auditor',
  EXECUTIVE: 'Executive (MD/CEO)',
}

export function currentRoleLabel(): string {
  return ROLE_LABELS[currentRoleId()] ?? 'Compliance Officer'
}

/** Fire a platform-wide "facts changed" signal — engine views re-run. */
export function notifyFactsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('complybd:facts-changed'))
  }
}
