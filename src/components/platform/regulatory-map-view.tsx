'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpenText, CircleAlert, Info, Loader2, ShieldQuestion } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { RegulatoryMapData, TemplateRow } from '@/lib/types'
import { regulatorTheme, VERIFICATION_HINTS } from '@/lib/regulator-theme'
import type { ReconciliationReport } from '@/lib/types'
import { CadenceChip, EvaluationTypeBadge, VerificationBadge } from './badges'

function TemplateLine({ t }: { t: TemplateRow }) {
  const deadlineUnverified =
    t.verification === 'UNVERIFIED' ||
    t.verification === 'PENDING' ||
    t.deadlineRule.includes('??')
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        deadlineUnverified ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-semibold text-slate-400">{t.refCode}</span>
        <span className="text-xs font-bold text-slate-800">{t.title}</span>
        <CadenceChip cadence={t.cadence} />
        <EvaluationTypeBadge value={t.evaluationType} />
        {t.instrumentCode && (
          <span className="font-mono text-[10px] font-semibold text-slate-400" title="Cites the legal instrument registry — the engine reads citations from there and nowhere else">
            → {t.instrumentCode}
          </span>
        )}
        {t.applicableTo === 'BANKS' && (
          <Badge variant="outline" className="text-[10px] text-slate-500">banks only</Badge>
        )}
        <span className="ms-auto flex items-center gap-1.5">
          {t.overdueCount > 0 && (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
              {t.overdueCount} overdue
            </span>
          )}
          {t.openCount > 0 && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {t.openCount} open
            </span>
          )}
          <VerificationBadge value={t.verification} />
        </span>
      </div>
      {t.description && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{t.description}</p>
      )}
      <div className="mt-2 flex flex-col gap-1.5 text-[11px] sm:flex-row sm:items-start sm:gap-4">
        <div className="sm:w-56 sm:shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deadline</span>
          <p className={cn('mt-0.5 font-semibold', deadlineUnverified ? 'text-amber-800' : 'text-slate-700')}>
            {t.deadlineRule}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          {t.deadlineNote && (
            <p className="leading-relaxed text-amber-700">
              <ShieldQuestion className="mr-1 inline h-3 w-3 align-[-1px]" />
              {t.deadlineNote}
            </p>
          )}
          {t.forms.length > 0 && (
            <p className="mt-1 text-slate-500">
              <span className="font-semibold text-slate-600">Forms: </span>
              {t.forms.join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RegulatoryMapView() {
  const [data, setData] = useState<RegulatoryMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [recon, setRecon] = useState<ReconciliationReport | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/regulators')
      if (!res.ok) throw new Error('failed')
      setData(await res.json())
    } catch {
      setData({ regulators: [], voluntary: [], pendingItems: [] })
    } finally {
      setLoading(false)
    }
    // Catalogue reconciliation (seed = engine = database) — non-blocking.
    fetch('/api/reconciliation')
      .then((r) => (r.ok ? r.json() : null))
      .then((report: ReconciliationReport | null) => setRecon(report))
      .catch(() => setRecon(null))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-60 rounded-xl" />
        ))}
      </div>
    )
  }

  const templateCount = data?.regulators.reduce((acc, r) => acc + r.templates.length, 0) ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Corrections notice — from the source-reviewed map */}
      <Alert className="border-amber-300 bg-amber-50 text-amber-900">
        <CircleAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-sm font-bold">Corrections notice — v1 was wrong</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
          This register was rebuilt row-by-row after source review. Key fixes: (1) PDPA 2026 (Act 63
          of 2026) is enacted — regulator is the National Data Governance Authority, not
          BTRC/ICT. (2) NBR corporate tax return corrected to the 15th day of the 7th month after
          year-end per Income Tax Act 2023. (3) CGC 2018 issued under s. 2CC of the Securities and
          Exchange Ordinance 1969, with mandatory compliance certificate. (4) WPPF (5% of profit,
          80:10:10, 9-month deadline) added to Labour. (5) Bangladesh Bank split from Labour —
          banking-company returns apply ONLY to banks. (6) ISO 27001 / SOC 2 kept as voluntary
          standards, not filings. Every row — VERIFIED included — remains reference data: confirm
          against primary sources before reliance.
        </AlertDescription>
      </Alert>

      {/* Stat header */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
          <BookOpenText className="h-3.5 w-3.5" />
          {data?.regulators.length ?? 0} regulators · {templateCount} statutory templates
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
          ~{templateCount} tracked filing types
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
          UNVERIFIED items = open TODOs for primary-source confirmation
        </span>
        {recon && (
          <span
            className={cn(
              'inline-flex flex-wrap items-center gap-2 rounded-full px-3 py-1 font-semibold ring-1',
              recon.ok
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-amber-50 text-amber-800 ring-amber-300',
            )}
            title={`Catalogue reconciliation — ${recon.catalogueVersion}. Seed manifest, runtime engine and database must agree on every rule ID and definition.`}
          >
            <VerificationBadge value={recon.verification} />
            <span>
              {recon.ok
                ? `Catalogue integrity — seed, engine and database reconcile by rule ID and definition · ${recon.summary.matchedRules}/${recon.rules.length} rules matched${recon.summary.amendedRules > 0 ? ` · ${recon.summary.amendedRules} amended with provenance` : ''}`
                : `Catalogue drift — ${recon.summary.totalIssues} issue${recon.summary.totalIssues === 1 ? '' : 's'} across seed / engine / database`}
            </span>
          </span>
        )}
      </div>

      {/* Source-review caveat legend — same model as every statutory row in the platform.
          Grid layout with the badge in a fixed column: text can never wrap into the chip,
          and copied/selected text reads cleanly row by row. */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Source-review caveats — every statutory row in this platform carries exactly one of
            these three states
          </p>
          <ul className="mt-3 space-y-1.5">
            {(['VERIFIED', 'PARTIAL', 'UNVERIFIED'] as const).map((v) => (
              <li key={v} className="grid grid-cols-[auto_1fr] items-start gap-x-2.5">
                <VerificationBadge value={v} className="mt-px" />
                <span className="min-w-0 text-[11px] leading-relaxed text-slate-600">
                  {VERIFICATION_HINTS[v]}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-500">
            Every statutory row in this platform — dashboard, calendar, register and assistant —
            carries the same caveats as this map. All of it is reference data: confirm deadlines and
            citations against the primary sources before reliance.
          </p>
          {/* Catalogue integrity — the reconciliation layer's own state, in the same
              VERIFIED / UNVERIFIED model as every statutory row. */}
          {recon && (
            <p className="mt-2 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-600">
              <VerificationBadge value={recon.verification} className="mt-px shrink-0" />
              <span className="min-w-0 flex-1">
                {recon.ok
                  ? `Seed, engine and database catalogues reconcile by rule ID and definition — all ${recon.rules.length} statutory rules match the manifest on every definition field (${recon.summary.matchedRules}/${recon.rules.length} matched${recon.summary.amendedRules > 0 ? `, ${recon.summary.amendedRules} amended via the change pipeline / verification queue with provenance in sourceRef` : ''} · ${recon.layers.engine.joinChecks} engine join checks · ${recon.layers.database.obligations} obligations).`
                  : `Catalogue reconciliation detected ${recon.summary.totalIssues} issue(s) across seed, engine and database — affected rule IDs are UNVERIFIED until restored to the manifest definition. See the drift report above.`}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Catalogue drift detail — only rendered when seed / engine / database disagree.
          Every offending row carries an UNVERIFIED badge, same model as the register. */}
      {recon && !recon.ok && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <CircleAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <VerificationBadge value="UNVERIFIED" />
            Catalogue reconciliation failed — {recon.summary.totalIssues} issue
            {recon.summary.totalIssues === 1 ? '' : 's'}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
              {recon.rules
                .filter((r) => r.status !== 'MATCHED')
                .slice(0, 10)
                .map((r) => (
                  <li key={`rule-${r.refCode}`} className="flex flex-wrap items-center gap-2">
                    <VerificationBadge value="UNVERIFIED" className="shrink-0" />
                    <span>
                      <span className="font-mono font-semibold">{r.refCode}</span> —{' '}
                      {r.status === 'DEFINITION_DRIFT' &&
                        (r.unexplainedVersions.length > 0
                          ? `version${r.unexplainedVersions.length === 1 ? '' : 's'} ${r.unexplainedVersions.join(', v')} carry no approval provenance (sourceRef)`
                          : `baseline definition drifted in ${r.driftedFields.join(', ')}`)}
                      {r.status === 'MISSING_IN_DATABASE' && 'missing from database catalogue'}
                      {r.status === 'ORPHAN_IN_DATABASE' &&
                        'database row without a seed-manifest counterpart'}
                    </span>
                  </li>
                ))}
              {recon.engineIssues.slice(0, 8).map((e, i) => (
                <li key={`engine-${i}`} className="flex flex-wrap items-center gap-2">
                  <VerificationBadge value="UNVERIFIED" className="shrink-0" />
                  <span>
                    <span className="font-mono font-semibold">{e.refCode ?? 'custom'}</span> — {e.issue}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] font-semibold text-amber-800">
              Rule IDs and definitions must reconcile across seed, engine and database. Re-run{' '}
              <span className="font-mono">bun prisma/seed.ts</span> or restore the catalogue row to
              the manifest definition before relying on affected rows.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Regulator cards */}
      {data?.regulators.map((r) => {
        const theme = regulatorTheme(r.code)
        return (
          <Card key={r.code} className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-200">
            <CardHeader className={cn('border-b border-slate-100 py-4', theme.soft)}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold', theme.chip)}>
                  {r.name}
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-bold text-slate-900">{r.fullName}</CardTitle>
                  <p className="mt-0.5 text-[11px] text-slate-500">{r.description}</p>
                </div>
                <span className="ms-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {r.templates.length} template{r.templates.length === 1 ? '' : 's'}
                </span>
              </div>
              {r.scopeNote && (
                <p className="mt-2 flex items-start gap-1.5 rounded-md bg-white/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                  {r.scopeNote}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2.5 p-4">
              {r.templates.map((t) => (
                <TemplateLine key={t.refCode} t={t} />
              ))}
            </CardContent>
          </Card>
        )
      })}

      {/* Voluntary standards */}
      <Card className="border-0 border-dashed border-slate-300 shadow-none ring-1 ring-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Voluntary standards — not statutory (kept separate to avoid misrepresentation)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {data?.voluntary.map((v) => (
            <div key={v.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-bold text-stone-600">VOLUNTARY</Badge>
                <span className="text-xs font-bold text-slate-800">{v.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">{v.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Still pending */}
      <Alert className="border-dashed border-amber-300 bg-white">
        <ShieldQuestion className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-sm font-bold text-amber-800">
          Still pending — items deliberately left out
        </AlertTitle>
        <AlertDescription>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
            {data?.pendingItems.map((p) => (
              <li key={p.title} className="flex flex-col">
                <span className="font-semibold text-slate-700">{p.title}</span>
                <span>{p.body}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-semibold text-amber-800">
            Treat each as an open TODO. The compliance officer must verify against primary sources
            (bdlaws.minlaw.gov.bd, bsec.gov.bd, nbr.gov.bd, bb.org.bd) before any rule referencing
            them is published.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  )
}
