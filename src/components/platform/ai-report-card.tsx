'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// AI compliance report — narrative layer over the engine run.
// The LLM is the NARRATOR, never the judge: the card renders the
// machine verdict next to the narrative so any drift is visible,
// and the contract line is always shown to the reader.
// ─────────────────────────────────────────────────────────────

interface AiReportResponse {
  runId: string
  asOf: string
  company: string
  narrative: string
  engineVerdict: { rating: string; breaches: number; applicable: number; engineHealthy: boolean }
  generatedBy: string
  contract: string
  generatedAt: string
  error?: string
  detail?: string
}

/** Light markdown renderer — headings, bullets, numbered items, bold. */
function Narrative({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-1" />
        if (trimmed.startsWith('# '))
          return (
            <h3 key={i} className="pt-1 text-base font-bold text-slate-900">
              {trimmed.slice(2)}
            </h3>
          )
        if (trimmed.startsWith('## '))
          return (
            <h4 key={i} className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {trimmed.slice(3)}
            </h4>
          )
        if (/^[-•]\s/.test(trimmed))
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span dangerouslySetInnerHTML={{ __html: inline(trimmed.replace(/^[-•]\s/, '')) }} />
            </div>
          )
        if (/^\d+\.\s/.test(trimmed))
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="font-mono text-xs font-bold text-emerald-700">{trimmed.match(/^\d+/)?.[0]}.</span>
              <span dangerouslySetInnerHTML={{ __html: inline(trimmed.replace(/^\d+\.\s/, '')) }} />
            </div>
          )
        return <p key={i} dangerouslySetInnerHTML={{ __html: inline(trimmed) }} />
      })}
    </div>
  )
}

/** Escape then allow only <strong>/<em> from the model's **bold** markup. */
function inline(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-slate-100 px-1 font-mono text-xs">$1</code>')
}

const RATING_STYLE: Record<string, string> = {
  BLACK: 'bg-slate-900 text-white ring-slate-900',
  RED: 'bg-red-50 text-red-800 ring-red-300',
  AMBER: 'bg-amber-50 text-amber-900 ring-amber-300',
  GREEN: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
}

export default function AiReportCard({ runId, asOf }: { runId: string | null; asOf: string }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<AiReportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!runId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      })
      const json = (await res.json()) as AiReportResponse
      if (!res.ok) {
        setError(json.error ?? json.detail ?? `HTTP ${res.status}`)
        setReport(null)
      } else {
        setReport(json)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-800">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            AI compliance report — narrative over the engine run (as-of {asOf})
          </span>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={generate} disabled={loading || !runId}>
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              'Generate AI report'
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-relaxed text-slate-500">
          The language model is the <span className="font-semibold text-slate-700">narrator, never the judge</span>: it
          formats and explains the deterministic engine run — it never re-decides a status, re-scores or re-dates. The
          machine verdict is rendered next to the narrative so any drift is visible. Provider:{' '}
          <span className="font-mono">z-ai-web-dev-sdk</span> — bundled, no external API key required (free tier).
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800 ring-1 ring-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Report generation failed: {error}. The engine run itself is unaffected — the machine verdict above remains
              authoritative.
            </span>
          </div>
        )}

        {report && (
          <>
            {/* Authoritative machine verdict — always beside the narrative */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-700">Engine verdict (authoritative):</span>
              <span className={`rounded px-2 py-0.5 text-xs font-bold ring-1 ${RATING_STYLE[report.engineVerdict.rating] ?? 'bg-slate-100 text-slate-700 ring-slate-300'}`}>
                {report.engineVerdict.rating}
              </span>
              <span className="text-xs text-slate-600">
                {report.engineVerdict.breaches} breaches of {report.engineVerdict.applicable} applicable · engine{' '}
                {report.engineVerdict.engineHealthy ? 'healthy' : 'GAPS PRESENT'}
              </span>
              <span className="ml-auto font-mono text-[10px] text-slate-400">
                run {report.runId.slice(-8)} · {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>

            <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-100 p-4">
              <Narrative text={report.narrative} />
            </div>

            <p className="text-[11px] italic text-slate-400">{report.contract} · {report.generatedBy}</p>
          </>
        )}

        {!report && !error && !loading && (
          <p className="text-xs text-slate-400">
            No narrative generated yet for this run. The report is produced from the persisted run
            {runId ? (
              <>
                {' '}
                <span className="font-mono">{runId.slice(-8)}</span>
              </>
            ) : (
              ' — run the engine first'
            )}
            .
          </p>
        )}
      </CardContent>
    </Card>
  )
}
