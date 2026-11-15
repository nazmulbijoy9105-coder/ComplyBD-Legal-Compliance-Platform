// Shared platform constants — the demo platform's "today".
export const PLATFORM_AS_OF = '2026-11-15'

/** Validate an as-of query param; falls back to the platform date. */
export function parseAsOfParam(raw: string | null): string {
  if (!raw) return PLATFORM_AS_OF
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return PLATFORM_AS_OF
  // reject impossible dates (e.g. 2026-02-31) — Date normalises them, so re-check
  const d = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return PLATFORM_AS_OF
  return raw
}
