'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Scale, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import type { ReviewQueueData } from '@/lib/types'
import { RegulatorChip } from './badges'
import { SCROLLBAR, currentRoleLabel } from './engine-ui'

const DECISION_META: Record<string, { label: string; cls: string; hint: string }> = {
  SATISFIED: { label: 'Satisfied', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', hint: 'Assessed and found compliant — recorded, not machine-scored.' },
  EXCEPTION_NOTED: { label: 'Exception noted', cls: 'bg-rose-50 text-rose-700 border-rose-200', hint: 'Human-determined non-compliance — never averaged away.' },
  ESCALATED: { label: 'Escalated', cls: 'bg-orange-50 text-orange-700 border-orange-200', hint: 'Escalated to counsel — stays open in the queue.' },
}

export default function ReviewQueueCard({ onMutate }: { onMutate?: () => void }) {
  const { toast } = useToast()
  const [data, setData] = useState<ReviewQueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ReviewQueueData['openItems'][number] | null>(null)
  const [decision, setDecision] = useState('SATISFIED')
  const [reasoning, setReasoning] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/review-queue')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit() {
    if (!active) return
    setBusy(true)
    try {
      const res = await fetch('/api/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refCode: active.refCode, decision, reasoning: reasoning.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Sign-off failed')
      }
      toast({
        title: `Signed off ${active.refCode}`,
        description: `${DECISION_META[decision]?.label} — reasoning logged, mirrored into the fact store (judgment.${active.refCode}).`,
      })
      setActive(null)
      setReasoning('')
      setDecision('SATISFIED')
      load()
      onMutate?.()
    } catch (e) {
      toast({ title: 'Sign-off failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
          <Scale className="h-4 w-4 text-violet-500" />
          Review queue — judgment sign-off
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
            {data?.openItems.length ?? '…'} open
          </span>
          <span className="ms-auto text-[11px] font-medium text-slate-400">acting as {currentRoleLabel()}</span>
        </CardTitle>
        <p className="text-[11px] leading-relaxed text-slate-500">
          JUDGMENT rules are never scored by the engine. An advocate or company secretary signs off with reasoning and a
          timestamp; the determination is mirrored into the fact store as <span className="font-mono">judgment.&lt;rule&gt;</span> so any
          past run replays exactly.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
        )}
        {data?.openItems.map((item) => {
          const escalated = item.lastStatus === 'ESCALATED'
          return (
            <div key={item.refCode} className={cn('rounded-lg border px-3 py-2.5', escalated ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200 bg-white')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-semibold text-slate-400">{item.refCode}</span>
                <span className="text-xs font-bold text-slate-800">{item.title}</span>
                <RegulatorChip code={item.regulatorCode} />
                {escalated && (
                  <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                    escalated to counsel
                  </span>
                )}
                <Button
                  size="sm"
                  className="ms-auto bg-violet-600 text-white hover:bg-violet-700"
                  onClick={() => {
                    setActive(item)
                    setReasoning('')
                    setDecision(escalated ? 'SATISFIED' : 'SATISFIED')
                  }}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Sign off
                </Button>
              </div>
              {item.guidance && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{item.guidance}</p>}
              {item.relevantFacts.length > 0 && (
                <p className="mt-1 font-mono text-[10px] text-slate-400">{item.relevantFacts.join(' · ')}</p>
              )}
            </div>
          )
        })}
        {data && data.openItems.length === 0 && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
            Queue clear — every judgment rule carries a human determination on file.
          </p>
        )}

        {data && data.decisions.length > 0 && (
          <div className={cn('mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-1 border-t border-slate-100 pt-3', SCROLLBAR)}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Decision trail (logged with reasoning + timestamp)</p>
            {data.decisions.map((d) => {
              const meta = DECISION_META[d.decision]
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-[11px]">
                  <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', meta?.cls ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                    {meta?.label ?? d.decision}
                  </span>
                  <span className="font-mono font-semibold text-slate-700">{d.refCode}</span>
                  <span className="text-slate-600">{d.decidedBy}</span>
                  <span className="ms-auto text-slate-400">{new Date(d.decidedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {d.reasoning && <p className="w-full text-[10px] leading-relaxed text-slate-500">{d.reasoning}</p>}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Sign off {active?.refCode}</DialogTitle>
            <DialogDescription className="text-xs">
              {active?.title} — the reasoning is logged with your name, role and timestamp and becomes part of the
              replayable fact state. Acting as {currentRoleLabel()}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Determination</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DECISION_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400">{DECISION_META[decision]?.hint}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Reasoning (required, logged)</Label>
              <Textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                rows={4}
                placeholder="What was assessed, against which instrument/provisions, and the conclusion…"
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActive(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-violet-600 text-white hover:bg-violet-700"
              disabled={busy || reasoning.trim().length < 10}
              onClick={submit}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
              Record sign-off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
