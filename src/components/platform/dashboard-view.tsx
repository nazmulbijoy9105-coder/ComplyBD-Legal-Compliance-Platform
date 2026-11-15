'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { DashboardData } from '@/lib/types'
import { regulatorTheme } from '@/lib/regulator-theme'
import { RegulatorChip, StatusBadge, VerificationBadge } from './badges'
import ObligationDetailSheet from './obligation-detail-sheet'
import ExportCard from './export-card'

function daysUntil(iso: string): number {
  const now = new Date()
  const due = new Date(iso)
  return Math.ceil((due.getTime() - now.getTime()) / 86400000)
}

function dueLabel(iso: string): { text: string; cls: string } {
  const d = daysUntil(iso)
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, cls: 'text-rose-600' }
  if (d === 0) return { text: 'Due today', cls: 'text-orange-600' }
  if (d <= 7) return { text: `Due in ${d}d`, cls: 'text-orange-600' }
  return { text: `Due in ${d}d`, cls: 'text-slate-500' }
}

const KPI_ICONS = {
  total: ClipboardList,
  overdue: TriangleAlert,
  dueSoon: AlarmClock,
  filed: CheckCircle2,
}

export default function DashboardView({ onDataChange }: { onDataChange?: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      setData(json)
      onDataChange?.()
    } catch {
      // keep previous data
    } finally {
      setLoading(false)
    }
  }, [onDataChange])

  useEffect(() => {
    load()
  }, [load])

  function openDetail(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const scoreData = [
    { name: 'Filed', value: stats?.filedThisYear ?? 0 },
    { name: 'Remaining', value: Math.max(0, (stats?.total ?? 0) - (stats?.filedThisYear ?? 0)) },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Overdue alert */}
      {stats && stats.overdue > 0 && (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900">
          <TriangleAlert className="h-4 w-4 text-rose-600" />
          <AlertTitle className="text-sm font-bold">{stats.overdue} statutory filing{stats.overdue === 1 ? '' : 's'} past deadline</AlertTitle>
          <AlertDescription className="text-xs">
            Escalation chain active. Review the Obligations Register and confirm deadline citations
            against primary sources before submission.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { key: 'total', label: 'Total obligations', value: stats?.total ?? 0, sub: `${stats?.open ?? 0} open`, tone: 'text-slate-700', ring: 'ring-slate-200' },
          { key: 'overdue', label: 'Overdue', value: stats?.overdue ?? 0, sub: 'past statutory deadline', tone: 'text-rose-600', ring: 'ring-rose-200' },
          { key: 'dueSoon', label: 'Due in 30 days', value: stats?.dueSoon ?? 0, sub: 'reminders scheduled', tone: 'text-amber-600', ring: 'ring-amber-200' },
          { key: 'filed', label: 'Filed this year', value: stats?.filedThisYear ?? 0, sub: `${new Date().getFullYear()} calendar year`, tone: 'text-emerald-600', ring: 'ring-emerald-200' },
        ].map((kpi) => {
          const Icon = KPI_ICONS[kpi.key as keyof typeof KPI_ICONS]
          return (
            <Card key={kpi.key} className={cn('border-0 shadow-sm ring-1', kpi.ring)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                    <p className={cn('mt-1.5 text-3xl font-bold tracking-tight', kpi.tone)}>{kpi.value}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{kpi.sub}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-100">
                    <Icon className={cn('h-4 w-4', kpi.tone)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Score + regulator breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">Compliance score</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="relative h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreData}
                    dataKey="value"
                    innerRadius={42}
                    outerRadius={58}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-900">{stats?.complianceScore ?? 0}%</span>
                <span className="text-[10px] font-medium text-slate-400">filed</span>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-700">{stats?.total ?? 0} tracked obligations</p>
              <p className="text-slate-500">{stats?.filedThisYear ?? 0} filed this year</p>
              <p className="text-slate-500">{stats?.open ?? 0} in workflow</p>
              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 text-xs">
                <RefreshCw className={cn('mr-1.5 h-3 w-3', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">Regulator-wise status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.regulatorBreakdown.map((r) => {
                const theme = regulatorTheme(r.code)
                const pct = r.total > 0 ? Math.round((r.filed / r.total) * 100) : 0
                return (
                  <div key={r.code} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 sm:w-36">
                      <div className="truncate text-xs font-semibold text-slate-700">{r.name}</div>
                    </div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full', theme.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex w-36 shrink-0 items-center justify-end gap-2 text-[11px]">
                      {r.overdue > 0 && (
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-600">
                          {r.overdue} overdue
                        </span>
                      )}
                      {r.dueSoon > 0 && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
                          {r.dueSoon} due 30d
                        </span>
                      )}
                      <span className="text-slate-400">
                        {r.filed}/{r.total}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-0 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">Upcoming & overdue deadlines</CardTitle>
            <CalendarClock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.upcoming.map((o) => {
              const dl = dueLabel(o.dueDate)
              return (
                <button
                  key={o.id}
                  onClick={() => openDetail(o.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', regulatorTheme(o.regulatorCode).dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-800">{o.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <RegulatorChip code={o.regulatorCode} className="px-1.5 py-0" />
                      <span className="truncate">{o.assignee}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn('text-[11px] font-bold', dl.cls)}>{dl.text}</span>
                    <StatusBadge status={o.effectiveStatus} className="px-1.5 py-0 text-[10px]" />
                    {o.template ? (
                      <VerificationBadge value={o.template.verification} className="px-1.5 py-0 text-[10px]" />
                    ) : (
                      <span className="text-[10px] text-slate-400">custom</span>
                    )}
                  </div>
                </button>
              )
            })}
            {data && data.upcoming.length === 0 && (
              <p className="text-xs text-slate-400">No open obligations — all caught up.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">Audit trail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {data?.activity.map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      a.type === 'FILED'
                        ? 'bg-emerald-500'
                        : a.type === 'STATUS_CHANGE'
                          ? 'bg-violet-500'
                          : a.type === 'DOCUMENT_UPLOADED'
                            ? 'bg-amber-500'
                            : 'bg-slate-300',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] leading-snug text-slate-600">{a.message}</p>
                    <p className="text-[10px] text-slate-400">
                      {a.actor.split('—')[0].trim()} ·{' '}
                      {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export & deploy kit */}
      <ExportCard />

      <ObligationDetailSheet
        obligationId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={load}
      />
    </div>
  )
}
