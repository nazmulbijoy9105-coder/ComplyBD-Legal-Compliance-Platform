'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, CheckCircle2, ExternalLink, Loader2, ScrollText, ShieldQuestion, XCircle } from 'lucide-react'
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
import type { VerificationPendingItem, VerificationQueueData } from '@/lib/types'
import { RegulatorChip, VerificationBadge } from './badges'
import { SCROLLBAR, currentRoleLabel, notifyFactsChanged } from './engine-ui'

const FORMULA_KINDS: { value: string; label: string; params: ('days' | 'months' | 'factKey' | 'monthDay')[] }[] = [
  { value: 'DAYS_FROM_MONTH_END', label: 'N days after latest completed month-end', params: ['days'] },
  { value: 'DAYS_FROM_QUARTER_END', label: 'N days after fiscal quarter-end', params: ['days'] },
  { value: 'MONTHS_FROM_FY_END', label: 'N months after fiscal year-end', params: ['months'] },
  { value: 'FIXED_DATE', label: 'Fixed statutory date (month + day)', params: ['monthDay'] },
  { value: 'DAYS_FROM_FACT', label: 'N days after an anchor fact', params: ['days', 'factKey'] },
  { value: 'DAYS_FROM_EVENT', label: 'N days after a triggering event', params: ['days'] },
  { value: 'ON_EVENT', label: 'On occurrence of the event', params: [] },
  { value: 'WITH_ANNUAL_REPORT', label: 'With the annual report cycle', params: [] },
  { value: 'ANNUAL_CYCLE', label: 'Once per fiscal year', params: [] },
  { value: 'CONTINUOUS', label: 'Continuous obligation', params: [] },
  { value: 'ON_CHANGE', label: 'On change of the underlying fact', params: [] },
]

interface ConfirmState {
  item: VerificationPendingItem
  subject: 'DEADLINE_FORMULA' | 'PENALTY_REF' | 'CITATION'
  kind: string
  days: string
  months: string
  factKey: string
  fixedMonth: string
  fixedDay: string
  ruleText: string
  penaltyText: string
  note: string
}

