'use client'

import { GitCommitVertical, Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RuleVersionRow } from '@/lib/types'
import { EvaluationTypeBadge, VerificationBadge } from './badges'
import { SCROLLBAR } from './engine-ui'

export default function RuleVersionsCard({ versions, asOf }: { versions: RuleVersionRow[]; asOf: string }) {
  const byRefCode = new Map<string, RuleVersionRow[]>()
  for (const v of versions) {
    const list = byRefCode.get(v.refCode) ?? []
    list.push(v)
    byRefCode.set(v.refCode, list)
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
          <Landmark className="h-4 w-4 text-slate-400" />
          Rule version registry — uniqueness (rule ID, version), windows never overlap
        </CardTitle>
        <p className="text-[11px] leading-relaxed text-slate-500">
          The engine loads its rules from the database; the code holds no rule definitions. Every rule carries a version
          number with an effective window — an edit appends a NEW version (with the approval in <span className="font-mono">sourceRef</span>)
          and never updates a row in place. The loader fetches only versions active on the as-of date, so re-running an old
          verdict as of an old date reproduces the same answer.
        </p>
      </CardHeader>
      <CardContent>
        <div className={cn('max-h-96 space-y-1.5 overflow-y-auto pr-1', SCROLLBAR)}>
          {[...byRefCode.entries()].map(([refCode, chain]) => (
            <details key={refCode} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-[10px] font-bold text-slate-400">{refCode}</span>
                <span className="text-xs font-semibold text-slate-700">{chain[chain.length - 1].title}</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {chain.length === 1 ? 'baseline only' : `${chain.length} versions`}
                </span>
                <EvaluationTypeBadge value={chain[chain.length - 1].evaluationType} />
                <VerificationBadge value={chain[chain.length - 1].verification} className="ms-auto shrink-0" />
              </summary>
              <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                {chain.map((v) => (
                  <div
                    key={`${v.refCode}-v${v.version}`}
                    className={cn(
                      'flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-[10px]',
                      v.activeAtAsOf ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/60 text-slate-500',
                    )}
                  >
                    <GitCommitVertical className={cn('h-3 w-3 shrink-0', v.activeAtAsOf ? 'text-emerald-600' : 'text-slate-300')} />
                    <span className="font-mono font-bold">v{v.version}</span>
                    <span>
                      {v.effectiveFrom}
                      {v.effectiveTo ? ` → ${v.effectiveTo}` : ' → current'}
                    </span>
                    {v.activeAtAsOf && <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">in force at {asOf}</span>}
                    {v.sourceRef && <span className="min-w-0 truncate text-slate-400" title={v.sourceRef}>{v.sourceRef}</span>}
                    {!v.sourceRef && v.version === 1 && <span className="text-slate-400">manifest baseline</span>}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
