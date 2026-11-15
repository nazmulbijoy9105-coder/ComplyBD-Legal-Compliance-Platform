'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity as ActivityIcon,
  CheckCircle2,
  Circle,
  FileText,
  Gavel,
  Loader2,
  MessageSquarePlus,
  Send,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ObligationDetail } from '@/lib/types'
import {
  CadenceChip,
  LawStatusBadge,
  PriorityChip,
  RegulatorChip,
  SourceTierBadge,
  StatusBadge,
  VerificationBadge,
} from './badges'
import { WORKFLOW_STATUSES, statusLabel } from '@/lib/regulator-theme'

const NEXT_ACTION: Record<string, { label: string; next: string } | null> = {
  DRAFT: { label: 'Start work', next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'Submit for review', next: 'IN_REVIEW' },
  IN_REVIEW: { label: 'Approve', next: 'APPROVED' },
  APPROVED: { label: 'Mark as filed', next: 'FILED' },
  FILED: null,
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATED: Circle,
  STATUS_CHANGE: ActivityIcon,
  COMMENT: MessageSquarePlus,
  DOCUMENT_UPLOADED: Upload,
  FILED: CheckCircle2,
  UPDATED: ActivityIcon,
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ObligationDetailSheet({
  obligationId,
  open,
  onOpenChange,
  onUpdated,
}: {
  obligationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<ObligationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [docName, setDocName] = useState('')
  const [docClass, setDocClass] = useState('INTERNAL')

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/obligations/${id}`)
      if (!res.ok) throw new Error('Failed to load obligation')
      const data = await res.json()
      setDetail(data.obligation)
    } catch {
      toast({ title: 'Could not load obligation', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (open && obligationId) {
      load(obligationId)
    } else if (!open) {
      setDetail(null)
      setComment('')
      setDocName('')
    }
  }, [open, obligationId, load])

  async function patch(body: Record<string, unknown>, successMsg: string) {
    if (!detail) return
    setBusy(true)
    try {
      const res = await fetch(`/api/obligations/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Update failed')
      }
      const data = await res.json()
      setDetail(data.obligation)
      toast({ title: successMsg })
      onUpdated?.()
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function addDocument() {
    if (!detail || !docName.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: docName.trim(),
          classification: docClass,
          obligationId: detail.id,
        }),
      })
      if (!res.ok) throw new Error('Upload failed')
      setDocName('')
      toast({ title: 'Evidence document added to vault' })
      load(detail.id)
      onUpdated?.()
    } catch {
      toast({ title: 'Could not add document', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const nextAction = detail ? NEXT_ACTION[detail.status] : null
  const currentIdx = detail ? WORKFLOW_STATUSES.indexOf(detail.status as never) : -1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        {/* SheetTitle always mounts — Radix Dialog requires it at content-mount time */}
        <SheetHeader className="space-y-2 border-b border-slate-200 px-5 py-4 text-left">
          {detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <RegulatorChip code={detail.regulatorCode} />
                <StatusBadge status={detail.effectiveStatus} />
                <PriorityChip priority={detail.priority} />
                {detail.refCode && (
                  <Badge variant="outline" className="font-mono text-[10px] text-slate-500">
                    {detail.refCode}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-base font-bold leading-snug text-slate-900">
                {detail.title}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                {detail.periodLabel ? `${detail.periodLabel} · ` : ''}
                Due {formatDate(detail.dueDate)} · {detail.assignee}
              </SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle className="sr-only">Obligation detail</SheetTitle>
              <SheetDescription className="sr-only">Loading obligation record</SheetDescription>
            </>
          )}
        </SheetHeader>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 px-5 py-4">
              {/* Workflow stepper */}
              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Workflow engine
                </h3>
                <div className="flex items-center gap-1">
                  {WORKFLOW_STATUSES.map((s, i) => {
                    const done = currentIdx > i || detail.status === 'FILED'
                    const current = detail.effectiveStatus === s
                    const overdue = detail.effectiveStatus === 'OVERDUE' && current
                    return (
                      <div key={s} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className={cn(
                            'h-1.5 w-full rounded-full',
                            done
                              ? 'bg-emerald-500'
                              : overdue
                                ? 'bg-rose-500'
                                : current
                                  ? 'bg-emerald-500/60'
                                  : 'bg-slate-200',
                          )}
                        />
                        <span
                          className={cn(
                            'text-[9px] font-medium leading-tight',
                            current ? 'text-slate-800' : 'text-slate-400',
                          )}
                        >
                          {statusLabel(s)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextAction && (
                    <Button
                      size="sm"
                      onClick={() =>
                        patch(
                          { status: nextAction.next },
                          `Status moved to ${statusLabel(nextAction.next)}`,
                        )
                      }
                      disabled={busy}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {nextAction.label}
                    </Button>
                  )}
                  {detail.status !== 'FILED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => patch({ status: 'FILED' }, 'Obligation marked as filed')}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      File directly
                    </Button>
                  )}
                  {detail.filedAt && (
                    <span className="inline-flex items-center text-xs text-emerald-700">
                      Filed on {formatDate(detail.filedAt)}
                    </span>
                  )}
                </div>
              </section>

              {/* Statutory reference */}
              {detail.template && (
                <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <SourceTierBadge tier={detail.template.sourceTier} />
                    <LawStatusBadge status={detail.template.lawStatus} />
                    <VerificationBadge value={detail.template.verification} />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">{detail.template.legalBasis}</p>
                  {detail.template.legalBasisNote && (
                    <p className="mt-1 text-[11px] italic leading-relaxed text-slate-500">
                      {detail.template.legalBasisNote}
                    </p>
                  )}
                  <Separator className="my-2" />
                  <div className="space-y-1 text-xs text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-700">Deadline rule: </span>
                      <span className={cn(detail.template.deadlineRule.includes('??') && 'text-rose-600 font-semibold')}>
                        {detail.template.deadlineRule}
                      </span>
                    </p>
                    {detail.template.deadlineNote && (
                      <p className="flex items-start gap-1.5 text-[11px] text-amber-700">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{detail.template.deadlineNote}</span>
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Meta */}
              <section className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cadence</div>
                  <div className="mt-1"><CadenceChip cadence={detail.cadence} /></div>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assignee</div>
                  <div className="mt-1 font-medium text-slate-700">{detail.assignee}</div>
                </div>
                <div className="col-span-2 rounded-lg border border-slate-200 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Statutory forms</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {detail.forms.length > 0 ? (
                      detail.forms.map((f) => (
                        <Badge key={f} variant="outline" className="text-[11px] font-normal text-slate-600">
                          {f}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Notes */}
              {detail.notes && (
                <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Working notes
                  </h4>
                  <p className="text-xs leading-relaxed text-amber-900">{detail.notes}</p>
                </section>
              )}

              {/* Documents */}
              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Evidence documents ({detail.documents.length})
                </h3>
                <div className="space-y-1.5">
                  {detail.documents.length === 0 && (
                    <p className="text-xs text-slate-400">No evidence attached yet.</p>
                  )}
                  {detail.documents.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-slate-700">{d.name}</div>
                        <div className="text-[10px] text-slate-400">
                          v{d.version} · {d.fileType} · {formatDate(d.createdAt)}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-slate-500">
                        {d.classification}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="e.g. Filing receipt.pdf"
                    className="h-9 text-xs"
                  />
                  <Select value={docClass} onValueChange={setDocClass}>
                    <SelectTrigger className="h-9 w-32 shrink-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="INTERNAL">Internal</SelectItem>
                      <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                      <SelectItem value="RESTRICTED">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={busy || !docName.trim()} onClick={addDocument}>
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </section>

              {/* Add note */}
              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Add audit note
                </h3>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Note for the compliance record…"
                  className="min-h-16 text-xs"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || !comment.trim()}
                    onClick={async () => {
                      await patch({ comment: comment.trim() }, 'Audit note recorded')
                      setComment('')
                    }}
                  >
                    <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
                    Record note
                  </Button>
                </div>
              </section>

              {/* Activity */}
              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Audit trail ({detail.activities.length})
                </h3>
                <ScrollArea className="max-h-60">
                  <div className="space-y-2.5 pr-3">
                    {detail.activities.length === 0 && (
                      <p className="text-xs text-slate-400">No activity recorded.</p>
                    )}
                    {detail.activities.map((a) => {
                      const Icon = ACTIVITY_ICONS[a.type] ?? ActivityIcon
                      return (
                        <div key={a.id} className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            <Icon className="h-3 w-3 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs leading-snug text-slate-700">{a.message}</p>
                            <p className="text-[10px] text-slate-400">
                              {a.actor} · {formatDateTime(a.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