export default function VerificationQueueCard({ onMutate }: { onMutate?: () => void }) {
  const { toast } = useToast()
  const [data, setData] = useState<VerificationQueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/verification-queue')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openConfirm(item: VerificationPendingItem, subject: ConfirmState['subject']) {
    setConfirm({
      item,
      subject,
      kind: item.deadlineFormula?.kind && FORMULA_KINDS.some((k) => k.value === item.deadlineFormula?.kind)
        ? item.deadlineFormula.kind
        : 'DAYS_FROM_QUARTER_END',
      days: String(item.deadlineFormula?.days ?? ''),
      months: String(item.deadlineFormula?.months ?? ''),
      factKey: String(item.deadlineFormula?.factKey ?? ''),
      fixedMonth: String(item.deadlineFormula?.month ?? ''),
      fixedDay: String(item.deadlineFormula?.day ?? ''),
      ruleText: item.claim,
      penaltyText: item.penaltyRef?.replace(/UNVERIFIED[^.]*\.?/gi, '').trim() ?? '',
      note: '',
    })
  }

  async function submitConfirm(action: 'CONFIRM' | 'REJECT') {
    if (!confirm) return
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        refCode: confirm.item.refCode,
        subject: confirm.subject,
        action,
        note: confirm.note.trim(),
      }
      if (action === 'CONFIRM' && confirm.subject === 'DEADLINE_FORMULA') {
        const formula: Record<string, unknown> = { kind: confirm.kind }
        if (confirm.days) formula.days = Number(confirm.days)
        if (confirm.months) formula.months = Number(confirm.months)
        if (confirm.factKey) formula.factKey = confirm.factKey.trim()
        if (confirm.fixedMonth && confirm.fixedDay) {
          formula.month = Number(confirm.fixedMonth)
          formula.day = Number(confirm.fixedDay)
        }
        payload.formula = formula
        if (confirm.ruleText.trim()) payload.confirmedRuleText = confirm.ruleText.trim()
      }
      if (action === 'CONFIRM' && confirm.subject === 'PENALTY_REF') {
        payload.confirmedPenaltyRef = confirm.penaltyText.trim()
      }
      const res = await fetch('/api/verification-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Verification failed')
      }
      toast({
        title: action === 'CONFIRM' ? `${confirm.item.refCode} confirmed against the instrument` : `${confirm.item.refCode} rejected`,
        description:
          action === 'CONFIRM'
            ? 'A new rule version was appended (never edited in place) — the finding stops being provisional.'
            : 'The claim stays unverified and the rejection is logged.',
      })
      setConfirm(null)
      load()
      notifyFactsChanged()
      onMutate?.()
    } catch (e) {
      toast({ title: 'Verification failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
          <ScrollText className="h-4 w-4 text-amber-500" />
          Verification queue — every deadline confirmed against its instrument
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
            {data?.pending.length ?? '…'} pending
          </span>
          <span className={cn(
            'ms-auto rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
            (data?.verifiedDeadlinePct ?? 0) === 100
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200',
          )}>
            {data?.verifiedDeadlinePct ?? 0}% of deterministic deadlines instrument-verified
          </span>
        </CardTitle>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Rule-entry discipline, built in: the engine scores DETERMINISTIC rules mechanically (dates in, answer out) while each
          deadline is confirmed here against the actual law text before it goes in. A confirmation appends a NEW rule version
          citing the instrument — it never edits the old one. Acting as {currentRoleLabel()}.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
        )}
        <div className={cn('max-h-96 space-y-2 overflow-y-auto pr-1', SCROLLBAR)}>
          {data?.pending.map((item) => (
            <div key={item.refCode} className="rounded-lg border border-amber-200/70 bg-amber-50/30 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-semibold text-slate-400">{item.refCode}</span>
                <span className="text-xs font-bold text-slate-800">{item.title}</span>
                <RegulatorChip code={item.regulatorCode} />
                <VerificationBadge value={item.ruleVerification} />
                <div className="ms-auto flex flex-wrap gap-1.5">
                  {item.subjects.includes('DEADLINE_FORMULA') && (
                    <Button size="sm" variant="outline" className="h-7 border-amber-300 bg-white text-amber-800 hover:bg-amber-50" onClick={() => openConfirm(item, 'DEADLINE_FORMULA')}>
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Confirm deadline
                    </Button>
                  )}
                  {item.subjects.includes('PENALTY_REF') && (
                    <Button size="sm" variant="outline" className="h-7 border-amber-300 bg-white text-amber-800 hover:bg-amber-50" onClick={() => openConfirm(item, 'PENALTY_REF')}>
                      <ShieldQuestion className="h-3.5 w-3.5" />
                      Confirm penalty
                    </Button>
                  )}
                  {item.subjects.includes('CITATION') && (
                    <Button size="sm" variant="outline" className="h-7 border-amber-300 bg-white text-amber-800 hover:bg-amber-50" onClick={() => openConfirm(item, 'CITATION')}>
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Confirm citation
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-1.5 grid gap-1.5 text-[11px] leading-relaxed text-slate-600 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-700">Claim:</span> {item.claim}
                  {item.deadlineFormula && (
                    <span className="font-mono text-[10px] text-slate-400"> · kind {item.deadlineFormula.kind}{item.deadlineFormula.unverified ? ' (unverified)' : ''}</span>
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Instrument:</span>
                  {item.instrumentCode ? (
                    <>
                      <span className="font-mono text-[10px]">{item.instrumentCode}</span>
                      <span>{item.instrumentTitle}</span>
                      {item.instrumentSourceUrl && (
                        <a href={item.instrumentSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-emerald-700 underline decoration-dotted">
                          open source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-700">no instrument cited — register it first</span>
                  )}
                </p>
                {item.penaltyRef && <p className="md:col-span-2 text-[10px] text-amber-700"><ShieldQuestion className="mr-1 inline h-3 w-3" />Penalty: {item.penaltyRef}</p>}
              </div>
            </div>
          ))}
          {data && data.pending.length === 0 && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
              Queue clear — every deterministic deadline, penalty reference and citation is confirmed against its registered instrument.
            </p>
          )}
        </div>

        {data && data.recent.length > 0 && (
          <div className={cn('border-t border-slate-100 pt-3', SCROLLBAR)}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent confirmations (new version appended per confirmation)</p>
            <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
              {data.recent.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-[11px]">
                  {v.status === 'CONFIRMED' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  <span className="font-mono font-semibold text-slate-700">{v.refCode}</span>
                  <span className="text-slate-500">{v.subject}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', v.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                    {v.status}
                  </span>
                  {v.proposedNote && <span className="min-w-0 truncate text-slate-400">{v.proposedNote}</span>}
                  <span className="ms-auto text-slate-400">{v.decidedBy ?? '—'}{v.decidedAt ? ` · ${new Date(v.decidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  Confirm {confirm.subject.replaceAll('_', ' ').toLowerCase()} — {confirm.item.refCode}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Check the claim against the registered instrument ({confirm.item.instrumentTitle ?? 'not registered'}) and record
                  where in the text you confirmed it. A new rule version is appended — the old one is never edited. Acting as{' '}
                  {currentRoleLabel()}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {confirm.subject === 'DEADLINE_FORMULA' && (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Formula kind (engine capability)</Label>
                        <Select value={confirm.kind} onValueChange={(v) => setConfirm({ ...confirm, kind: v })}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FORMULA_KINDS.map((k) => (
                              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {FORMULA_KINDS.find((k) => k.value === confirm.kind)?.params.includes('days') && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Days</Label>
                          <Input type="number" min="0" value={confirm.days} onChange={(e) => setConfirm({ ...confirm, days: e.target.value })} className="text-xs" />
                        </div>
                      )}
                      {FORMULA_KINDS.find((k) => k.value === confirm.kind)?.params.includes('months') && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Months</Label>
                          <Input type="number" min="0" value={confirm.months} onChange={(e) => setConfirm({ ...confirm, months: e.target.value })} className="text-xs" />
                        </div>
                      )}
                      {FORMULA_KINDS.find((k) => k.value === confirm.kind)?.params.includes('factKey') && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-700">Anchor fact key</Label>
                          <Input value={confirm.factKey} onChange={(e) => setConfirm({ ...confirm, factKey: e.target.value })} className="text-xs" placeholder="e.g. last_agm_date" />
                        </div>
                      )}
                      {FORMULA_KINDS.find((k) => k.value === confirm.kind)?.params.includes('monthDay') && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Month (1-12)</Label>
                            <Input type="number" min="1" max="12" value={confirm.fixedMonth} onChange={(e) => setConfirm({ ...confirm, fixedMonth: e.target.value })} className="text-xs" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Day (1-31)</Label>
                            <Input type="number" min="1" max="31" value={confirm.fixedDay} onChange={(e) => setConfirm({ ...confirm, fixedDay: e.target.value })} className="text-xs" />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Verified rule text</Label>
                      <Input value={confirm.ruleText} onChange={(e) => setConfirm({ ...confirm, ruleText: e.target.value })} className="text-xs" />
                    </div>
                  </>
                )}
                {confirm.subject === 'PENALTY_REF' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Verified penalty citation</Label>
                    <Input value={confirm.penaltyText} onChange={(e) => setConfirm({ ...confirm, penaltyText: e.target.value })} className="text-xs" placeholder="e.g. s. 133 penalty provision — confirmed on bdlaws" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Citation note — where in the instrument? (required)</Label>
                  <Textarea
                    value={confirm.note}
                    onChange={(e) => setConfirm({ ...confirm, note: e.target.value })}
                    rows={3}
                    placeholder='e.g. "s. 133 read with s. 2CC — confirmed against bdlaws.minlaw.gov.bd text, 15 Nov 2026"'
                    className="text-xs"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
                <Button variant="outline" size="sm" className="border-rose-200 text-rose-700 hover:bg-rose-50" disabled={busy || confirm.note.trim().length < 5} onClick={() => submitConfirm('REJECT')}>
                  <XCircle className="h-3.5 w-3.5" />
                  Reject claim
                </Button>
                <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy || confirm.note.trim().length < 5} onClick={() => submitConfirm('CONFIRM')}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Confirm — append version
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
