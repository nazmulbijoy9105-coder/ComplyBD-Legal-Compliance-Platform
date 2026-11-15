'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, FileUp, GitBranch, Loader2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ChangePipelineData, ChangeRequestItem, ImpactReport } from '@/lib/types'
import { SCROLLBAR, currentRoleLabel, notifyFactsChanged } from './engine-ui'

const STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const ISSUERS = ['BSEC', 'DSE', 'CSE', 'RJSC', 'NBR', 'BB']

function ImpactReportView({ report }: { report: ImpactReport }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5">
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-emerald-800">
        <GitBranch className="h-3.5 w-3.5" />
        Impact report — computed at approval
        <span className="font-mono font-medium text-emerald-700">
          rating {report.ratingBefore} → {report.ratingAfter} · score {report.scoreBefore}% → {report.scoreAfter}% · rule v{report.createdVersion}
        </span>
      </p>
      {report.findingsChanged.length === 0 ? (
        <p className="mt-1 text-[11px] text-emerald-700">No findings flip under this amendment — impact contained.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {report.findingsChanged.map((c) => (
            <li key={c.refCode} className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700">
              <span className="font-mono text-[10px] font-semibold text-slate-500">{c.refCode}</span>
              <span className="font-medium">{c.title}</span>
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">{c.change}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ChangePipelineCard({ onMutate }: { onMutate?: () => void }) {
  const { toast } = useToast()
  const [data, setData] = useState<ChangePipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [ingestOpen, setIngestOpen] = useState(false)
  const [reports, setReports] = useState<Record<string, ImpactReport>>({})
  const [form, setForm] = useState({
    refCode: '',
    title: '',
    issuer: 'BSEC',
    reference: '',
    publishedAt: '2026-11-15',
    summary: '',
    effectiveFrom: '2026-12-01',
    newDeadlineRule: '',
    newDeadlineNote: '',
  })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/change-pipeline')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function act(id: string, action: 'UNDER_REVIEW' | 'APPROVE' | 'REJECT', note?: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/change-pipeline/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Action failed')
      if (action === 'APPROVE' && body.impactReport) {
        setReports((prev) => ({ ...prev, [id]: body.impactReport }))
        toast({
          title: 'Circular approved — new rule version appended',
          description: `Rule v${body.createdVersion} created (never edited in place) · impact report computed: ${body.impactReport.findingsChanged.length} finding(s) flip.`,
        })
        notifyFactsChanged()
      } else if (action === 'APPROVE') {
        toast({ title: 'Circular approved', description: 'A new rule version was appended.' })
        notifyFactsChanged()
      } else if (action === 'REJECT') {
        toast({ title: 'Circular rejected', description: 'The rule base is untouched — rejection logged.' })
      } else {
        toast({ title: 'Moved to review' })
      }
      setRejectId(null)
      setRejectNote('')
      load()
      onMutate?.()
    } catch (e) {
      toast({ title: 'Action failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  async function ingest() {
    setBusyId('ingest')
    try {
      const proposed: Record<string, unknown> = {}
      if (form.newDeadlineRule.trim()) proposed.deadlineRule = form.newDeadlineRule.trim()
      if (form.newDeadlineNote.trim()) proposed.deadlineNote = form.newDeadlineNote.trim()
      const res = await fetch('/api/change-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refCode: form.refCode,
          title: form.title.trim(),
          issuer: form.issuer,
          reference: form.reference.trim(),
          publishedAt: form.publishedAt,
          summary: form.summary.trim(),
          effectiveFrom: form.effectiveFrom,
          proposedFields: proposed,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Ingest failed')
      }
      toast({ title: 'Circular ingested', description: 'It enters as RECEIVED — nothing touches the rule base until a human approves it.' })
      setIngestOpen(false)
      setForm({ ...form, refCode: '', title: '', reference: '', summary: '', newDeadlineRule: '', newDeadlineNote: '' })
      load()
    } catch (e) {
      toast({ title: 'Ingest failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <GitBranch className="h-4 w-4 text-teal-500" />
            Change pipeline — circulars in a human-approved flow
          </CardTitle>
          <Button size="sm" variant="outline" className="ms-auto h-7 border-teal-300 text-teal-700 hover:bg-teal-50" onClick={() => setIngestOpen(true)}>
            <FileUp className="h-3.5 w-3.5" />
            Ingest circular
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          BSEC/DSE notices are ingested, reviewed, and only on approval do they append a rule version — each approval computes
          an impact report showing exactly which findings flip. Without this the engine goes stale silently, and a stale GREEN
          is the worst failure mode. Acting as {currentRoleLabel()}.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
        )}
        {data?.requests.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1', STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-600 ring-slate-200')}>
                {r.status.replaceAll('_', ' ')}
              </span>
              <span className="text-xs font-bold text-slate-800">{r.title}</span>
              <span className="font-mono text-[10px] text-slate-400">{r.reference}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{r.issuer} → {r.refCode}</span>
              <span className="ms-auto flex items-center gap-1.5">
                {r.status === 'RECEIVED' && (
                  <Button size="sm" variant="outline" className="h-7" disabled={busyId === r.id} onClick={() => act(r.id, 'UNDER_REVIEW')}>
                    <ArrowRight className="h-3.5 w-3.5" />
                    Move to review
                  </Button>
                )}
                {r.status === 'UNDER_REVIEW' && (
                  <Button size="sm" className="h-7 bg-emerald-600 text-white hover:bg-emerald-700" disabled={busyId === r.id} onClick={() => act(r.id, 'APPROVE')}>
                    {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve + impact
                  </Button>
                )}
                {(r.status === 'RECEIVED' || r.status === 'UNDER_REVIEW') && (
                  <Button size="sm" variant="outline" className="h-7 border-rose-200 text-rose-700 hover:bg-rose-50" disabled={busyId === r.id} onClick={() => { setRejectId(r.id); setRejectNote('') }}>
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                )}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{r.summary}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400">
              <span>published {r.publishedAt}</span>
              <span>· effective from {r.effectiveFrom}</span>
              {r.reviewedBy && <span>· reviewer {r.reviewedBy}</span>}
              {r.reviewNote && <span>· {r.reviewNote}</span>}
              {Object.keys(r.proposedFields).length > 0 && (
                <span className="font-mono">proposes: {Object.keys(r.proposedFields).join(', ')}</span>
              )}
            </div>
            {(reports[r.id] ?? r.impactReport) && <div className="mt-2"><ImpactReportView report={reports[r.id] ?? (r.impactReport as ImpactReport)} /></div>}
          </div>
        ))}
      </CardContent>

      {/* Reject dialog */}
      <Dialog open={rejectId !== null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Reject circular</DialogTitle>
            <DialogDescription className="text-xs">
              A rejection must record why. The rule base is untouched and the rejection is logged in the pipeline.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            placeholder="Why is this circular rejected — e.g. draft not gazetted, out of scope, duplicate…"
            className="text-xs"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button size="sm" className="bg-rose-600 text-white hover:bg-rose-700" disabled={busyId !== null || rejectNote.trim().length < 5} onClick={() => rejectId && act(rejectId, 'REJECT', rejectNote.trim())}>
              Record rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingest dialog */}
      <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Ingest a regulatory circular</DialogTitle>
            <DialogDescription className="text-xs">
              Register a BSEC/DSE notice against the rule it amends. It enters as RECEIVED — a human must move it to review
              and approve before any rule version is created.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Target rule</Label>
              <Select value={form.refCode || undefined} onValueChange={(v) => setForm({ ...form, refCode: v })}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="select rule" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {data?.ruleIds.map((r) => (
                    <SelectItem key={r.refCode} value={r.refCode}>
                      {r.refCode} — {r.title.slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Issuer</Label>
              <Select value={form.issuer} onValueChange={(v) => setForm({ ...form, issuer: v })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ISSUERS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Circular title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-xs" placeholder="Amendment to …" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Circular reference</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="text-xs" placeholder="BSEC/CMRRCD/2026/…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Published</Label>
              <Input type="date" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">New version effective from</Label>
              <Input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="text-xs" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Summary (what changes)</Label>
              <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={2} className="text-xs" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Proposed new deadline rule text (optional)</Label>
              <Input value={form.newDeadlineRule} onChange={(e) => setForm({ ...form, newDeadlineRule: e.target.value })} className="text-xs" placeholder="Within N days of … (amended)" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Proposed deadline note / citation (optional)</Label>
              <Input value={form.newDeadlineNote} onChange={(e) => setForm({ ...form, newDeadlineNote: e.target.value })} className="text-xs" placeholder="Per circular …" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIngestOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-teal-600 text-white hover:bg-teal-700"
              disabled={busyId === 'ingest' || !form.refCode || form.title.trim().length < 3 || form.reference.trim().length < 3 || form.summary.trim().length < 10 || (!form.newDeadlineRule.trim() && !form.newDeadlineNote.trim())}
              onClick={ingest}
            >
              {busyId === 'ingest' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              Ingest as RECEIVED
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
