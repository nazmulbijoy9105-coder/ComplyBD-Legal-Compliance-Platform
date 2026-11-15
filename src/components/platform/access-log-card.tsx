'use client'

import { useCallback, useEffect, useState } from 'react'
import { EyeOff, Loader2, Lock, ScrollText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AccessLogData } from '@/lib/types'
import { SCROLLBAR, currentRoleLabel } from './engine-ui'

const CLEARANCE_STYLES: Record<string, string> = {
  RESTRICTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  CONFIDENTIAL: 'bg-amber-50 text-amber-700 ring-amber-200',
  INTERNAL: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export default function AccessLogCard() {
  const [data, setData] = useState<AccessLogData | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/access-log')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort surface
    }
  }, [])

  useEffect(() => {
    // Poll after hydration (rAF defers the first fetch, satisfying strict
    // effect rules and avoiding a render cascade on mount).
    const first = window.requestAnimationFrame(load)
    const id = window.setInterval(load, 15000)
    return () => {
      window.cancelAnimationFrame(first)
      window.clearInterval(id)
    }
  }, [load])

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
          <Lock className="h-4 w-4 text-slate-500" />
          Access &amp; confidentiality — need-to-know with a full audit trail
          <span className="ms-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">{data?.counters.allowed ?? 0} allowed</span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200">{data?.counters.denied ?? 0} denied</span>
          </span>
        </CardTitle>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Listed-company data can include unpublished price-sensitive information: tenant isolation is a legal exposure and staff
          access is an insider-trading risk. Every sensitive read, upload, deletion attempt and role switch is logged here with
          actor, role and the need-to-know reason — allowed or denied. You are acting as {currentRoleLabel()}.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Need-to-know role matrix */}
        <div className="grid gap-2 sm:grid-cols-2">
          {data?.roles.map((r) => (
            <div
              key={r.id}
              className={cn(
                'rounded-lg border px-3 py-2',
                r.id === data.currentRole ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white',
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-slate-800">{r.label}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', CLEARANCE_STYLES[r.clearance] ?? 'bg-slate-100 text-slate-600 ring-slate-200')}>
                  up to {r.clearance}
                </span>
                {r.id === data.currentRole && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">acting</span>
                )}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{r.rationale}</p>
            </div>
          ))}
        </div>

        {/* Recent access entries */}
        <div className={cn('max-h-64 space-y-1.5 overflow-y-auto pr-1 border-t border-slate-100 pt-3', SCROLLBAR)}>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <ScrollText className="h-3 w-3" />
            Access log — most recent first
          </p>
          {!data && (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
          )}
          {data?.entries.map((e) => (
            <div
              key={e.id}
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]',
                e.outcome === 'DENIED' ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white',
              )}
            >
              {e.outcome === 'DENIED' ? (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">DENIED</span>
              ) : (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">ALLOWED</span>
              )}
              <span className="font-mono text-[10px] font-semibold text-slate-600">{e.action}</span>
              <span className="text-slate-700">{e.actor}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{e.classification}</span>
              {e.detail && <span className="min-w-0 flex-1 truncate text-slate-400" title={e.detail}>{e.detail}</span>}
              <span className="ms-auto shrink-0 text-slate-400">
                {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {e.reason && <p className="w-full text-[10px] leading-relaxed text-slate-400">{e.reason}</p>}
            </div>
          ))}
          {data && data.entries.length === 0 && (
            <p className="flex items-center gap-1.5 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              <EyeOff className="h-3.5 w-3.5" />
              No sensitive access recorded yet — open a classified document or run the engine and it will appear here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
