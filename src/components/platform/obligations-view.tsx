'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ObligationItem } from '@/lib/types'
import { regulatorTheme } from '@/lib/regulator-theme'
import { CadenceChip, PriorityChip, RegulatorChip, StatusBadge, VerificationBadge } from './badges'
import ObligationDetailSheet from './obligation-detail-sheet'
import NewObligationDialog from './new-obligation-dialog'

function dueInfo(iso: string, filed: boolean): { text: string; cls: string } {
  if (filed) return { text: 'Filed', cls: 'text-emerald-600' }
  const now = new Date()
  const due = new Date(iso)
  const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-rose-600 font-bold' }
  if (diff === 0) return { text: 'Due today', cls: 'text-orange-600 font-bold' }
  if (diff <= 7) return { text: `In ${diff}d`, cls: 'text-orange-500 font-semibold' }
  return { text: `In ${diff}d`, cls: 'text-slate-500' }
}

export default function ObligationsView({ onDataChange }: { onDataChange?: () => void }) {
  const [items, setItems] = useState<ObligationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [regulator, setRegulator] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [priority, setPriority] = useState('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (regulator !== 'ALL') params.set('regulator', regulator)
      if (status !== 'ALL') params.set('status', status)
      if (priority !== 'ALL') params.set('priority', priority)
      const res = await fetch(`/api/obligations?${params.toString()}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setItems(data.obligations ?? [])
      onDataChange?.()
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q, regulator, status, priority, onDataChange])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  function openDetail(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, assignee, notes…"
            className="pl-9 text-sm"
            aria-label="Search obligations"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={regulator} onValueChange={setRegulator}>
            <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All regulators</SelectItem>
              <SelectItem value="RJSC">RJSC</SelectItem>
              <SelectItem value="BSEC">BSEC</SelectItem>
              <SelectItem value="DSECSE">DSE &amp; CSE</SelectItem>
              <SelectItem value="NBR">NBR</SelectItem>
              <SelectItem value="DOL">Dept. of Labour</SelectItem>
              <SelectItem value="BB">Bangladesh Bank</SelectItem>
              <SelectItem value="NDGA">NDGA</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any status</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="FILED">Filed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any priority</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
          <NewObligationDialog onCreated={load} />
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              No obligations match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Obligation</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Regulator</TableHead>
                    <TableHead className="hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 md:table-cell">Cadence</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Due date</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</TableHead>
                    <TableHead className="hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:table-cell">Source review</TableHead>
                    <TableHead className="hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 xl:table-cell">Assignee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((o) => {
                    const filed = o.status === 'FILED'
                    const di = dueInfo(o.dueDate, filed)
                    const theme = regulatorTheme(o.regulatorCode)
                    return (
                      <TableRow
                        key={o.id}
                        onClick={() => openDetail(o.id)}
                        className="cursor-pointer"
                      >
                        <TableCell className="max-w-72">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', theme.dot)} />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-800">{o.title}</div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {o.refCode && (
                                  <span className="font-mono text-[10px] text-slate-400">{o.refCode}</span>
                                )}
                                {o.forms.slice(0, 1).map((f) => (
                                  <Badge key={f} variant="outline" className="hidden max-w-40 truncate text-[10px] font-normal text-slate-400 sm:inline-flex">
                                    {f}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RegulatorChip code={o.regulatorCode} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <CadenceChip cadence={o.cadence} />
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-slate-700">
                            {new Date(o.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div className={cn('text-[10px]', di.cls)}>{di.text}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={o.effectiveStatus} />
                            <PriorityChip priority={o.priority} className="hidden xl:inline-flex" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {o.template ? <VerificationBadge value={o.template.verification} /> : <span className="text-[10px] text-slate-400">custom</span>}
                        </TableCell>
                        <TableCell className="hidden max-w-40 truncate text-xs text-slate-500 xl:table-cell">
                          {o.assignee}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-slate-400">
        {items.length} obligation{items.length === 1 ? '' : 's'} · workflow state machine: Draft → In
        Progress → In Review → Approved → Filed. Open a row to advance the workflow, attach evidence
        or record audit notes. Every statutory row carries the same source-review caveats as the
        Regulatory Map — VERIFIED / PARTIAL / UNVERIFIED; custom rows (no template) are unverified
        by definition. Confirm against primary sources before reliance.
      </p>

      <ObligationDetailSheet
        obligationId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={load}
      />
    </div>
  )
}
