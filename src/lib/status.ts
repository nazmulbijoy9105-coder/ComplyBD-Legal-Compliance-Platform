// ─────────────────────────────────────────────────────────────
// Shared helpers for the compliance API layer.
// Effective-status rule (used by every endpoint):
//   effectiveStatus = 'OVERDUE' when status !== 'FILED' && dueDate < now,
//   otherwise the stored workflow status stands.
// ─────────────────────────────────────────────────────────────

export const STATUS_FILED = 'FILED'
export const STATUS_OVERDUE = 'OVERDUE'

export const DEFAULT_ACTOR = 'Nusrat Jahan — Compliance Officer'

/** Effective status: OVERDUE overrides any non-FILED status once past due. */
export function computeEffectiveStatus(
  status: string,
  dueDate: Date,
  now: Date = new Date(),
): string {
  if (status !== STATUS_FILED && dueDate.getTime() < now.getTime()) {
    return STATUS_OVERDUE
  }
  return status
}

/** Parse a JSON-string forms column into a plain string array. */
export function parseForms(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

/** Due-soon: not FILED and dueDate falls inside the next `windowDays` days. */
export function isDueSoon(
  status: string,
  dueDate: Date,
  now: Date,
  windowDays = 30,
): boolean {
  if (status === STATUS_FILED) return false
  const due = dueDate.getTime()
  const start = now.getTime()
  return due >= start && due <= start + windowDays * 24 * 60 * 60 * 1000
}

/** Validate an ISO-ish date string coming from request bodies. */
export function isParseableDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}
