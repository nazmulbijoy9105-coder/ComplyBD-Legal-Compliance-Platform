'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Cog, FlaskConical, Gauge, Loader2, ShieldQuestion, Table2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ComplianceEngineData } from '@/lib/types'
import { EvaluationTypeBadge, FindingStatusBadge, RatingBadge, RegulatorChip, VerificationBadge } from './badges'
import { SCROLLBAR, PLATFORM_DATE } from './engine-ui'
import RuleVersionsCard from './rule-versions-card'
import VerificationQueueCard from './verification-queue-card'
import ReviewQueueCard from './review-queue-card'
import ChangePipelineCard from './change-pipeline-card'
import AiReportCard from './ai-report-card'
import EngineAlertsCard from './engine-alerts-card'

function FindingRow({ f }: { f: ComplianceEngineData['findings'][number] }) {
  const gate = f.gateTrace
  const formula = f.deadlineFormula
  return (
    <details className="group rounded-lg border border-slate-200 bg-white px-3 py-2.5 open:ring-1 open:ring-slate-200">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[10px] font-semibold text-slate-400">{f.refCode}</span>
        <span className="text-xs font-bold text-slate-800">{f.title}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500" title="rule version that produced this finding">v{f.ruleVersion}</span>
        <EvaluationTypeBadge value={f.evaluationType} />
        <FindingStatusBadge status={f.status} />
        {f.dueDate && (
          <span className="text-[11px] font-semibold text-slate-600">due {f.dueDate}</span>
        )}
        <RegulatorChip code={f.regulatorCode} className="hidden sm:inline-flex" />
        <VerificationBadge value={f.ruleVerification} className="ms-auto shrink-0" />
      </summary>
      <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-600">
        <p>{f.reason}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Applicability gate trace</p>
            <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-500">
              {gate.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md bg-slate-50 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deadline formula</p>
            {formula ? (
              <p className="mt-1 font-mono text-[10px] text-slate-600">
                kind: {formula.kind}
                {formula.unverified ? ' · pending instrument verification (provisional date)' : ' · verified against the instrument'}
              </p>
            ) : (
              <p className="mt-1 text-slate-500">n/a for this evaluation type</p>
            )}
            <p className="mt-1 text-[10px] text-slate-500">Rule text: {f.deadlineRule}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              rule in force from {f.ruleEffectiveFrom} · {f.ruleSourceRef ? 'version carries approval provenance' : 'manifest baseline'}
            </p>
            {f.penaltyRef && (
              <p className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-700">
                <ShieldQuestion className="mt-0.5 h-3 w-3 shrink-0" />
                Penalty: {f.penaltyRef}
              </p>
            )}
          </div>
        </div>
        {f.evidenceState.length > 0 && (
          <div className="rounded-md bg-slate-50 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Evidence state</p>
            <ul className="mt-1 space-y-1">
              {f.evidenceState.map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <FindingStatusBadge status={e.present ? 'EVIDENCE_PRESENT' : 'EVIDENCE_MISSING'} />
                  <span className="text-slate-600">{e.item}</span>
                  {e.factValue && <span className="font-mono text-[10px] text-slate-400">fact = {e.factValue} · as of {e.asOf} · {e.verifiedBy ?? 'unverified'}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}

export default function ComplianceEngineView() {
  const [data, setData] = useState<ComplianceEngineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [asOf, setAsOf] = useState(PLATFORM_DATE)
  const [filter, setFilter] = useState<'ALL' | 'DETERMINISTIC' | 'DOCUMENTARY' | 'JUDGMENT'>('ALL')

  const load = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/compliance-engine?asOf=${date}`)
      if (!res.ok) throw new Error('failed')
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(asOf)
  }, [load, asOf])

  // Workflows mutate the fact store / rule base — re-run so verdicts stay live.
  useEffect(() => {
    const handler = () => load(asOf)
    window.addEventListener('complybd:facts-changed', handler)
    return () => window.removeEventListener('complybd:facts-changed', handler)
  }, [load, asOf])

  const findings = data?.findings ?? []
  const shown = filter === 'ALL' ? findings : findings.filter((f) => f.evaluationType === filter)
  const s = data?.summary

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Run controls + replay */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-100">
            <Cog className="h-3.5 w-3.5" />
            Compliance engine
          </span>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
            As-of date
            <input
              type="date"
              value={asOf}
              onChange={(e) => e.target.value && setAsOf(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              aria-label="Evaluation as-of date"
            />
          </label>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => load(asOf)} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            Run evaluation
          </Button>
          {data && (
            <span className="text-[11px] text-slate-500">
              run <span className="font-mono">{data.runId.slice(-8)}</span> · as of {data.asOf} · replayable (pure function of facts × rules × as-of)
            </span>
          )}
          <p className="w-full text-[11px] leading-relaxed text-slate-500">
            The evaluator is a <span className="font-semibold text-slate-700">pure function of (facts, rules, as-of date)</span> — pick an earlier as-of date to replay
            exactly what the engine would have concluded then: facts dated after the as-of simply did not exist yet, and only rule versions in force at that date load.
            Gate order: applicability first, then evaluation (DETERMINISTIC / DOCUMENTARY / JUDGMENT). Rules the engine cannot evaluate fail LOUDLY as ENGINE_GAP — never silently.
          </p>
        </CardContent>
      </Card>

      {/* Rating + KPIs */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        data && s && (
          <>
            {/* Worst-severity floor rating — never an average */}
            <Card
              className={cn(
                'border-0 shadow-sm ring-1',
                s.rating === 'GREEN' && 'ring-emerald-300',
                s.rating === 'AMBER' && 'ring-amber-300',
                s.rating === 'RED' && 'ring-rose-300',
                s.rating === 'BLACK' && 'ring-slate-950',
              )}
            >
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex items-center gap-3">
                  <RatingBadge rating={s.rating} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Aggregate rating — worst-severity floor</p>
                    <p className="text-[11px] text-slate-500">
                      The max over applicable findings, never a weighted average: a single BLACK (engine gap) or RED (breach) must not be averaged away.
                    </p>
                  </div>
                </div>
                <div className="ms-auto grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-4">
                  <span><span className="font-bold text-rose-700">{s.overdue + s.evidenceMissing + s.judgmentException}</span> RED-grade</span>
                  <span><span className="font-bold text-amber-700">{s.dueSoon + s.unverifiedDeadline + s.judgmentRequired + s.judgmentEscalated}</span> AMBER-grade</span>
                  <span><span className="font-bold text-slate-900">{s.engineGaps}</span> engine gap(s) {s.engineHealthy ? '— healthy' : '— UNHEALTHY'}</span>
                  <span><span className="font-bold text-slate-700">{s.rulesInForce}</span> rules in force at {data.asOf}</span>
                </div>
              </CardContent>
            </Card>

            {/* Loud failures — never silent */}
            {(!s.engineHealthy || data.overlaps.length > 0) && (
              <div className="space-y-2">
                {s.engineGaps > 0 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-slate-950 bg-slate-950 px-3.5 py-2.5 text-white">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                    <div>
                      <p className="text-xs font-bold">ENGINE GAP — {s.engineGaps} rule(s) the engine cannot evaluate</p>
                      <p className="mt-0.5 text-[11px] text-slate-300">
                        A rule row has no matching evaluation function (unknown formula kind or broken window). It was never skipped silently — find it below with
                        the ENGINE GAP badge and give it a registered formula via the verification queue.
                      </p>
                    </div>
                  </div>
                )}
                {data.overlaps.map((o) => (
                  <div key={o.refCode} className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-rose-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <div>
                      <p className="text-xs font-bold">Version overlap on {o.refCode}</p>
                      <p className="mt-0.5 text-[11px] text-rose-800">{o.issue}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card className="border-0 shadow-sm ring-1 ring-emerald-200">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Machine-decidable score</p>
                  <p className="mt-1.5 flex items-center gap-2 text-3xl font-bold tracking-tight text-emerald-600">
                    {s.score}%
                    <span className="text-sm font-semibold text-slate-400">· rating {s.rating}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {s.goodCount} of {s.evaluableCount} machine-decidable rules in good standing — secondary to the rating floor
                  </p>
                </CardContent>
              </Card>
              {[
                { label: 'Applicable rules', value: s.applicable, sub: `${s.notApplicable} blocked by the gate · ${s.exempt} exempt`, tone: 'text-slate-700' },
                { label: 'Breaches', value: s.overdue + s.evidenceMissing, sub: `${s.overdue} overdue · ${s.evidenceMissing} evidence missing`, tone: 'text-rose-600' },
                { label: 'Human review', value: s.judgmentRequired + s.judgmentEscalated, sub: `${s.judgmentSigned} signed off · ${s.judgmentException} exception(s) noted · engine never self-certifies`, tone: 'text-violet-600' },
              ].map((k) => (
                <Card key={k.label} className="border-0 shadow-sm ring-1 ring-slate-200">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
                    <p className={cn('mt-1.5 text-3xl font-bold tracking-tight', k.tone)}>{k.value}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{k.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                <Table2 className="h-3.5 w-3.5" />
                {data.profile.name} · {data.profile.stockTickers ?? ''} · sector {data.profile.sector}
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
                {s.verifiedDeadlinePct}% of deterministic deadlines instrument-verified
              </span>
              {data.notYetInForce.length > 0 && (
                <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-600 ring-1 ring-slate-200" title={data.notYetInForce.map((n) => `${n.refCode} v${n.version} from ${n.effectiveFrom}`).join(', ')}>
                  {data.notYetInForce.length} rule version(s) not yet in force at {asOf}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
                <Gauge className="h-3.5 w-3.5" />
                {s.dueSoon} due soon · {s.upcoming} upcoming · {s.eventDriven} event-driven
              </span>
            </div>
          </>
        )
      )}

      {/* Findings */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-bold text-slate-800">Findings — every applicable rule, evaluated at the as-of date</CardTitle>
            <div className="ms-auto flex flex-wrap gap-1.5">
              {(['ALL', 'DETERMINISTIC', 'DOCUMENTARY', 'JUDGMENT'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilter(v)}
                  aria-pressed={filter === v}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors',
                    filter === v ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400',
                  )}
                >
                  {v === 'ALL' ? 'All' : v.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && !data && (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
          )}
          {shown.map((f) => (
            <FindingRow key={f.refCode} f={f} />
          ))}
        </CardContent>
      </Card>

      {/* Workflows */}
      <EngineAlertsCard refreshKey={data?.runId ?? null} />
      <AiReportCard runId={data?.runId ?? null} asOf={asOf} />
      <ChangePipelineCard onMutate={() => load(asOf)} />
      <VerificationQueueCard onMutate={() => load(asOf)} />
      <ReviewQueueCard onMutate={() => load(asOf)} />
      <RuleVersionsCard versions={data?.ruleVersions ?? []} asOf={asOf} />

      {/* Instrument registry */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Gauge className="h-4 w-4 text-slate-400" />
            Legal instrument registry — rules cite this table and nowhere else
          </CardTitle>
          <p className="text-[11px] text-slate-500">
            Every instrument carries its issuing body, gazette / circular reference, effective dates and a verified-by field.
            Amendments create a NEW version and never edit the old one.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && !data && (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
          )}
          <div className={cn('max-h-96 space-y-2 overflow-y-auto pr-1', SCROLLBAR)}>
            {data?.instruments.map((inst) => (
              <details key={inst.code} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-[10px] font-bold text-slate-400">{inst.code}</span>
                  <span className="text-xs font-bold text-slate-800">{inst.title}</span>
                  <span className="text-[11px] text-slate-500">{inst.issuingBody}</span>
                  <VerificationBadge value={inst.verification} className="ms-auto shrink-0" />
                </summary>
                <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-700">{inst.referenceType}</span> — {inst.reference}
                  </p>
                  {inst.verifiedBy && <p>Verified by <span className="font-semibold text-slate-700">{inst.verifiedBy}</span></p>}
                  {inst.note && <p className="text-slate-500">{inst.note}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {inst.versions.map((v) => (
                      <span
                        key={v.versionNo}
                        title={`${v.label} — effective ${v.effectiveFrom}${v.effectiveTo ? ` to ${v.effectiveTo}` : ' onward'}${v.changeNote ? ` — ${v.changeNote}` : ''}`}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                          v.status === 'SUPERSEDED' ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        )}
                      >
                        v{v.versionNo} · {v.effectiveFrom}{v.effectiveTo ? `→${v.effectiveTo}` : ''}{v.status === 'SUPERSEDED' ? ' · superseded' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fact store */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Cog className="h-4 w-4 text-slate-400" />
            Company fact store — every fact carries source, as-of and verified-by
          </CardTitle>
          <p className="text-[11px] text-slate-500">
            Consents and exemptions are fact-level overrides scoped to a single rule; judgment sign-offs mirror in as
            <span className="font-mono"> judgment.&lt;rule&gt;</span>. The evaluator consumes only facts dated on or before the as-of date.
          </p>
        </CardHeader>
        <CardContent>
          <div className={cn('max-h-96 space-y-1.5 overflow-y-auto pr-1', SCROLLBAR)}>
            {data?.facts.map((fact, i) => {
              const inState =
                fact.type === 'FACT'
                  ? data.factState[fact.key]?.asOf === fact.asOf && data.factState[fact.key]?.value === fact.value
                  : Object.values(data.factState).some((f) => f.scopeRefCode === fact.scopeRefCode && f.asOf === fact.asOf)
              return (
                <div
                  key={`${fact.type}-${fact.key}-${fact.asOf}-${i}`}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]',
                    fact.type === 'OVERRIDE' ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      fact.type === 'OVERRIDE' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {fact.type}
                  </span>
                  <span className="font-mono font-semibold text-slate-700">{fact.key}{fact.scopeRefCode ? ` → ${fact.scopeRefCode}` : ''}</span>
                  <span className="font-semibold text-slate-900">{fact.value}</span>
                  <span className="text-slate-500">{fact.source}</span>
                  <span className="ms-auto flex items-center gap-2 text-slate-400">
                    <span>as of {fact.asOf}</span>
                    <span>· {fact.verifiedBy ?? 'unverified'}</span>
                    {inState && <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">in state</span>}
                  </span>
                  {fact.note && <p className="w-full text-[10px] text-slate-500">{fact.note}</p>}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Engine findings are reference data, not legal conclusions. Rules whose verification is PARTIAL or UNVERIFIED — including every
        pending deadline formula in the verification queue — require confirmation against the primary sources (bdlaws.minlaw.gov.bd,
        rjsc.gov.bd, bsec.gov.bd, nbr.gov.bd, bb.org.bd) before reliance. Not legal advice.
      </p>
    </div>
  )
}
